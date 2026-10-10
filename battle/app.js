// ⑥ 분수 스피드 배틀 — 전자칠판 2·3·4분할 동시 터치
//   각 칸은 독립된 터치 영역. 칸마다 같은 문제를 동시에 받는다.
//   손가락(pointerId)마다 처음 닿은 칸을 기억하고, 그 칸 안의 버튼만 반응한다.
//   R1 듣고 고르기 / R2 색칠하기 / R3 더 큰 분수 / R4 줄 세우기
//   이 앱은 기록을 서버로 보내지 않는다(게임).

import * as F from '../common/fraction.js';
import { drawShape, shapesFor, getShaded, setShaded, firstN } from '../common/shapes.js';
import { speak } from '../common/speak.js';
import { play } from '../common/sound.js';
import { h, put, clear, sparkle, wait } from '../common/ui.js';

const app = document.getElementById('app');
const MAXD = F.maxDenominator(10);
const TEAM_COLORS = ['#3a7bd5', '#8e5bd6', '#1f9e9e', '#d6548c'];
const ROUNDS = {
  R1: '듣고 고르기',
  R2: '색칠하기',
  R3: '더 큰 분수',
  R4: '줄 세우기',
};
const ROUND_TIME = 90; // 초
const POINTS = [3, 2]; // 1등 3점, 2등 2점, 나머지 정답 1점

const game = {
  split: 4, // 교실 전자칠판 동시 터치 4점 이상 확인(2026-10-10) → 기본 4분할
  names: ['1모둠', '2모둠', '3모둠', '4모둠'],
  scores: [0, 0, 0, 0],
  order: ['R1', 'R2', 'R3', 'R4'],
  roundNo: 0,
};

document.addEventListener('contextmenu', (e) => e.preventDefault());

// 칸 판정: 손가락이 처음 닿은 칸을 pointerId로 기억한다.
// 다른 칸으로 미끄러져 들어가도 처음 칸의 터치로만 처리한다.
const pointerZone = new Map();
document.addEventListener('pointerdown', (e) => {
  const z = e.target.closest && e.target.closest('.zone');
  pointerZone.set(e.pointerId, z ? Number(z.dataset.zone) : -1);
}, true);
const forget = (e) => setTimeout(() => pointerZone.delete(e.pointerId), 0);
document.addEventListener('pointerup', forget, true);
document.addEventListener('pointercancel', forget, true);

// 손가락마다 따로 '누름 → 같은 자리에서 뗌'을 탭으로 본다(여러 명이 동시에 눌러도 됨).
function onTap(el, fn) {
  const downs = new Map();
  el.addEventListener('pointerdown', (e) => {
    downs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.classList.add('pressed');
  });
  el.addEventListener('pointerup', (e) => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (!downs.size) el.classList.remove('pressed');
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 40) return;
    const zoneEl = el.closest('.zone');
    if (zoneEl && pointerZone.get(e.pointerId) !== Number(zoneEl.dataset.zone)) return;
    fn(e);
  });
  el.addEventListener('pointercancel', (e) => {
    downs.delete(e.pointerId);
    if (!downs.size) el.classList.remove('pressed');
  });
  return el;
}

setupScreen();

// ================= 시작 화면 =================

function setupScreen() {
  const splitBtns = [2, 3, 4].map((n) => h('button', {
    type: 'button', class: 'btn btn-big',
    onclick: () => { game.split = n; render(); },
  }, `${n}칸`));
  const inputs = game.names.map((name, i) => h('input', {
    class: 'text-input', value: name, maxlength: 8, style: { '--team': TEAM_COLORS[i] }, 'aria-label': `${i + 1}번 칸 모둠 이름`,
  }));
  const roundBtns = Object.keys(ROUNDS).map((k) => h('button', {
    type: 'button', class: 'btn',
    onclick: () => {
      game.order = game.order.includes(k) ? game.order.filter((x) => x !== k) : [...game.order, k].sort();
      if (!game.order.length) game.order = [k];
      render();
    },
  }, `${k} ${ROUNDS[k]}`));

  function render() {
    splitBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 2 === game.split)));
    inputs.forEach((inp, i) => { inp.disabled = i >= game.split; });
    roundBtns.forEach((b) => b.setAttribute('aria-pressed', String(game.order.includes(b.textContent.slice(0, 2)))));
  }

  clear(app, h('main', { class: 'b-setup' },
    h('h1', {}, '⚡ 분수 스피드 배틀'),
    h('div', { class: 'label' }, '몇 칸으로 나눌까요?'),
    h('div', { class: 'row' }, splitBtns),
    h('div', { class: 'label' }, '모둠 이름'),
    h('div', { class: 'team-inputs' }, inputs),
    h('div', { class: 'label' }, '라운드 (차례대로 돌아가며 나와요)'),
    h('div', { class: 'row round-pick' }, roundBtns),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '../index.html' }, '⌂ 처음으로'),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-big',
        onclick: () => {
          game.names = inputs.map((inp, i) => inp.value.trim() || `${i + 1}모둠`);
          game.scores = [0, 0, 0, 0];
          game.roundNo = 0;
          playScreen();
        },
      }, '게임 시작!'),
    ),
  ));
  render();
}

// ================= 게임 화면 =================

let timerId = null;

function playScreen() {
  const scoreEls = [];
  const scores = h('div', { class: 'row', style: { gap: '0.4rem', flexWrap: 'nowrap', minWidth: 0 } });
  for (let i = 0; i < game.split; i++) {
    const b = h('b', {}, game.scores[i]);
    scoreEls.push(b);
    scores.appendChild(h('div', { class: 'score', style: { '--team': TEAM_COLORS[i] } }, game.names[i], b));
  }
  const roundLabel = h('span', {});
  const timerEl = h('span', { class: 'timer' });
  const endBtn = h('button', { type: 'button', class: 'btn', onclick: () => endRound() }, '라운드 끝');
  const arena = h('main', { class: 'arena' });
  const cols = game.split === 4 ? 2 : game.split;
  const rows = game.split === 4 ? 2 : 1;
  arena.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  arena.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;

  clear(app, 
    h('header', { class: 'scoreboard' }, scores,
      h('div', { class: 'round-info' }, roundLabel, '⏱', timerEl, endBtn,
        h('button', { type: 'button', class: 'btn', onclick: () => { if (confirm('게임을 끝낼까요?')) finalScreen(); } }, '게임 끝'))),
    arena,
  );

  const refreshScores = () => scoreEls.forEach((b, i) => { b.textContent = game.scores[i]; });

  let round = null;

  function startRound() {
    game.roundNo++;
    const type = game.order[(game.roundNo - 1) % game.order.length];
    const problem = makeProblem(type);
    roundLabel.textContent = `${game.roundNo}라운드 ${ROUNDS[type]}`;
    round = { type, problem, finished: [], ended: false, startAt: 0 };

    clear(arena);
    const zones = [];
    for (let i = 0; i < game.split; i++) {
      const z = buildZone(i, type, problem, round);
      zones.push(z);
      arena.appendChild(z.el);
    }
    round.zones = zones;

    // 3·2·1 뒤에 시작
    countdown(`${game.roundNo}라운드 · ${ROUNDS[type]}`).then(() => {
      round.startAt = performance.now();
      zones.forEach((z) => z.el.classList.remove('locked'));
      if (type === 'R1') speak(F.read(problem.f));
      let left = ROUND_TIME;
      timerEl.textContent = left;
      clearInterval(timerId);
      timerId = setInterval(() => {
        left--;
        timerEl.textContent = left;
        if (left <= 5 && left > 0) play('tick');
        if (left <= 0) endRound();
      }, 1000);
    });
  }

  // 칸에서 정답을 맞혔을 때
  function zoneCorrect(i) {
    if (!round || round.ended || round.finished.includes(i)) return;
    const place = round.finished.length + 1;
    round.finished.push(i);
    const pts = POINTS[place - 1] ?? 1;
    game.scores[i] += pts;
    refreshScores();
    const z = round.zones[i];
    z.done.innerHTML = '';
    z.done.append(`${place}등!`, h('small', {}, `+${pts}점 · ${((performance.now() - round.startAt) / 1000).toFixed(1)}초`));
    z.el.classList.add('done');
    const r = z.el.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2);
    play('correct');
    if (round.finished.length === game.split) setTimeout(endRound, 900);
  }

  // 오답: 그 칸만 2초 흔들리고 다시 시도
  function zoneWrong(i) {
    const z = round.zones[i];
    if (z.el.classList.contains('wrong')) return;
    play('retry');
    z.el.classList.add('wrong', 'locked');
    setTimeout(() => {
      z.el.classList.remove('wrong');
      if (!round.ended) z.el.classList.remove('locked');
    }, 2000);
  }

  function endRound() {
    if (!round || round.ended) return;
    round.ended = true;
    clearInterval(timerId);
    round.zones.forEach((z) => z.el.classList.add('locked'));
    play('win');
    resultOverlay(round, refreshScores, startRound);
  }

  function buildZone(i, type, problem, rnd) {
    const done = h('div', { class: 'zone-done' });
    const tools = h('div', { class: 'zone-tools' });
    const body = h('div', { class: 'zone-body' });
    const el = h('section', {
      class: 'zone locked', dataset: { zone: i }, style: { '--team': TEAM_COLORS[i] }, 'aria-label': game.names[i],
    }, h('header', { class: 'zone-head' }, game.names[i], tools), body, done);
    const ctx = {
      i, body, tools,
      correct: () => zoneCorrect(i),
      wrong: () => zoneWrong(i),
      isDone: () => rnd.finished.includes(i),
    };
    ROUND_VIEWS[type](ctx, problem);
    return { el, done };
  }

  startRound();
}

// ================= 라운드 문제 =================

function makeProblem(type) {
  if (type === 'R1') {
    const f = F.randomFraction({ maxD: MAXD });
    // 좁은 칸 4개에 들어가므로 띠 대신 원·사각형만 쓴다
    const shape = F.pick(['circle', 'square', 'rect']);
    return { f, shape, options: distractors(f) };
  }
  if (type === 'R2') {
    const f = F.randomFraction({ maxD: MAXD });
    const shapes = F.shuffle(shapesFor(f.d));
    return { f, shapes };
  }
  if (type === 'R3') {
    if (Math.random() < 0.5) {
      const d = F.randInt(3, MAXD);
      const [a, b] = F.shuffle(F.range(1, d - 1)).slice(0, 2);
      return { pair: [{ n: a, d }, { n: b, d }] };
    }
    const [da, db] = F.shuffle(F.range(2, MAXD)).slice(0, 2);
    return { pair: [{ n: 1, d: da }, { n: 1, d: db }] };
  }
  // R4: 분모가 같은 세 분수 또는 단위분수 세 개
  if (Math.random() < 0.5 || MAXD < 4) {
    const d = F.randInt(4, Math.max(4, MAXD));
    const ns = F.shuffle(F.range(1, d - 1)).slice(0, 3);
    return { cards: ns.map((n) => ({ n, d })) };
  }
  const ds = F.shuffle(F.range(2, MAXD)).slice(0, 3);
  return { cards: ds.map((d) => ({ n: 1, d })) };
}

// 들은 분수와 헷갈릴 만한 그림 3개
function distractors(f) {
  const cands = [
    { n: f.d - f.n, d: f.d },
    { n: f.n + 1, d: f.d },
    { n: f.n - 1, d: f.d },
    { n: f.n, d: f.d + 1 },
    { n: f.n, d: f.d - 1 },
    { n: f.n, d: f.d + 2 },
  ].filter((x) => x.n >= 1 && x.n < x.d && x.d >= 2 && x.d <= MAXD && !F.same(x, f));
  const out = [];
  for (const c of F.shuffle(cands)) {
    if (!out.some((o) => F.same(o, c))) out.push(c);
    if (out.length === 3) break;
  }
  while (out.length < 3) {
    const r = F.randomFraction({ maxD: MAXD });
    if (!F.same(r, f) && !out.some((o) => F.same(o, r))) out.push(r);
  }
  return [f, ...out];
}

const ROUND_VIEWS = {
  // R1 듣고 고르기: 음성 → 그림 4개 중 터치. 다시 듣기 버튼은 칸마다.
  R1(ctx, p) {
    ctx.tools.appendChild(onTap(h('button', { type: 'button', class: 'btn' }, '🔈 다시 듣기'), () => speak(F.read(p.f))));
    const opts = h('div', { class: 'options' });
    for (const f of F.shuffle(p.options)) {
      const o = h('div', { class: 'opt', role: 'button', 'aria-label': '그림' },
        drawShape(p.shape, f.d, firstN(f.n), { layout: 'strips', tight: true }));
      onTap(o, () => (F.same(f, p.f) ? ctx.correct() : ctx.wrong()));
      opts.appendChild(o);
    }
    put(ctx.body, h('div', { class: 'z-prompt' }, '🔈 잘 듣고 알맞은 그림을 골라요'), opts);
  },

  // R2 색칠하기: 같은 분수를 칸마다 다른 모양으로
  R2(ctx, p) {
    const shape = p.shapes[ctx.i % p.shapes.length];
    const svg = drawShape(shape, p.f.d, [], { interactive: true });
    const done = onTap(h('button', { type: 'button', class: 'btn btn-primary' }, '완료'), () => {
      if (getShaded(svg).length === p.f.n) ctx.correct();
      else ctx.wrong();
    });
    const reset = onTap(h('button', { type: 'button', class: 'btn' }, '지우기'), () => setShaded(svg, []));
    put(ctx.body, 
      h('div', { class: 'z-prompt' }, F.fractionEl(p.f), '만큼 색칠해요'),
      h('div', { class: 'paint-wrap' }, svg),
      h('div', { class: 'z-actions' }, reset, done),
    );
  },

  // R3 더 큰 분수: 두 분수 중 큰 쪽 터치
  R3(ctx, p) {
    const opts = h('div', { class: 'options two' });
    for (const f of F.shuffle(p.pair)) {
      const other = p.pair.find((x) => x !== f);
      const o = h('div', { class: 'opt', role: 'button', 'aria-label': F.read(f) }, F.fractionEl(f));
      onTap(o, () => (F.compare(f, other) > 0 ? ctx.correct() : ctx.wrong()));
      opts.appendChild(o);
    }
    put(ctx.body, h('div', { class: 'z-prompt' }, '더 큰 분수를 눌러요'), opts);
  },

  // R4 줄 세우기: 카드 3장을 끌어서 작은 것부터
  R4(ctx, p) {
    let order = F.shuffle(p.cards);
    // 처음부터 정답 순서면 다시 섞는다
    while (isAscending(order)) order = F.shuffle(p.cards);
    const line = h('div', { class: 'lineup' });

    function render() {
      clear(line);
      order.forEach((f, idx) => line.appendChild(dragCard(f, idx)));
    }

    function dragCard(f, idx) {
      const card = h('div', { class: 'l-card', 'aria-label': F.read(f) }, F.fractionEl(f));
      let start = null;
      card.addEventListener('pointerdown', (e) => {
        if (start) return; // 한 카드는 한 손가락만
        e.preventDefault();
        start = { id: e.pointerId, x: e.clientX };
        try { card.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
        card.classList.add('dragging');
      });
      card.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        card.style.transform = `translateX(${e.clientX - start.x}px)`;
      });
      const drop = (e) => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x;
        start = null;
        card.classList.remove('dragging');
        card.style.transform = '';
        const w = line.getBoundingClientRect().width / 3;
        const to = Math.max(0, Math.min(2, idx + Math.round(dx / w)));
        if (to !== idx) {
          const next = order.slice();
          const [moved] = next.splice(idx, 1);
          next.splice(to, 0, moved);
          order = next;
          play('tap');
          render();
        }
      };
      card.addEventListener('pointerup', drop);
      card.addEventListener('pointercancel', drop);
      return card;
    }

    const done = onTap(h('button', { type: 'button', class: 'btn btn-primary' }, '완료'), () => {
      if (isAscending(order)) ctx.correct();
      else ctx.wrong();
    });
    render();
    put(ctx.body, 
      h('div', { class: 'z-prompt' }, '작은 분수부터 줄을 세워요'),
      h('div', { class: 'lineup-hint' }, h('span', {}, '← 작다'), h('span', {}, '크다 →')),
      line,
      h('div', { class: 'z-actions' }, done),
    );
  },
};

function isAscending(arr) {
  return arr.every((f, i) => i === 0 || F.compare(arr[i - 1], f) < 0);
}

// ================= 덮개 화면 =================

function countdown(title) {
  return new Promise((resolve) => {
    const count = h('div', { class: 'count' }, '3');
    const ov = h('div', { class: 'b-overlay' }, h('div', { class: 'b-card' }, h('h2', {}, title), count));
    document.body.appendChild(ov);
    let n = 3;
    play('tick');
    const t = setInterval(() => {
      n--;
      if (n > 0) { count.textContent = n; play('tick'); return; }
      clearInterval(t);
      count.textContent = '시작!';
      setTimeout(() => { ov.remove(); resolve(); }, 400);
    }, 700);
  });
}

function resultOverlay(round, refreshScores, next) {
  const rows = [];
  for (let i = 0; i < game.split; i++) {
    const place = round.finished.indexOf(i) + 1;
    const pts = h('span', { class: 'pts' }, `${game.scores[i]}점`);
    const bonus = h('button', {
      type: 'button', class: 'btn btn-soft',
      onclick: () => {
        game.scores[i] += 1;
        pts.textContent = `${game.scores[i]}점`;
        bonus.textContent = '설명 보너스 +1 ✓';
        refreshScores();
        play('tap');
      },
    }, '설명 보너스 +1');
    rows.push({ place: place || 99, el: h('div', { class: 'result-row', style: { '--team': TEAM_COLORS[i] } },
      h('span', { class: 'place' }, place ? `${place}등` : '—'),
      h('span', { class: 'name' }, game.names[i]), pts, bonus) });
  }
  rows.sort((a, b) => a.place - b.place);
  const ov = h('div', { class: 'b-overlay' }, h('div', { class: 'b-card' },
    h('h2', {}, `${game.roundNo}라운드 결과`),
    h('p', { class: 'muted', style: { margin: 0 } }, '어떻게 풀었는지 설명한 모둠에 보너스를 주세요'),
    h('div', { class: 'results' }, rows.map((r) => r.el)),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => { ov.remove(); finalScreen(); } }, '게임 끝'),
      h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: () => { ov.remove(); next(); } }, '다음 라운드 ▶')),
  ));
  document.body.appendChild(ov);
}

async function finalScreen() {
  clearInterval(timerId);
  document.querySelectorAll('.b-overlay').forEach((o) => o.remove());
  const max = Math.max(...game.scores.slice(0, game.split));
  const rows = game.names.slice(0, game.split).map((name, i) => ({ name, i, s: game.scores[i] }))
    .sort((a, b) => b.s - a.s);
  clear(app, h('main', { class: 'b-setup' },
    h('h1', {}, '🏆 모두 수고했어요!'),
    h('div', { class: 'results', style: { width: 'min(30rem, 90vw)' } }, rows.map((r) => h('div', {
      class: 'result-row', style: { '--team': TEAM_COLORS[r.i] },
    }, h('span', { class: 'place' }, r.s === max ? '👑' : ''), h('span', { class: 'name' }, r.name), h('span', { class: 'pts' }, `${r.s}점`)))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: setupScreen }, '새 게임')),
  ));
  play('win');
  await wait(100);
  sparkle();
}
