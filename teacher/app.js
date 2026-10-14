// 교사 대시보드
//   학급 코드 + 교사 PIN으로 들어간다.
//   현황: ② 미션 단계별 / ④ 레벨별 학생 번호, 오답률 높은 문제 TOP5, 반 전체 풀이 수
//   문제은행: 승인/숨김
//   ?view=public&class=… : 학생 화면용 공개 보기(반 전체 합계만, 번호 없음)
//   30초마다 자동 새로고침
//   ?demo=1 : 보고서 캡처용 예시(가상) 자료 — 학생 25명, 학급 '1반'. 시트에는 아무것도 쓰지 않는다.

import { call as realCall, hasBackend, LOCAL_PIN, flush as realFlush, summarize } from '../common/api.js';
import { generateDemoDb, DEMO_CLASS } from '../common/demo.js';
import { h, put, clear, topBar } from '../common/ui.js';
import { cleanClass, params } from '../common/session.js';
import { renderPreview } from '../common/problem.js';

const app = document.getElementById('app');
const KEY = 'fx-teacher';
const REFRESH = 30000;

const PG_STAGES = [['1', '1단계 보고 쓰기'], ['2', '2단계 읽고 색칠'], ['3', '3단계 같은 분수'], ['4', '도전 모드']];
const CH_LEVELS = [['1', 'Lv1 그림 비교'], ['2', 'Lv2 분모 같은'], ['3', 'Lv3 단위분수'], ['4', 'Lv4 섞기+이유']];
const APP_NAMES = { playground: '분수 놀이터', challenge: '비교 챌린지', bank: '문제은행' };

let timer = null;

// ---------- 예시(가상) 자료 ----------
// ?demo=1 이면 시트 대신 화면 안에서 만든 가상 자료로 답한다(승인 버튼도 화면 안에서만 바뀜).
const DEMO = params.get('demo') === '1';
const demoDb = DEMO ? generateDemoDb(cleanClass(params.get('class')) || DEMO_CLASS) : null;
async function call(action, data) {
  if (!DEMO) return realCall(action, data);
  if (action === 'dashboard') return { ok: true, ...summarize(demoDb, data.classCode, true) };
  if (action === 'publicSummary') return { ok: true, ...summarize(demoDb, data.classCode, false) };
  if (action === 'approve') {
    const b = demoDb.bank.find((x) => x.id === data.id);
    if (b) b.approved = !!data.approved;
    return { ok: true };
  }
  return { ok: false, error: '예시 자료에서는 쓸 수 없어요' };
}
const flush = () => (DEMO ? Promise.resolve(true) : realFlush());
const demoBadge = () => (DEMO ? h('span', { class: 'demo-badge', title: '보고서 캡처용 가상 자료예요. 실제 학생 기록이 아니에요.' }, '예시 자료(가상)') : null);
const demoQuery = DEMO ? '&demo=1' : '';

if (params.get('view') === 'public') publicView(cleanClass(params.get('class')) || (DEMO ? DEMO_CLASS : ''));
else if (DEMO) mainView({ classCode: cleanClass(params.get('class')) || DEMO_CLASS, pin: '' });
else {
  const saved = loadLogin();
  if (saved) mainView(saved);
  else loginView();
}

function loadLogin() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
}

function saveLogin(v) {
  try {
    if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
    else sessionStorage.removeItem(KEY);
  } catch (_) { /* 무시 */ }
}

// ---------- 들어가기 ----------

function loginView(message = '') {
  const cls = h('input', { class: 'text-input', placeholder: '학급 코드 (예: 3반)', maxlength: 12, 'aria-label': '학급 코드' });
  const pin = h('input', { class: 'text-input', type: 'password', inputmode: 'numeric', placeholder: '교사 PIN', maxlength: 12, 'aria-label': '교사 PIN' });
  const msg = h('p', { class: 'login-msg' }, message);
  const go = async () => {
    const login = { classCode: cleanClass(cls.value), pin: pin.value.trim() };
    if (!login.classCode || !login.pin) { msg.textContent = '학급 코드와 PIN을 넣어 주세요.'; return; }
    msg.textContent = '확인하는 중…';
    try {
      const r = await call('dashboard', login);
      if (!r || !r.ok) { msg.textContent = r?.error || '들어갈 수 없어요.'; return; }
      saveLogin(login);
      mainView(login, r);
    } catch (_) {
      msg.textContent = '시트에 연결할 수 없어요. 인터넷과 웹 앱 주소를 확인해 주세요.';
    }
  };
  pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  clear(app, 
    topBar({ title: '교사 대시보드', showStatus: false }),
    h('main', { class: 't-main' },
      h('div', { class: 't-login panel' },
        h('h1', {}, '교사 대시보드'),
        hasBackend()
          ? h('p', { class: 't-note ok' }, '구글 시트에 연결되어 있어요. 시트 settings 탭의 teacherPin으로 들어가요.')
          : h('p', { class: 't-note' }, `아직 구글 시트 주소가 없어요. 이 기기에서 푼 기록만 보여요. (PIN ${LOCAL_PIN}) — 모음 페이지 '선생님 설정'에서 웹 앱 주소를 넣으면 반 전체 기록이 모여요.`),
        cls, pin,
        h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: go }, '들어가기'),
        msg,
      ),
    ),
  );
  cls.focus();
}

// ---------- 본 화면 ----------

function mainView(login, first) {
  let tab = params.get('tab') === 'bank' ? 'bank' : 'status'; // ?tab=bank 로 바로 열기(캡처용)
  let data = first || null;
  const updated = h('span', { class: 'muted' });
  const body = h('main', { class: 't-main' });
  const tabBtns = {};
  const tabs = h('div', { class: 'tabs' });
  [['status', '현황'], ['bank', '문제은행 승인']].forEach(([k, label]) => {
    tabBtns[k] = h('button', { type: 'button', class: 'btn', onclick: () => { tab = k; render(); } }, label);
    tabs.appendChild(tabBtns[k]);
  });
  const publicUrl = `?view=public&class=${encodeURIComponent(login.classCode)}${demoQuery}`;

  clear(app, 
    topBar({
      title: `교사 대시보드 · ${login.classCode}`,
      right: [
        demoBadge(),
        updated,
        h('button', { type: 'button', class: 'btn', onclick: () => load() }, '새로고침'),
        h('a', { class: 'btn btn-soft', href: publicUrl, target: '_blank', rel: 'noopener' }, '학생용 공개 보기'),
        DEMO ? null : h('button', { type: 'button', class: 'btn', onclick: () => { saveLogin(null); clearInterval(timer); loginView(); } }, '나가기'),
      ],
    }),
    body,
  );

  async function load() {
    try {
      await flush();
      const r = await call('dashboard', login);
      if (!r || !r.ok) {
        saveLogin(null);
        clearInterval(timer);
        return loginView(r?.error || 'PIN을 다시 넣어 주세요.');
      }
      data = r;
      updated.textContent = DEMO ? '10월 22일 수업 후 기준'
        : `${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준`;
    } catch (_) {
      updated.textContent = '연결 안 됨 · 다시 시도 중';
    }
    render();
  }

  function render() {
    Object.entries(tabBtns).forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === tab)));
    clear(body).appendChild(tabs);
    if (!data) { body.appendChild(h('p', { class: 'muted' }, '불러오는 중…')); return; }
    if (tab === 'status') renderStatus(body, data);
    else renderBank(body, data, login, load);
  }

  render();
  load();
  clearInterval(timer);
  timer = setInterval(load, REFRESH);
}

function renderStatus(body, d) {
  const t = d.totals || { students: 0, solved: 0, correct: 0 };
  const rate = t.solved ? Math.round((t.correct / t.solved) * 100) : 0;
  put(body, 
    h('div', { class: 'tiles' },
      tile(t.students, '참여한 학생'),
      tile(t.solved, '반 전체 풀이 수'),
      tile(`${rate}%`, '정답률'),
      tile((d.problems || []).length, '만든 문제'),
    ),
    h('section', { class: 't-section' },
      h('h2', {}, '② 분수 놀이터 · 미션 단계별 학생 번호'),
      lanes(PG_STAGES, d.playground || {})),
    h('section', { class: 't-section' },
      h('h2', {}, '④ 분수 비교 챌린지 · 레벨별 학생 번호'),
      lanes(CH_LEVELS, d.challenge || {})),
    h('section', { class: 't-section' },
      h('h2', {}, '오답률 높은 문제 TOP5 (3번 이상 풀린 문제)'),
      hardTable(d.hardest || [])),
  );
}

function tile(v, label) {
  return h('div', { class: 'tile' }, h('b', {}, v), h('span', {}, label));
}

function lanes(defs, groups) {
  return h('div', { class: 'lanes' }, defs.map(([k, name]) => {
    const nos = groups[k] || [];
    return h('div', { class: 'lane' },
      h('h3', {}, name, ' ', h('small', {}, `${nos.length}명`)),
      h('div', { class: 'chips' }, nos.map((n) => h('span', { class: 'chip' }, n))));
  }));
}

function hardTable(rows) {
  if (!rows.length) return h('p', { class: 'muted' }, '아직 자료가 충분하지 않아요.');
  return h('table', { class: 'hard' },
    h('thead', {}, h('tr', {}, h('th', {}, '앱'), h('th', {}, '문제'), h('th', {}, '푼 횟수'), h('th', {}, '오답률'))),
    h('tbody', {}, rows.map((q) => h('tr', {},
      h('td', {}, APP_NAMES[q.app] || q.app),
      h('td', {}, q.question),
      h('td', { class: 'num' }, q.tries),
      h('td', { class: 'num' }, h('span', { class: 'rate', style: { width: `${Math.round(q.rate * 5)}rem` } }), `${Math.round(q.rate * 100)}%`),
    ))));
}

function renderBank(body, d, login, reload) {
  const list = (d.problems || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const waiting = list.filter((p) => !p.approved).length;
  body.appendChild(h('p', { class: 'muted' },
    `모두 ${list.length}문제 · 승인 기다림 ${waiting}문제. 승인한 문제만 학생 문제은행에 나와요.`));
  if (!list.length) {
    body.appendChild(h('p', { class: 'muted' }, '아직 만든 문제가 없어요. 분수 놀이터 출제 모드(?mode=maker)에서 만들어요.'));
    return;
  }
  body.appendChild(h('div', { class: 'bank-list' }, list.map((p) => {
    const btn = h('button', {
      type: 'button',
      class: `btn ${p.approved ? 'btn-primary' : ''}`,
      onclick: async () => {
        btn.disabled = true;
        try {
          const r = await call('approve', { classCode: login.classCode, pin: login.pin, id: p.id, approved: !p.approved });
          if (!r || !r.ok) alert(r?.error || '바꾸지 못했어요');
        } catch (_) {
          alert('시트에 연결할 수 없어요.');
        }
        reload();
      },
    }, p.approved ? '✓ 승인됨 (숨기기)' : '승인하기');
    return h('div', { class: `bank-item ${p.approved ? '' : 'hidden-item'}` },
      h('div', {},
        renderPreview(p),
        h('div', { class: 'bank-meta' }, `출제 ${p.no}번 · 좋아요 ${p.likes || 0} · 댓글 ${(p.comments || []).length}${p.hasPhoto ? ' · 📷 사진' : ''}`),
        (p.comments || []).length
          ? h('ul', { class: 'comments-mini' }, p.comments.slice(-3).map((c) => h('li', {}, c.text)))
          : null),
      h('div', { class: 'bank-actions' }, btn),
    );
  })));
}

// ---------- 학생 화면용 공개 보기 ----------

function publicView(classCode) {
  const main = h('main', { class: 'public' });
  clear(app, topBar({ title: '우리 반 분수 탐험', showStatus: false, right: [demoBadge()] }), main);
  if (!classCode) {
    main.appendChild(h('p', {}, '주소에 학급 코드(&class=…)가 필요해요.'));
    return;
  }
  async function load() {
    let t = null;
    try {
      const r = await call('publicSummary', { classCode });
      t = r && r.totals;
    } catch (_) { /* 다음에 다시 */ }
    clear(main, 
      h('h1', {}, '우리 반이 함께 푼 분수 문제'),
      t ? h('div', { class: 'tiles' },
        tile(t.solved, '모두 푼 문제'),
        tile(t.correct, '맞힌 문제'),
        tile(t.students, '함께한 친구'))
        : h('p', { class: 'muted' }, '불러오는 중…'),
    );
  }
  load();
  setInterval(load, REFRESH);
}
