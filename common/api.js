// 구글 앱스 스크립트(GAS) 통신 + localStorage 대기열
//
// ▶ 다른 선생님께: 시트 사본에서 배포한 웹 앱 주소를 아래 GAS_URL 칸에 붙여 넣으세요.
//   (파일을 고치기 어려우면 모음 페이지 '선생님 설정'에 붙여 넣거나, 주소 뒤에 ?api=웹앱주소 를 붙여도 됩니다.)
export const GAS_URL = '';
//
// 동작 방식
//   - 기록(log, progress, 문제 제출, 좋아요, 댓글, 승인)은 먼저 이 기기의 대기열에 넣고 보낸다.
//     주소가 없거나 인터넷이 끊기면 대기열에 남아 있다가, 연결되면 다시 보낸다.
//   - 주소가 없으면 이 기기 안의 '작은 저장소'(localDb)가 GAS 대신 답한다.
//     그래서 GAS 없이 열어도 모든 앱이 동작한다(기록은 이 기기 안에서만 보임).

const Q_KEY = 'fx-queue';
const API_KEY = 'fx-api';
const DB_KEY = 'fx-db';
const Q_MAX = 2000;
const BATCH = 40;
const TIMEOUT = 15000;

// ---------- 주소 ----------

// 주소의 ?api= 는 페이지를 열 때 한 번만 읽어 이 기기에 저장한다.
// (apiUrl → setApiUrl → 상태 알림 → apiUrl … 로 끝없이 도는 일이 없도록 여기서는 알림을 보내지 않음)
(function saveApiParam() {
  const p = new URLSearchParams(location.search).get('api');
  if (!p) return;
  if (/^https:\/\/script\.google(usercontent)?\.com\//.test(p)) storeApiUrl(p);
  else if (p === 'off') storeApiUrl('');
})();

function storeApiUrl(url) {
  try {
    if (url) localStorage.setItem(API_KEY, url.trim());
    else localStorage.removeItem(API_KEY);
  } catch (_) { /* 무시 */ }
}

export function apiUrl() {
  let saved = '';
  try { saved = localStorage.getItem(API_KEY) || ''; } catch (_) { /* 무시 */ }
  return saved || GAS_URL || '';
}

export function setApiUrl(url) {
  storeApiUrl(url);
  emitStatus();
}

export function hasBackend() {
  return !!apiUrl();
}

// ---------- 상태 알림 ----------
// 'local'   : 주소 없음(이 기기에만 저장)
// 'online'  : 보낼 것 없음
// 'pending' : 보낼 기록이 남아 있음
// 'offline' : 마지막 전송 실패
const listeners = new Set();
let lastError = false;

export function onStatus(cb) {
  listeners.add(cb);
  cb(status());
  return () => listeners.delete(cb);
}

export function status() {
  const n = readQueue().length;
  if (!hasBackend()) return { state: 'local', pending: n };
  if (lastError) return { state: 'offline', pending: n };
  return { state: n ? 'pending' : 'online', pending: n };
}

function emitStatus() {
  const s = status();
  listeners.forEach((cb) => cb(s));
}

// ---------- 대기열 ----------

function readQueue() {
  try { return JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch (_) { return []; }
}

function writeQueue(q) {
  try { localStorage.setItem(Q_KEY, JSON.stringify(q.slice(-Q_MAX))); } catch (_) { /* 저장 공간 부족 */ }
}

function qid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 기록 보내기(답을 기다리지 않음). 앱은 이 함수만 부르면 된다.
export function record(action, data) {
  const item = { qid: qid(), action, data: { ...data, time: data.time || new Date().toISOString() } };
  const q = readQueue();
  q.push(item);
  writeQueue(q);
  if (!hasBackend()) localDb(action, item.data);
  emitStatus();
  flush();
  return item;
}

let flushing = null;

export function flush() {
  if (!hasBackend()) return Promise.resolve(false);
  // .finally는 항상 나중에 실행되므로, 보낼 것이 없어 바로 끝나도 flushing이 남지 않는다.
  if (!flushing) flushing = sendQueue().finally(() => { flushing = null; });
  return flushing;
}

async function sendQueue() {
  try {
    for (;;) {
      const q = readQueue();
      if (!q.length) break;
      const chunk = q.slice(0, BATCH);
      const res = await post({ action: 'batch', items: chunk });
      if (!res || !res.ok) throw new Error(res?.error || '전송 실패');
      const sent = new Set(chunk.map((i) => i.qid));
      writeQueue(readQueue().filter((i) => !sent.has(i.qid)));
    }
    lastError = false;
    return true;
  } catch (_) {
    lastError = true;
    return false;
  } finally {
    emitStatus();
  }
}

// 답이 필요한 요청(문제 목록, 대시보드). 주소가 없으면 이 기기 저장소가 답한다.
export async function call(action, data = {}) {
  if (!hasBackend()) return localDb(action, data);
  await flush(); // 방금 쌓인 기록이 먼저 반영되도록
  const res = await post({ action, data });
  lastError = false;
  emitStatus();
  return res;
}

async function post(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    // text/plain 으로 보내면 CORS 사전 요청이 없다(GAS가 받을 수 있음).
    const r = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    lastError = true;
    emitStatus();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

window.addEventListener('online', () => flush());
setInterval(() => { if (readQueue().length) flush(); }, 30000);
setTimeout(() => flush(), 1500);

// ---------- 이 기기 저장소(GAS 대신) ----------
// GAS의 Code.gs와 같은 모양으로 답한다.

export const LOCAL_PIN = '1234'; // GAS settings 탭 기본값과 같게

function loadDb() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch (_) { db = null; }
  return db || { log: [], progress: [], bank: [], comments: [] };
}

function saveDb(db) {
  db.log = db.log.slice(-3000);
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (_) { /* 무시 */ }
}

const BAD_WORDS = ['바보', '멍청', '병신', '씨발', '시발', '개새', '꺼져', '죽어', '닥쳐', '찐따', '존나', 'ㅅㅂ', 'ㅂㅅ', 'ㅈㄴ'];

export function cleanComment(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  for (const w of BAD_WORDS) t = t.split(w).join('♡'.repeat(w.length));
  return t;
}

function localDb(action, d) {
  const db = loadDb();
  const cls = String(d.classCode || '');
  switch (action) {
    case 'log':
      db.log.push({
        time: d.time, classCode: cls, no: d.no, app: d.app, mode: d.mode || '', level: d.level ?? '',
        question: d.question || '', answer: d.answer ?? '', correct: !!d.correct, reason: d.reason || '',
      });
      saveDb(db);
      return { ok: true };

    case 'progress': {
      const i = db.progress.findIndex((p) => p.classCode === cls && String(p.no) === String(d.no) && p.app === d.app);
      const row = { classCode: cls, no: d.no, app: d.app, stage: d.stage, solved: d.solved || 0, correctStreak: d.correctStreak || 0, updatedAt: d.time };
      if (i >= 0) db.progress[i] = row; else db.progress.push(row);
      saveDb(db);
      return { ok: true };
    }

    case 'submitProblem':
      if (!db.bank.some((b) => b.id === d.id)) {
        db.bank.push({
          id: d.id, classCode: cls, no: d.no, type: d.type, shape: d.shape || '', d: d.d || '',
          shaded: d.shaded || '', prompt: d.prompt || '', answer: d.answer || '', hint: d.hint || '',
          photoFileId: '', photo: d.photo || '', approved: false, likes: 0, createdAt: d.time,
        });
        saveDb(db);
      }
      return { ok: true, id: d.id };

    case 'like': {
      const b = db.bank.find((x) => x.id === d.bankId);
      if (b) b.likes = (b.likes || 0) + 1;
      saveDb(db);
      return { ok: true };
    }

    case 'comment': {
      const text = cleanComment(d.text);
      if (text) db.comments.push({ id: qid(), bankId: d.bankId, classCode: cls, no: d.no, text, createdAt: d.time });
      saveDb(db);
      return { ok: true };
    }

    case 'approve': {
      if (String(d.pin) !== LOCAL_PIN) return { ok: false, error: 'PIN이 맞지 않아요' };
      const b = db.bank.find((x) => x.id === d.id);
      if (b) b.approved = !!d.approved;
      saveDb(db);
      return { ok: true };
    }

    case 'listProblems': {
      const rows = db.bank.filter((b) => b.classCode === cls && b.approved);
      return { ok: true, problems: rows.map((b) => withComments(b, db)) };
    }

    case 'dashboard':
      if (String(d.pin) !== LOCAL_PIN) return { ok: false, error: 'PIN이 맞지 않아요' };
      return { ok: true, ...summarize(db, cls, true) };

    case 'publicSummary':
      return { ok: true, ...summarize(db, cls, false) };

    default:
      return { ok: false, error: `모르는 요청: ${action}` };
  }
}

function withComments(b, db) {
  const cs = db.comments.filter((c) => c.bankId === b.id).slice(-20);
  return { ...b, comments: cs.map((c) => ({ text: c.text, createdAt: c.createdAt })) };
}

// 대시보드 요약 — Code.gs의 summarize와 같은 결과 모양
export function summarize(db, cls, full) {
  // mode 'stage'(단계 변경 기록)는 풀이 수에서 뺀다
  const log = db.log.filter((l) => l.classCode === cls && l.mode !== 'stage');
  const prog = db.progress.filter((p) => p.classCode === cls);
  const solved = log.length;
  const correct = log.filter((l) => l.correct === true || l.correct === 'TRUE' || l.correct === 'true').length;
  const students = new Set([...log.map((l) => String(l.no)), ...prog.map((p) => String(p.no))]).size;
  const out = { classCode: cls, totals: { students, solved, correct } };
  if (!full) return out;

  const groupBy = (app) => {
    const g = {};
    prog.filter((p) => p.app === app).forEach((p) => {
      (g[p.stage] = g[p.stage] || []).push(Number(p.no));
    });
    Object.values(g).forEach((a) => a.sort((x, y) => x - y));
    return g;
  };
  out.playground = groupBy('playground');
  out.challenge = groupBy('challenge');

  const qs = {};
  log.forEach((l) => {
    if (!l.question) return;
    const k = `${l.app}|${l.question}`;
    const q = (qs[k] = qs[k] || { app: l.app, question: l.question, tries: 0, wrong: 0 });
    q.tries++;
    if (!(l.correct === true || l.correct === 'TRUE' || l.correct === 'true')) q.wrong++;
  });
  out.hardest = Object.values(qs)
    .filter((q) => q.tries >= 3 && q.wrong > 0)
    .map((q) => ({ ...q, rate: q.wrong / q.tries }))
    .sort((a, b) => b.rate - a.rate || b.tries - a.tries)
    .slice(0, 5);

  out.problems = db.bank
    .filter((b) => b.classCode === cls)
    .map((b) => ({ ...withComments(b, db), hasPhoto: !!(b.photo || b.photoFileId) }));
  return out;
}
