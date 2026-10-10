// ② 분수 놀이터
//   기본       : 처음 화면 → 자유 탐색 / 미션(1~3단계 → 도전)
//   ?mode=board: 칠판 모드(자유 탐색 + 분수 카드 뽑기) — 1~2차시 전자칠판 릴레이
//   ?mode=maker: 출제 모드(maker.js)

import * as F from '../common/fraction.js';
import {
  SHAPES, drawShape, shapeAllows, shapeName, getShaded, setShaded, showNumbers, randomPieces, firstN,
} from '../common/shapes.js';
import { speak } from '../common/speak.js';
import { play } from '../common/sound.js';
import { record } from '../common/api.js';
import { h, put, clear, feedback, fracInput, topBar, sparkle, wait } from '../common/ui.js';
import { applyMode, mode, ensureSession } from '../common/session.js';

applyMode();
const MAXD = F.maxDenominator();
const app = document.getElementById('app');
const APP = 'playground';

const BASIC_SHAPES = ['circle', 'square', 'rect', 'bar'];
const ALL_SHAPES = SHAPES.map((s) => s.type);
const STAGE_NAMES = { 1: '1단계 보고 쓰기', 2: '2단계 읽고 색칠하기', 3: '3단계 같은 분수, 다른 모양', 4: '도전 모드' };

let session = null;

start();

async function start() {
  const m = mode();
  if (m === 'board') return boardScreen();
  if (m === 'maker') {
    session = await ensureSession({ title: '분수 놀이터 · 출제' });
    const { startMaker } = await import('./maker.js');
    return startMaker(app, session);
  }
  session = await ensureSession({ title: '분수 놀이터' });
  homeScreen();
}

// ================= 처음 화면 =================

function homeScreen() {
  const st = loadMission();
  const icon = (type, d, sh) => {
    const s = drawShape(type, d, sh, { layout: 'strips' });
    s.classList.add('icon');
    return s;
  };
  clear(app, 
    topBar({ title: '분수 놀이터', right: [h('span', { class: 'badge' }, `${session.classCode} · ${session.no}번`)] }),
    h('main', { class: 'pg-home' },
      h('h2', {}, '무엇을 해 볼까요?'),
      h('div', { class: 'pg-choices' },
        h('button', { type: 'button', class: 'pg-choice', onclick: exploreScreen },
          icon('circle', 4, [0, 1, 2]), '자유 탐색', h('small', {}, '모양을 나누고 색칠해 봐요')),
        h('button', { type: 'button', class: 'pg-choice', onclick: missionScreen },
          icon('bar', 3, [0]), '미션', h('small', {}, STAGE_NAMES[st.stage])),
      ),
    ),
  );
}

// ================= 자유 탐색 =================

// 모양 버튼 + 분모 슬라이더 + 터치 색칠 + 실시간 분수 표시
function explorer({ onShade } = {}) {
  let type = 'circle';
  let d = Math.min(4, MAXD);
  let svg = null;

  const stage = h('div', { class: 'stage' });
  const fracSlot = h('div');
  const readEl = h('p', { class: 'live-read' });
  const subEl = h('p', { class: 'live-sub' });
  const live = h('div', { class: 'live', 'aria-live': 'polite' }, fracSlot, h('div', {}, readEl, subEl));

  const shapeBtns = h('div', { class: 'shape-btns', role: 'group', 'aria-label': '모양' });
  const btnOf = {};
  for (const t of ALL_SHAPES) {
    const b = h('button', {
      type: 'button', class: 'btn',
      onclick: () => { play('tap'); type = t; render(); },
    }, drawShape(t, t === 'hexagon' ? 6 : 2, [], { layout: 'strips' }), shapeName(t));
    btnOf[t] = b;
    shapeBtns.appendChild(b);
  }

  const dVal = h('span', { class: 'd-val' });
  const slider = h('input', { type: 'range', min: F.MIN_D, max: MAXD, step: 1, value: d, 'aria-label': '몇 조각으로 나눌까요' });
  slider.addEventListener('input', () => { d = Number(slider.value); render(); });
  const step = (k) => h('button', {
    type: 'button', class: 'btn btn-icon',
    onclick: () => { d = Math.min(MAXD, Math.max(F.MIN_D, d + k)); render(); },
  }, k > 0 ? '+' : '−');
  const dRow = h('div', { class: 'd-row' }, step(-1), slider, step(1), dVal);

  function render() {
    // 정육각형은 2·3·6에서만 보인다(나머지는 선택지에서 숨김)
    if (!shapeAllows(type, d)) type = 'circle';
    for (const t of ALL_SHAPES) {
      btnOf[t].hidden = !shapeAllows(t, d);
      btnOf[t].setAttribute('aria-pressed', String(t === type));
    }
    slider.value = d;
    dVal.textContent = `${d}조각`;
    svg = drawShape(type, d, [], { interactive: true, onChange: update, label: `${shapeName(type)}을 ${d}조각으로 나눈 그림` });
    clear(stage).appendChild(svg);
    update([]);
  }

  function update(sh) {
    const n = sh.length;
    clear(fracSlot).appendChild(F.fractionEl({ n: n || '', d }));
    readEl.textContent = n ? F.read({ n, d }) : `${d}조각으로 나눴어요`;
    subEl.textContent = n === 0 ? '조각을 눌러 색칠해 보세요'
      : n === d ? '전체를 모두 색칠했어요'
        : `전체 ${d}조각 중 ${n}조각`;
    onShade && onShade(n, d);
  }

  function readAloud() {
    const n = svg ? getShaded(svg).length : 0;
    speak(n ? F.read({ n, d }) : `${d}조각으로 똑같이 나누었어요`);
  }

  render();
  return {
    stage, live, shapeBtns, dRow, readAloud,
    get count() { return svg ? getShaded(svg).length : 0; },
    get d() { return d; },
    get svg() { return svg; },
    set(t, nd) { type = t; d = nd; render(); },
    clearShade() { setShaded(svg, []); update([]); },
  };
}

function exploreScreen() {
  const ex = explorer();
  clear(app, 
    topBar({ title: '자유 탐색', back: homeScreen }),
    h('main', { class: 'explore' },
      ex.stage,
      h('div', { class: 'side' },
        ex.live,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: ex.readAloud }, '🔈 읽어 주기'),
          h('button', { type: 'button', class: 'btn', onclick: ex.clearShade }, '모두 지우기'),
        ),
        h('div', { class: 'muted' }, '모양'),
        ex.shapeBtns,
        h('div', { class: 'muted' }, '몇 조각으로 나눌까요?'),
        ex.dRow,
      ),
    ),
  );
}

// ================= 칠판 모드 =================

function boardScreen() {
  const ex = explorer();
  let card = null;
  const nextCard = F.noRepeat(() => F.randomFraction({ maxD: MAXD }));
  const cardBox = h('div', { class: 'card-draw empty' }, '카드를 뽑아 보세요');

  function draw() {
    card = nextCard();
    const t = F.pick(ALL_SHAPES.filter((s) => shapeAllows(s, card.d)));
    ex.set(t, card.d);
    clear(cardBox, F.fractionEl(card), h('span', { class: 'card-text' }, `${F.read(card)}만큼 색칠해요`));
    cardBox.classList.remove('empty');
    play('tick');
    speak(`${F.read(card)}만큼 색칠하세요`);
  }

  async function check() {
    if (!card) return feedback('info', '먼저 카드를 뽑아요', 900);
    if (ex.d !== card.d) return feedback('retry', '몇 조각으로 나눴는지 볼까?');
    if (ex.count === card.n) {
      sparkle();
      await feedback('correct', `${F.read(card)} 정답!`);
    } else {
      showNumbers(ex.svg, true);
      await feedback('retry');
    }
  }

  clear(app, 
    topBar({ title: '분수 놀이터 · 칠판', home: '../index.html', showStatus: false }),
    h('main', { class: 'explore' },
      ex.stage,
      h('div', { class: 'side' },
        cardBox,
        h('div', { class: 'board-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: draw }, '🃏 분수 카드 뽑기'),
          h('button', { type: 'button', class: 'btn btn-soft', onclick: check }, '확인'),
        ),
        ex.live,
        h('div', { class: 'board-actions' },
          h('button', { type: 'button', class: 'btn', onclick: ex.readAloud }, '🔈 읽기'),
          h('button', { type: 'button', class: 'btn', onclick: () => { ex.clearShade(); showNumbers(ex.svg, false); } }, '지우기'),
        ),
        ex.shapeBtns,
        ex.dRow,
      ),
    ),
  );
}

// ================= 미션 =================

function missionKey() {
  return `fx-pg-${session.classCode}-${session.no}`;
}

function loadMission() {
  try {
    const s = JSON.parse(localStorage.getItem(missionKey()) || 'null');
    if (s && s.stage) return s;
  } catch (_) { /* 무시 */ }
  return { stage: 1, streak: 0, solved: 0 };
}

function saveMission(st) {
  try { localStorage.setItem(missionKey(), JSON.stringify(st)); } catch (_) { /* 무시 */ }
}

function sendProgress(st) {
  record('progress', {
    classCode: session.classCode, no: session.no, app: APP,
    stage: st.stage, solved: st.solved, correctStreak: st.streak,
  });
}

// 문제 만들기 (직전과 같은 문제는 안 나옴)
const gen = {
  1: F.noRepeat((challenge) => {
    const f = F.randomFraction({ maxD: challenge ? MAXD : Math.min(6, MAXD) });
    const type = F.pick((challenge ? ALL_SHAPES : BASIC_SHAPES).filter((t) => shapeAllows(t, f.d)));
    return { kind: 1, f, type, shaded: randomPieces(f.d, f.n) };
  }, (p) => `${F.key(p.f)}${p.type}`),
  2: F.noRepeat((challenge) => {
    const f = F.randomFraction({ maxD: MAXD, whole: Math.random() < 0.1 });
    const type = F.pick((challenge ? ALL_SHAPES : BASIC_SHAPES).filter((t) => shapeAllows(t, f.d)));
    return { kind: 2, f, type };
  }, (p) => F.key(p.f)),
  3: F.noRepeat((challenge) => {
    if (challenge) {
      const f = F.randomFraction({ maxD: MAXD });
      const types = F.shuffle(ALL_SHAPES.filter((t) => shapeAllows(t, f.d))).slice(0, 3);
      return { kind: 3, f, types };
    }
    const f = F.randomFraction({ maxD: Math.min(10, MAXD) });
    return { kind: 3, f, types: ['circle', 'bar', 'square'] };
  }, (p) => F.key(p.f)),
};

function makeProblem(stage) {
  if (stage < 4) return gen[stage](false);
  return gen[F.pick([1, 2, 3])](true);
}

function missionScreen() {
  const st = loadMission();
  const badge = h('span', { class: 'badge' });
  const streakEl = h('span', { class: 'streak', 'aria-label': '연속 정답' });
  const solvedEl = h('span', { class: 'muted' });
  const body = h('main', { class: 'mission' });

  function renderHead() {
    badge.textContent = STAGE_NAMES[st.stage];
    clear(streakEl);
    const lit = st.stage < 4 ? Math.min(st.streak, 3) : st.streak % 3;
    for (let i = 0; i < 3; i++) streakEl.appendChild(h('i', { class: i < lit ? 'on' : '' }));
    solvedEl.textContent = `푼 문제 ${st.solved}`;
  }

  clear(app, 
    topBar({ title: '미션', back: homeScreen, right: [badge, streakEl, solvedEl] }),
    body,
  );

  let problem = null;
  let wrong = 0;

  function next() {
    problem = makeProblem(st.stage);
    wrong = 0;
    renderHead();
    clear(body);
    const view = problem.kind === 1 ? viewWrite(problem, answer)
      : problem.kind === 2 ? viewPaint(problem, answer)
        : viewSame(problem, answer);
    put(body, view);
  }

  // view가 학생 답을 확인한 뒤 부른다. → 기록, 힌트/정답 보여 주기, 다음 문제
  async function answer({ correct, given, view }) {
    st.solved++;
    record('log', {
      classCode: session.classCode, no: session.no, app: APP, mode: 'mission', level: st.stage,
      question: `${STAGE_NAMES[problem.kind]}: ${F.read(problem.f)}`,
      answer: given, correct,
    });

    if (correct) {
      st.streak++;
      view.lock();
      sparkle();
      await feedback('correct');
      if (st.stage < 4 && st.streak >= 3) {
        st.stage++;
        st.streak = 0;
        record('log', {
          classCode: session.classCode, no: session.no, app: APP, mode: 'stage', level: st.stage,
          question: '단계 변경', answer: STAGE_NAMES[st.stage], correct: true,
        });
        await feedback('level', st.stage === 4 ? '미션 완료! 도전 모드' : `${st.stage}단계로!`, 1500);
      }
      saveMission(st);
      sendProgress(st);
      next();
      return;
    }

    st.streak = 0;
    wrong++;
    saveMission(st);
    sendProgress(st);
    if (wrong === 1) {
      view.hint(); // 조각에 번호 1, 2, 3…
      renderHead();
      await feedback('retry', '다시 해 볼까? 번호를 세어 봐요', 1400);
      return;
    }
    // 같은 문제 2번 틀리면 정답을 보여 주고 다음 문제로
    view.lock();
    view.reveal();
    renderHead();
    await feedback('info', '정답을 같이 볼까요?', 1000);
    await wait(2200);
    next();
  }

  next();
}

// ---------- 1단계: 보고 쓰기 ----------
function viewWrite(p, done) {
  const svg = drawShape(p.type, p.f.d, p.shaded, { label: '색칠한 그림' });
  const fi = fracInput();
  const note = h('p', { class: 'answer-note' });
  let locked = false;

  const ok = h('button', {
    type: 'button', class: 'btn btn-primary btn-big',
    onclick: () => {
      if (locked) return;
      const given = fi.value();
      if (!given) return feedback('info', '분모와 분자를 모두 써요', 900);
      done({ correct: F.same(given, p.f), given: F.read(given), view });
    },
  }, '확인');

  const view = h('div', { class: 'mission-body' },
    h('div', { class: 'stage' }, svg),
    h('div', { class: 'write-side' },
      h('p', { class: 'prompt-text' }, '색칠한 부분을 분수로 써 보세요'),
      fi.el, fi.pad, ok, note,
    ),
  );
  view.lock = () => { locked = true; fi.lock(); };
  view.hint = () => showNumbers(svg, true);
  view.reveal = () => {
    fi.reveal(p.f);
    showNumbers(svg, true);
    note.textContent = `전체 ${p.f.d}조각 중 ${p.f.n}조각 → ${F.read(p.f)}`;
  };
  return view;
}

// ---------- 2단계: 읽고 색칠하기 ----------
function viewPaint(p, done) {
  const svg = drawShape(p.type, p.f.d, [], { interactive: true, label: `${shapeName(p.type)} ${p.f.d}조각` });
  const text = `${F.read(p.f)}만큼 색칠하세요`;
  const note = h('p', { class: 'answer-note' });
  setTimeout(() => speak(text), 300);

  const view = h('div', { class: 'mission-body' },
    h('div', { class: 'stage' }, svg),
    h('div', { class: 'write-side' },
      h('div', { class: 'row' }, F.fractionEl(p.f, 'big'), h('p', { class: 'prompt-text' }, text)),
      h('button', { type: 'button', class: 'btn btn-soft', onclick: () => speak(text) }, '🔈 읽어 주기'),
      h('button', { type: 'button', class: 'btn', onclick: () => setShaded(svg, []) }, '모두 지우기'),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-big',
        onclick: () => {
          if (svg.classList.contains('locked')) return;
          const n = getShaded(svg).length;
          if (!n) return feedback('info', '조각을 눌러 색칠해요', 900);
          done({ correct: n === p.f.n, given: `${n}조각 색칠`, view });
        },
      }, '확인'),
      note,
    ),
  );
  view.lock = () => svg.classList.add('locked');
  view.hint = () => showNumbers(svg, true);
  view.reveal = () => {
    setShaded(svg, firstN(p.f.n));
    showNumbers(svg, true);
    note.textContent = `${p.f.d}조각 중 ${p.f.n}조각을 색칠해요`;
  };
  return view;
}

// ---------- 3단계: 같은 분수, 다른 모양 ----------
function viewSame(p, done) {
  const text = `세 모양 모두 ${F.read(p.f)}만큼 색칠하세요`;
  const panels = p.types.map((t) => {
    const svg = drawShape(t, p.f.d, [], { interactive: true, label: shapeName(t) });
    const el = h('div', { class: 'panel3' }, h('div', { class: 'panel3-name' }, shapeName(t)), h('div', { class: 'stage' }, svg));
    return { t, svg, el };
  });
  setTimeout(() => speak(text), 300);

  const wrap = h('div', { class: 'mission', style: { padding: 0 } },
    h('div', { class: 'mission-head' },
      F.fractionEl(p.f, 'big'),
      h('p', { class: 'prompt-text' }, text),
      h('button', { type: 'button', class: 'btn btn-soft', onclick: () => speak(text) }, '🔈'),
    ),
    h('div', { class: 'mission-body three' }, panels.map((x) => x.el)),
    h('div', { class: 'mission-foot' },
      h('button', { type: 'button', class: 'btn', onclick: () => panels.forEach((x) => setShaded(x.svg, [])) }, '모두 지우기'),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-big',
        onclick: () => {
          if (panels[0].svg.classList.contains('locked')) return;
          const counts = panels.map((x) => getShaded(x.svg).length);
          if (counts.every((c) => c === 0)) return feedback('info', '조각을 눌러 색칠해요', 900);
          panels.forEach((x, i) => {
            x.el.classList.toggle('good', counts[i] === p.f.n);
            x.el.classList.toggle('again', counts[i] !== p.f.n);
          });
          done({ correct: counts.every((c) => c === p.f.n), given: counts.join(','), view: wrap });
        },
      }, '확인'),
    ),
  );
  wrap.lock = () => panels.forEach((x) => x.svg.classList.add('locked'));
  wrap.hint = () => panels.forEach((x) => { if (getShaded(x.svg).length !== p.f.n) showNumbers(x.svg, true); });
  wrap.reveal = () => panels.forEach((x) => {
    setShaded(x.svg, firstN(p.f.n));
    showNumbers(x.svg, true);
    x.el.classList.remove('again');
    x.el.classList.add('good');
  });
  return wrap;
}
