/**
 * ∞ 분수 탐험대 — 구글 앱스 스크립트 백엔드
 *
 * 설치(선생님 한 번만)
 *  1. 구글 시트를 새로 만들고 [확장 프로그램 → Apps Script]를 연다.
 *  2. 이 파일 내용을 Code.gs에 통째로 붙여 넣고 저장한다.
 *  3. 위쪽 함수 목록에서 setup 을 골라 [실행] → 권한 허용. (시트 탭과 사진 폴더가 만들어진다)
 *  4. settings 탭의 teacherPin 값을 원하는 숫자로 바꾼다(기본 1234).
 *  5. [배포 → 새 배포 → 유형: 웹 앱] 실행: 나 / 액세스: 모든 사용자 → 배포.
 *  6. 나온 웹 앱 주소(https://script.google.com/macros/s/…/exec)를
 *     common/api.js 의 GAS_URL 칸에 붙여 넣거나, 모음 페이지 '선생님 설정'에 붙여 넣는다.
 *
 * 요청은 POST, 본문은 text/plain JSON { action, data } (CORS 사전 요청을 피하려고).
 * 학생 이름은 받지 않는다. 학급 코드 + 번호만.
 */

var TABS = {
  log: ['time', 'classCode', 'no', 'app', 'mode', 'level', 'question', 'answer', 'correct', 'reason'],
  progress: ['classCode', 'no', 'app', 'stage', 'solved', 'correctStreak', 'updatedAt'],
  bank: ['id', 'classCode', 'no', 'type', 'shape', 'd', 'shaded', 'prompt', 'answer', 'hint', 'photoFileId', 'approved', 'likes', 'createdAt'],
  comments: ['id', 'bankId', 'classCode', 'no', 'text', 'createdAt'],
  settings: ['key', 'value'],
};

var BAD_WORDS = ['바보', '멍청', '병신', '씨발', '시발', '개새', '꺼져', '죽어', '닥쳐', '찐따', '존나', 'ㅅㅂ', 'ㅂㅅ', 'ㅈㄴ'];

// ---------- 설치 ----------

function setup() {
  Object.keys(TABS).forEach(function (name) { sheet_(name); });
  var s = sheet_('settings');
  if (!getSetting_('teacherPin')) s.appendRow(['teacherPin', '1234']);
  if (!getSetting_('maxDenominator')) s.appendRow(['maxDenominator', '12']);
  photoFolder_();
  var first = SpreadsheetApp.getActive().getSheetByName('시트1') || SpreadsheetApp.getActive().getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && SpreadsheetApp.getActive().getSheets().length > 1) {
    SpreadsheetApp.getActive().deleteSheet(first);
  }
  Logger.log('준비 완료. settings 탭에서 teacherPin을 바꾸고 웹 앱으로 배포하세요.');
}

// ---------- 입구 ----------

function doGet() {
  return json_({ ok: true, app: '분수 탐험대', time: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '요청을 읽을 수 없어요' });
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (body.action === 'batch') return json_(batch_(body.items || []));
    return json_(handle_(body.action, body.data || {}));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) { /* 무시 */ }
  }
}

// 학생 기기 대기열에서 한꺼번에 온 기록. 같은 기록이 두 번 오면(qid) 한 번만 저장한다.
function batch_(items) {
  var cache = CacheService.getScriptCache();
  var done = 0;
  items.forEach(function (it) {
    if (!it || !it.action) return;
    if (it.qid && cache.get('q' + it.qid)) { done++; return; }
    handle_(it.action, it.data || {});
    if (it.qid) cache.put('q' + it.qid, '1', 21600);
    done++;
  });
  return { ok: true, done: done };
}

function handle_(action, d) {
  switch (action) {
    case 'log': return addLog_(d);
    case 'progress': return setProgress_(d);
    case 'submitProblem': return submitProblem_(d);
    case 'listProblems': return listProblems_(d);
    case 'like': return like_(d);
    case 'comment': return comment_(d);
    case 'approve': return approve_(d);
    case 'dashboard': return dashboard_(d);
    case 'publicSummary': return { ok: true, totals: summarize_(String(d.classCode || ''), false).totals };
    case 'photo': return photo_(d);
    case 'ping': return { ok: true };
    default: return { ok: false, error: '모르는 요청: ' + action };
  }
}

// ---------- 기록 ----------

function addLog_(d) {
  sheet_('log').appendRow([
    d.time || new Date().toISOString(), str_(d.classCode), Number(d.no) || '', str_(d.app), str_(d.mode),
    d.level === undefined ? '' : d.level, str_(d.question), str_(d.answer), d.correct === true, str_(d.reason),
  ]);
  return { ok: true };
}

function setProgress_(d) {
  var s = sheet_('progress');
  var rows = s.getDataRange().getValues();
  var row = [str_(d.classCode), Number(d.no) || '', str_(d.app), d.stage, Number(d.solved) || 0, Number(d.correctStreak) || 0, d.time || new Date().toISOString()];
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === row[0] && String(rows[i][1]) === String(row[1]) && rows[i][2] === row[2]) {
      s.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  s.appendRow(row);
  return { ok: true };
}

// ---------- 문제은행 ----------

function submitProblem_(d) {
  var s = sheet_('bank');
  var id = str_(d.id) || Utilities.getUuid();
  var ids = s.getRange(1, 1, Math.max(1, s.getLastRow()), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (ids[i][0] === id) return { ok: true, id: id };

  var photoId = '';
  if (d.photo && /^data:image\/(jpeg|png|webp);base64,/.test(d.photo)) {
    var m = d.photo.match(/^data:(image\/\w+);base64,(.*)$/);
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], id + '.' + m[1].split('/')[1]);
    photoId = photoFolder_().createFile(blob).getId();
  }
  s.appendRow([
    id, str_(d.classCode), Number(d.no) || '', str_(d.type), str_(d.shape), d.d || '', str_(d.shaded),
    str_(d.prompt), str_(d.answer), str_(d.hint), photoId, false, 0, d.time || new Date().toISOString(),
  ]);
  return { ok: true, id: id };
}

function listProblems_(d) {
  var cls = str_(d.classCode);
  var comments = commentsByBank_(cls);
  var out = rows_('bank').filter(function (b) { return String(b.classCode) === cls && truthy_(b.approved); })
    .map(function (b) { return problemOut_(b, comments); });
  return { ok: true, problems: out };
}

function like_(d) {
  var s = sheet_('bank');
  var rows = s.getDataRange().getValues();
  var col = TABS.bank.indexOf('likes');
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === d.bankId) {
      s.getRange(i + 1, col + 1).setValue((Number(rows[i][col]) || 0) + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: '문제를 찾지 못했어요' };
}

function comment_(d) {
  var text = cleanComment_(d.text);
  if (!text) return { ok: false, error: '빈 댓글' };
  sheet_('comments').appendRow([Utilities.getUuid(), str_(d.bankId), str_(d.classCode), Number(d.no) || '', text, d.time || new Date().toISOString()]);
  return { ok: true };
}

function approve_(d) {
  if (!pinOk_(d.pin)) return { ok: false, error: 'PIN이 맞지 않아요' };
  var s = sheet_('bank');
  var rows = s.getDataRange().getValues();
  var col = TABS.bank.indexOf('approved');
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === d.id) {
      s.getRange(i + 1, col + 1).setValue(d.approved === true);
      return { ok: true };
    }
  }
  return { ok: false, error: '문제를 찾지 못했어요' };
}

function photo_(d) {
  var id = str_(d.id);
  // 문제은행에 등록된 사진만 내어 준다
  var known = rows_('bank').some(function (b) { return b.photoFileId === id; });
  if (!id || !known) return { ok: false, error: '사진이 없어요' };
  var blob = DriveApp.getFileById(id).getBlob();
  return { ok: true, dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

// ---------- 교사 대시보드 ----------

function dashboard_(d) {
  if (!pinOk_(d.pin)) return { ok: false, error: 'PIN이 맞지 않아요' };
  var out = summarize_(str_(d.classCode), true);
  out.ok = true;
  return out;
}

function summarize_(cls, full) {
  // mode 'stage'(단계 변경 기록)는 풀이 수에서 뺀다
  var log = rows_('log').filter(function (l) { return String(l.classCode) === cls && l.mode !== 'stage'; });
  var prog = rows_('progress').filter(function (p) { return String(p.classCode) === cls; });
  var correct = log.filter(function (l) { return truthy_(l.correct); }).length;
  var nos = {};
  log.forEach(function (l) { nos[l.no] = 1; });
  prog.forEach(function (p) { nos[p.no] = 1; });
  var out = { classCode: cls, totals: { students: Object.keys(nos).length, solved: log.length, correct: correct } };
  if (!full) return out;

  function groupBy(app) {
    var g = {};
    prog.filter(function (p) { return p.app === app; }).forEach(function (p) {
      (g[p.stage] = g[p.stage] || []).push(Number(p.no));
    });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return a - b; }); });
    return g;
  }
  out.playground = groupBy('playground');
  out.challenge = groupBy('challenge');

  var qs = {};
  log.forEach(function (l) {
    if (!l.question) return;
    var k = l.app + '|' + l.question;
    var q = qs[k] = qs[k] || { app: l.app, question: l.question, tries: 0, wrong: 0 };
    q.tries++;
    if (!truthy_(l.correct)) q.wrong++;
  });
  out.hardest = Object.keys(qs).map(function (k) { return qs[k]; })
    .filter(function (q) { return q.tries >= 3 && q.wrong > 0; })
    .map(function (q) { q.rate = q.wrong / q.tries; return q; })
    .sort(function (a, b) { return b.rate - a.rate || b.tries - a.tries; })
    .slice(0, 5);

  var comments = commentsByBank_(cls);
  out.problems = rows_('bank').filter(function (b) { return String(b.classCode) === cls; })
    .map(function (b) { var p = problemOut_(b, comments); p.hasPhoto = !!b.photoFileId; return p; });
  return out;
}

// ---------- 도우미 ----------

function problemOut_(b, comments) {
  return {
    id: b.id, classCode: String(b.classCode), no: Number(b.no), type: b.type, shape: b.shape, d: b.d,
    shaded: b.shaded, prompt: b.prompt, answer: String(b.answer), hint: b.hint, photoFileId: b.photoFileId,
    approved: truthy_(b.approved), likes: Number(b.likes) || 0, createdAt: String(b.createdAt),
    comments: (comments[b.id] || []).slice(-20),
  };
}

function commentsByBank_(cls) {
  var map = {};
  rows_('comments').forEach(function (c) {
    if (String(c.classCode) !== cls) return;
    (map[c.bankId] = map[c.bankId] || []).push({ text: c.text, createdAt: String(c.createdAt) });
  });
  return map;
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(TABS[name]);
    s.setFrozenRows(1);
  }
  return s;
}

function rows_(name) {
  var values = sheet_(name).getDataRange().getValues();
  var head = values.shift() || [];
  return values.map(function (r) {
    var o = {};
    head.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
}

function getSetting_(key) {
  var rows = rows_('settings');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return String(rows[i].value);
  return '';
}

// 교사 PIN: 스크립트 속성 TEACHER_PIN이 있으면 그것을, 없으면 settings 탭 teacherPin을 쓴다.
function pinOk_(pin) {
  var p = PropertiesService.getScriptProperties().getProperty('TEACHER_PIN') || getSetting_('teacherPin') || '1234';
  return String(pin) === String(p);
}

function photoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (_) { /* 지워졌으면 새로 */ }
  }
  var f = DriveApp.createFolder('분수 탐험대 사진');
  props.setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}

function cleanComment_(text) {
  var t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  BAD_WORDS.forEach(function (w) { t = t.split(w).join(new Array(w.length + 1).join('♡')); });
  return t;
}

function truthy_(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

function str_(v) {
  return v === undefined || v === null ? '' : String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
