// 우리 반 문제은행 — 5~6차시
//   승인된 문제를 무작위로 하나씩 풀기(내 문제는 안 나옴)
//   풀면: 정답 여부 → 출제자 힌트 → 좋아요, 한 줄 댓글(40자)
//   ?mode=board : 좋아요 TOP3를 크게(출제자 번호 표시)

import * as F from '../common/fraction.js';
import { call, record, cleanComment } from '../common/api.js';
import { h, clear, topBar, sparkle } from '../common/ui.js';
import { applyMode, isBoard, ensureSession, getSession, cleanClass, params } from '../common/session.js';
import { generateDemoDb, DEMO_CLASS } from '../common/demo.js';
import { renderProblem, answerText, parseSpec, figSvg, photoEl, TYPES } from '../common/problem.js';

applyMode();
const app = document.getElementById('app');
const APP = 'bank';
const LIKED_KEY = 'fx-liked';

if (isBoard()) boardView();
else start();

async function start() {
  const session = await ensureSession({ title: '우리 반 문제은행' });
  const main = h('main', { class: 'bk' });
  const countEl = h('span', { class: 'muted' });
  clear(app, 
    topBar({ title: '우리 반 문제은행', right: [countEl], who: `${session.classCode} · ${session.no}번` }),
    main,
  );

  let problems = [];
  let queue = [];
  let solved = 0;

  async function load() {
    clear(main).appendChild(h('p', { class: 'bk-empty' }, '문제를 불러오는 중…'));
    try {
      const r = await call('listProblems', { classCode: session.classCode });
      // 내 문제는 나오지 않는다
      problems = ((r && r.problems) || []).filter((p) => String(p.no) !== String(session.no));
    } catch (_) {
      problems = [];
      clear(main).appendChild(h('div', { class: 'bk-empty' }, h('b', {}, '문제를 불러오지 못했어요'), '인터넷 연결을 확인하고 다시 눌러요.',
        h('div', {}, h('button', { type: 'button', class: 'btn btn-primary', onclick: load }, '다시 불러오기'))));
      return;
    }
    queue = [];
    next();
  }

  function next() {
    countEl.textContent = `푼 문제 ${solved}`;
    if (!problems.length) {
      clear(main).appendChild(h('div', { class: 'bk-empty' },
        h('b', {}, '아직 풀 수 있는 문제가 없어요'),
        '친구들이 만든 문제를 선생님이 승인하면 여기에 나와요.',
        h('div', { class: 'row center', style: { marginTop: '1rem' } },
          h('button', { type: 'button', class: 'btn', onclick: load }, '다시 불러오기'),
          h('a', { class: 'btn btn-soft', href: '../playground/?mode=maker' }, '나도 문제 만들기'))));
      return;
    }
    // 모든 문제를 한 번씩 다 볼 때까지 겹치지 않게 섞어서 낸다
    if (!queue.length) queue = F.shuffle(problems);
    const p = queue.shift();
    show(p);
  }

  function show(p) {
    const after = h('div', { class: 'bk-after', hidden: true });
    const card = h('section', { class: 'bk-card' },
      h('div', { class: 'bk-meta' }, h('span', { class: 'badge' }, TYPES[p.type]?.name || ''), `${p.no}번 친구가 만든 문제`,
        h('span', { style: { marginLeft: 'auto' } }, `♥ ${p.likes || 0}`)),
      renderProblem(p, {
        onDone: ({ correct, given }) => {
          solved++;
          countEl.textContent = `푼 문제 ${solved}`;
          if (correct) sparkle();
          record('log', {
            classCode: session.classCode, no: session.no, app: APP, mode: p.type, level: '',
            question: `${p.no}번 친구 문제 · ${TYPES[p.type]?.name || p.type} · ${answerText(p)}`,
            answer: given, correct,
          });
          after.hidden = false;
          renderAfter(after, p, correct);
        },
      }),
      after,
    );
    clear(main).appendChild(card);
  }

  // 풀고 난 뒤: 힌트, 좋아요, 댓글, 다음 문제
  function renderAfter(box, p, correct) {
    const liked = likedSet();
    const likeBtn = h('button', {
      type: 'button', class: `btn like ${liked.has(p.id) ? 'liked' : ''}`, disabled: liked.has(p.id),
      onclick: () => {
        record('like', { classCode: session.classCode, no: session.no, bankId: p.id });
        liked.add(p.id);
        saveLiked(liked);
        p.likes = (p.likes || 0) + 1;
        likeBtn.textContent = `♥ 좋아요 ${p.likes}`;
        likeBtn.classList.add('liked');
        likeBtn.disabled = true;
      },
    }, `♥ 좋아요 ${p.likes || 0}`);

    const list = h('ul', { class: 'comments' }, (p.comments || []).slice(-5).map((c) => h('li', {}, c.text)));
    const input = h('input', { class: 'text-input', maxlength: 40, placeholder: '한 줄 댓글 (40자까지)', 'aria-label': '한 줄 댓글' });
    const send = h('button', {
      type: 'button', class: 'btn',
      onclick: () => {
        const text = cleanComment(input.value);
        if (!text) return;
        record('comment', { classCode: session.classCode, no: session.no, bankId: p.id, text });
        (p.comments = p.comments || []).push({ text });
        list.appendChild(h('li', {}, text));
        input.value = '';
        input.disabled = true;
        send.disabled = true;
        send.textContent = '보냈어요';
      },
    }, '보내기');

    clear(box, 
      correct ? null : h('p', { class: 'bk-answer' }, `정답: ${answerText(p)}`),
      p.hint ? h('p', { class: 'bk-hint' }, `💡 ${p.no}번 친구의 힌트: ${p.hint}`) : null,
      h('div', { class: 'bk-actions' }, likeBtn,
        h('button', { type: 'button', class: 'btn btn-primary btn-big', style: { marginLeft: 'auto' }, onclick: next }, '다음 문제 →')),
      h('div', { class: 'comment-row' }, input, send),
      list,
    );
  }

  load();
}

function likedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')); } catch (_) { return new Set(); }
}

function saveLiked(set) {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify([...set])); } catch (_) { /* 무시 */ }
}

// ---------- 칠판 모드: 좋아요 TOP3 ----------

function boardView() {
  // ?demo=1 : 보고서 캡처용 예시(가상) 자료로 TOP3를 보여 준다(시트에는 쓰지 않음)
  const demo = params.get('demo') === '1';
  let classCode = demo ? (cleanClass(params.get('class')) || DEMO_CLASS) : getSession().classCode;
  const demoDb = demo ? generateDemoDb(classCode) : null;
  const main = h('main', { class: 'top3' });
  clear(app, topBar({ title: '우리 반 문제은행 · 인기 문제', showStatus: false, right: demo ? [h('span', { class: 'badge', style: { background: '#fdf3cf', color: '#7a5c00' } }, '예시 자료(가상)')] : [] }), main);

  if (!classCode) {
    const inp = h('input', { class: 'text-input', placeholder: '학급 코드', maxlength: 12 });
    clear(main).appendChild(h('div', { class: 'bk-empty' }, h('b', {}, '학급 코드를 넣어 주세요'),
      h('div', { class: 'row center' }, inp, h('button', {
        type: 'button', class: 'btn btn-primary',
        onclick: () => { classCode = cleanClass(inp.value); if (classCode) { load(); setInterval(load, 30000); } },
      }, '보기'))));
    return;
  }

  async function load() {
    let problems = [];
    try {
      const r = demo
        ? { problems: demoDb.bank.filter((b) => b.approved).map((b) => ({ ...b, comments: demoDb.comments.filter((c) => c.bankId === b.id) })) }
        : await call('listProblems', { classCode });
      problems = (r && r.problems) || [];
    } catch (_) { /* 다음 새로고침 때 다시 */ }
    const top = problems.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
    clear(main).appendChild(h('h2', {}, '♥ 좋아요를 많이 받은 문제 TOP3'));
    if (!top.length) {
      main.appendChild(h('p', { class: 'bk-empty' }, '아직 승인된 문제가 없어요.'));
      return;
    }
    main.appendChild(h('div', { class: 'top3-row' }, top.map((p, i) => h('div', { class: `top-card ${i === 0 ? 'first' : ''}` },
      h('div', { class: 'top-rank' }, ['🥇 1위', '🥈 2위', '🥉 3위'][i]),
      h('div', { class: 'top-visual' }, visualOf(p)),
      h('div', { class: 'top-info' }, `${p.no}번 친구 · `, h('span', { class: 'top-likes' }, `♥ ${p.likes || 0}`)),
    ))));
  }

  load();
  setInterval(load, 30000);
}

function visualOf(p) {
  if (p.photo || p.photoFileId) return photoEl(p);
  const spec = parseSpec(p);
  if (p.type === 'compare') {
    return h('div', { class: 'row center' }, F.fractionEl(spec.a), spec.pictures !== false ? figSvg(spec.figA) : null,
      F.fractionEl(spec.b), spec.pictures !== false ? figSvg(spec.figB) : null);
  }
  return spec.fig ? figSvg(spec.fig) : h('span', {}, '');
}
