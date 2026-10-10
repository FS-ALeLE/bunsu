// ④ 분수 비교 챌린지 (4레벨 적응형)
//   Lv1 그림 있는, 분모가 같은 분수
//   Lv2 그림 없이, 분모가 같은 분수
//   Lv3 단위분수
//   Lv4 두 유형 섞기 + 이유 고르기(이유는 기록만, 정답 판정은 크기 비교로)
// 3연속 정답 → 레벨업. 레벨은 내려가지 않는다. 같은 유형 2회 오답 → 띠 모형 힌트.

import * as F from '../common/fraction.js';
import { drawShape, firstN } from '../common/shapes.js';
import { speak } from '../common/speak.js';
import { record } from '../common/api.js';
import { h, clear, feedback, topBar, sparkle, wait } from '../common/ui.js';
import { applyMode, ensureSession } from '../common/session.js';

applyMode();
const MAXD = F.maxDenominator();
const APP = 'challenge';
const app = document.getElementById('app');

const LEVELS = {
  1: '그림으로 비교',
  2: '분모가 같은 분수',
  3: '단위분수',
  4: '섞어서 + 이유',
};
const REASONS = [
  '분모가 같고 분자가 커서',
  '분자가 1이고 분모가 작아서 한 조각이 커서',
  '그림으로 확인해서',
];
const RIGHT_REASON = { same: 0, unit: 1 };
const EXPLAIN = {
  same: '분모가 같으면 분자가 클수록 큰 분수예요.',
  unit: '분자가 1이면 분모가 작을수록 한 조각이 커요.',
  equal: '두 분수가 똑같아요.',
};
const PIC_SHAPES = ['bar', 'circle', 'square', 'rect'];

let session;
let st;

start();

async function start() {
  session = await ensureSession({ title: '분수 비교 챌린지' });
  st = load();
  screen();
}

function key() {
  return `fx-ch-${session.classCode}-${session.no}`;
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(key()) || 'null');
    if (s && s.level) return s;
  } catch (_) { /* 무시 */ }
  return { level: 1, streak: 0, solved: 0, wrong: { same: 0, unit: 0 }, hintLeft: { same: 0, unit: 0 } };
}

function save() {
  try { localStorage.setItem(key(), JSON.stringify(st)); } catch (_) { /* 무시 */ }
}

// ---------- 문제 만들기 ----------

function sameDen() {
  const d = F.randInt(F.MIN_D, MAXD);
  const a = F.randInt(1, d - 1);
  let b = a;
  if (Math.random() > 0.15 && d > 2) while (b === a) b = F.randInt(1, d - 1);
  return { type: 'same', a: { n: a, d }, b: { n: b, d } };
}

function unitFrac() {
  const da = F.randInt(F.MIN_D, MAXD);
  let db = da;
  if (Math.random() > 0.15) while (db === da) db = F.randInt(F.MIN_D, MAXD);
  return { type: 'unit', a: { n: 1, d: da }, b: { n: 1, d: db } };
}

const nextQ = F.noRepeat((level) => {
  if (level <= 2) return sameDen();
  if (level === 3) return unitFrac();
  return Math.random() < 0.5 ? sameDen() : unitFrac();
}, (q) => `${F.key(q.a)}|${F.key(q.b)}`);

// ---------- 화면 ----------

function screen() {
  const pathEl = h('div', { class: 'path', 'aria-label': '내 탐험 위치' });
  const solvedEl = h('span', { class: 'muted' });
  const lvBadge = h('span', { class: 'badge' });
  const main = h('main', { class: 'ch' });

  clear(app, 
    topBar({ title: '분수 비교 챌린지', right: [lvBadge, solvedEl, h('span', { class: 'badge' }, `${session.classCode} · ${session.no}번`)] }),
    main,
  );

  function renderHead() {
    lvBadge.textContent = `내 탐험 위치 Lv${st.level}`;
    solvedEl.textContent = `푼 문제 ${st.solved}`;
    clear(pathEl);
    for (let i = 1; i <= 4; i++) {
      pathEl.appendChild(h('div', { class: `path-step ${i < st.level ? 'done' : i === st.level ? 'now' : ''}` },
        h('b', {}, i < st.level ? '✓' : i), LEVELS[i]));
    }
  }

  function ask() {
    const level = st.level;
    const q = nextQ(level);
    q.level = level;
    q.answer = F.compareSymbol(q.a, q.b);
    q.equal = q.answer === '=';
    let attempt = 0;
    let busy = false;
    renderHead();

    // 그림(Lv1)
    const pic = level === 1 ? (() => {
      const type = F.pick(PIC_SHAPES);
      const sa = drawShape(type, q.a.d, firstN(q.a.n));
      const opts = { layout: sa.dataset.layout.startsWith('grid') ? 'grid' : 'strips' };
      if (opts.layout === 'grid') opts.grid = sa.dataset.layout.slice(5).split('x').map(Number);
      return [sa, drawShape(type, q.b.d, firstN(q.b.n), opts)];
    })() : null;

    const card = (f, svg) => h('div', { class: 'side-card' },
      F.fractionEl(f),
      svg ? h('div', { class: 'shape-slot' }, svg) : null,
      h('span', { class: 'read' }, F.read(f)),
    );

    const box = h('div', { class: 'gap-box', 'aria-live': 'polite' });
    const symBtns = ['>', '<', '='].map((s) => h('button', {
      type: 'button', class: 'btn', 'aria-label': s === '>' ? '왼쪽이 커요' : s === '<' ? '오른쪽이 커요' : '같아요',
      onclick: () => choose(s),
    }, s));
    const reasonsEl = h('div', { class: 'reasons', hidden: true });
    const hintEl = h('div', { class: 'bar-hint', hidden: true },
      h('p', {}, '띠 모형으로 비교해 볼까요? (전체 길이가 같아요)'),
      barRow(q.a), barRow(q.b));
    const answerLine = h('p', { class: 'answer-line' });

    clear(main, 
      pathEl,
      h('p', { class: 'ch-title' }, '어느 분수가 더 클까요? 가운데 칸에 알맞은 것을 골라요'),
      h('div', { class: 'versus' },
        card(q.a, pic && pic[0]),
        h('div', { class: 'gap' }, box, h('div', { class: 'symbols' }, symBtns)),
        card(q.b, pic && pic[1]),
      ),
      reasonsEl, hintEl, answerLine,
    );

    if (st.hintLeft[q.type] > 0) {
      st.hintLeft[q.type]--;
      hintEl.hidden = false;
    }

    function choose(sym) {
      if (busy) return;
      box.textContent = sym;
      box.className = 'gap-box';
      // Lv4: 이유도 고른다(같은 분수일 때는 이유를 묻지 않음)
      if (level === 4 && !q.equal) {
        clear(reasonsEl, h('p', {}, '왜 그렇게 생각했나요?'),
          ...REASONS.map((r, i) => h('button', { type: 'button', class: 'btn', onclick: () => judge(sym, i) }, r)));
        reasonsEl.hidden = false;
        return;
      }
      judge(sym, null);
    }

    async function judge(sym, reasonIdx) {
      if (busy) return;
      busy = true;
      reasonsEl.hidden = true;
      const correct = sym === q.answer;
      let reason = '';
      if (reasonIdx != null) {
        reason = REASONS[reasonIdx] + (reasonIdx === RIGHT_REASON[q.type] ? '' : ' (다른 이유)');
      }
      st.solved++;
      record('log', {
        classCode: session.classCode, no: session.no, app: APP, mode: q.type, level,
        question: `Lv${level} ${F.read(q.a)} ○ ${F.read(q.b)}`, answer: sym, correct, reason,
      });

      if (correct) {
        box.classList.add('good');
        st.streak++;
        sparkle();
        await feedback('correct');
        if (st.level < 4 && st.streak >= 3) {
          st.level++;
          st.streak = 0;
          await feedback('level', `Lv${st.level} ${LEVELS[st.level]}!`, 1400);
        }
        progress();
        return ask();
      }

      box.classList.add('again');
      st.streak = 0;
      st.wrong[q.type]++;
      if (st.wrong[q.type] >= 2) {
        // 같은 유형 2회 오답 → 지금 문제와 이 유형 다음 3문제에 띠 모형 힌트
        st.wrong[q.type] = 0;
        st.hintLeft[q.type] = 3;
        hintEl.hidden = false;
      }
      attempt++;
      progress();
      if (attempt === 1) {
        await feedback('retry');
        box.textContent = '';
        box.className = 'gap-box';
        busy = false;
        return;
      }
      // 두 번째도 틀리면 정답과 띠 모형을 보여 주고 다음 문제
      hintEl.hidden = false;
      box.textContent = q.answer;
      box.className = 'gap-box good';
      const why = q.equal ? EXPLAIN.equal : EXPLAIN[q.type];
      answerLine.textContent = `${F.read(q.a)} ${q.answer} ${F.read(q.b)} · ${why}`;
      speak(why);
      await wait(3200);
      ask();
    }
  }

  ask();
}

function barRow(f) {
  return h('div', { class: 'bar-row' }, F.fractionEl(f), drawShape('bar', f.d, firstN(f.n), { tight: true }));
}

function progress() {
  save();
  record('progress', {
    classCode: session.classCode, no: session.no, app: APP,
    stage: st.level, solved: st.solved, correctStreak: st.streak,
  });
}
