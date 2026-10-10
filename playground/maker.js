// ② 분수 놀이터 · 출제 모드 (?mode=maker) — 5~6차시
//   그림 문제: 모양 → 나누기(분모, 경계 옮기기) → 색칠 → 문제 유형 → 정답·힌트 → 미리보기 → 제출
//   사진 문제: 사진 → 문제 유형 → 정답·힌트 → 미리보기 → 제출
//   제출한 문제는 선생님이 승인하면 문제은행에 나온다.

import * as F from '../common/fraction.js';
import { SHAPES, drawShape, shapeAllows, shapeBounds, gridOptions } from '../common/shapes.js';
import { record } from '../common/api.js';
import { h, put, clear, feedback, fracInput, topBar } from '../common/ui.js';
import { TYPES, renderProblem, isEqualCuts } from '../common/problem.js';

const NS = 'http://www.w3.org/2000/svg';
const STEP_NAMES = {
  shape: '모양', divide: '나누기', paint: '색칠', type: '문제 유형', answer: '정답·힌트', preview: '미리보기', photo: '사진',
};
const FIG_STEPS = ['shape', 'divide', 'paint', 'type', 'answer', 'preview'];
const PHOTO_STEPS = ['photo', 'type', 'answer', 'preview'];
const DRAGGABLE = ['circle', 'bar', 'square', 'rect', 'triangle'];

export function startMaker(app, session) {
  const MAXD = F.maxDenominator();
  let s;
  reset();

  function reset() {
    s = {
      photoMode: false, step: 0,
      shape: 'circle', d: 4, layout: 'strips', grid: null, cuts: null, shaded: [],
      type: null, b: { n: 1, d: 3 }, pictures: true,
      hint: '', prompt: '', answerOk: false, answer: null,
      photo: null, photoAnswer: null,
    };
  }

  const steps = () => (s.photoMode ? PHOTO_STEPS : FIG_STEPS);
  const stepKey = () => steps()[s.step];
  const isEqual = () => !s.cuts || isEqualCuts(s.cuts);
  const fig = () => ({ shape: s.shape, d: s.d, layout: s.layout, grid: s.grid, cuts: s.cuts && !isEqual() ? s.cuts : null, shaded: s.shaded });

  const stage = h('div', { class: 'stage maker-stage' });
  const panel = h('div', { class: 'maker-panel' });
  const stepBar = h('div', { class: 'maker-steps' });
  const prevBtn = h('button', { type: 'button', class: 'btn', onclick: () => go(-1) }, '← 이전');
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: () => go(1) }, '다음 →');

  clear(app, 
    topBar({ title: '문제 만들기', who: `${session.classCode} · ${session.no}번` }),
    h('div', { class: 'maker' }, stepBar,
      h('div', { class: 'maker-main' }, stage, h('div', { class: 'maker-side' }, panel, h('div', { class: 'maker-nav' }, prevBtn, nextBtn)))),
  );

  function go(dir) {
    if (dir > 0) {
      const err = checkStep();
      if (err) { feedback('info', err, 1300); return; }
      if (stepKey() === 'preview') return submit();
    }
    s.step = Math.max(0, Math.min(steps().length - 1, s.step + dir));
    render();
  }

  // 다음 단계로 가기 전에 확인
  function checkStep() {
    const k = stepKey();
    if (k === 'photo' && !s.photo) return '사진을 먼저 골라요';
    if (k === 'type') {
      if (!s.type) return '문제 유형을 골라요';
      if (!s.photoMode && s.type !== 'equal' && !isEqual()) return '똑같이 나눈 그림이어야 해요';
      if (!s.photoMode && s.type !== 'equal' && !s.shaded.length) return '색칠한 조각이 있어야 해요';
    }
    if (k === 'answer' && !s.answerOk) return '정답을 맞게 넣어 주세요';
    return '';
  }

  function render() {
    clear(stepBar);
    steps().forEach((k, i) => stepBar.appendChild(h('span', { class: `maker-step ${i === s.step ? 'now' : i < s.step ? 'done' : ''}` }, `${i + 1} ${STEP_NAMES[k]}`)));
    prevBtn.hidden = s.step === 0;
    nextBtn.hidden = false;
    nextBtn.textContent = stepKey() === 'preview' ? '제출하기 ✓' : '다음 →';
    clear(panel);
    clear(stage);
    stage.classList.remove('wide');
    ({ shape: stepShape, divide: stepDivide, paint: stepPaint, type: stepType, answer: stepAnswer, preview: stepPreview, photo: stepPhoto })[stepKey()]();
  }

  // ---------- 그림 ----------
  function figure({ paint = false, handles = false } = {}) {
    const svg = drawShape(s.shape, s.d, s.shaded, {
      layout: s.layout, grid: s.grid, cuts: s.cuts || undefined,
      interactive: paint, onChange: (sh) => { s.shaded = sh; s.answerOk = false; updatePaintInfo(); },
    });
    if (handles) addHandles(svg);
    clear(stage).appendChild(svg);
    return svg;
  }

  let paintInfo = null;
  function updatePaintInfo() {
    if (!paintInfo) return;
    const n = s.shaded.length;
    clear(paintInfo, F.fractionEl({ n: n || '', d: s.d }, 'big'),
      h('span', {}, isEqual() ? (n ? F.read({ n, d: s.d }) : '조각을 눌러 색칠해요') : '똑같이 나누지 않은 그림이에요'));
  }

  // ---------- 1. 모양 ----------
  function stepShape() {
    figure();
    put(panel, 
      h('h2', {}, '어떤 모양으로 만들까요?'),
      h('div', { class: 'shape-btns' }, SHAPES.map((x) => h('button', {
        type: 'button', class: 'btn', 'aria-pressed': String(s.shape === x.type),
        onclick: () => {
          s.shape = x.type;
          if (!shapeAllows(s.shape, s.d)) s.d = 6;
          s.cuts = null; s.shaded = []; s.layout = 'strips'; s.grid = null;
          render();
        },
      }, drawShape(x.type, x.type === 'hexagon' ? 6 : 2, [], { layout: 'strips' }), x.name))),
      h('p', { class: 'muted' }, '또는'),
      h('button', { type: 'button', class: 'btn btn-soft', onclick: () => { reset(); s.photoMode = true; render(); } }, '📷 사진으로 문제 만들기'),
    );
  }

  // ---------- 2. 나누기 ----------
  function stepDivide() {
    const canDrag = DRAGGABLE.includes(s.shape) && s.layout === 'strips';
    let dragMode = !!s.cuts;
    figure({ handles: dragMode && canDrag });

    const ds = F.range(F.MIN_D, MAXD).filter((d) => shapeAllows(s.shape, d));
    const setD = (d) => {
      s.d = d; s.cuts = null; s.shaded = [];
      if (s.layout === 'grid' && !gridOptions(d).some((g) => g.join() === (s.grid || []).join())) { s.layout = 'strips'; s.grid = null; }
      render();
    };
    const dBtns = h('div', { class: 'd-grid' }, ds.map((d) => h('button', {
      type: 'button', class: 'btn', 'aria-pressed': String(d === s.d), onclick: () => setD(d),
    }, d)));

    const layoutRow = (s.shape === 'square' || s.shape === 'rect') && gridOptions(s.d).length
      ? h('div', { class: 'row' }, h('span', { class: 'muted' }, '나누는 방법'),
        h('button', { type: 'button', class: 'btn', 'aria-pressed': String(s.layout === 'strips'), onclick: () => { s.layout = 'strips'; s.grid = null; render(); } }, '세로 띠'),
        ...gridOptions(s.d).map((g) => h('button', {
          type: 'button', class: 'btn', 'aria-pressed': String(s.layout === 'grid' && s.grid.join() === g.join()),
          onclick: () => { s.layout = 'grid'; s.grid = g; s.cuts = null; render(); },
        }, `${g[0]}×${g[1]} 격자`)))
      : null;

    const equalNote = h('p', { class: `equal-note ${isEqual() ? 'yes' : 'no'}` },
      isEqual() ? '✓ 똑같이 나누었어요' : '✕ 똑같이 나누지 않았어요');

    put(panel, 
      h('h2', {}, '몇 조각으로 나눌까요?'),
      dBtns,
      layoutRow,
      canDrag ? h('div', { class: 'row' },
        h('button', {
          type: 'button', class: 'btn', 'aria-pressed': String(dragMode),
          onclick: () => {
            if (dragMode) { s.cuts = null; } else { s.cuts = F.range(0, s.d).map((i) => i / s.d); }
            render();
          },
        }, dragMode ? '↺ 다시 똑같이 나누기' : '↔ 조각 경계 옮기기'),
      ) : null,
      canDrag ? h('p', { class: 'muted small' }, '"똑같이 나누었을까?" 문제를 만들 때는 경계를 끌어서 똑같지 않게 나눌 수도 있어요.') : null,
      equalNote,
    );
  }

  // 경계 손잡이(끌어서 옮기기)
  function addHandles(svg) {
    if (!s.cuts) return;
    const b = shapeBounds(s.shape);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cut-handles');
    const MIN = 0.04;
    const pos = (c) => {
      if (s.shape === 'circle') {
        const r = b.w / 2;
        const t = c * 2 * Math.PI - Math.PI / 2;
        return [b.x + r + r * Math.cos(t), b.y + r + r * Math.sin(t)];
      }
      return [b.x + b.w * c, b.y + b.h]; // 아래 변 위의 손잡이
    };
    const toCut = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (s.shape === 'circle') {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        let a = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
        if (a < 0) a += 2 * Math.PI;
        return a / (2 * Math.PI);
      }
      return (p.x - b.x) / b.w;
    };
    for (let i = 1; i < s.cuts.length - 1; i++) {
      const [x, y] = pos(s.cuts[i]);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 9);
      c.setAttribute('class', 'cut-handle');
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { c.setPointerCapture(e.pointerId); } catch (_) { /* 캡처를 못 해도 끌기는 된다 */ }
        const move = (ev) => {
          let v = toCut(ev);
          v = Math.max(s.cuts[i - 1] + MIN, Math.min(s.cuts[i + 1] - MIN, v));
          s.cuts[i] = v;
          const [nx, ny] = pos(v);
          c.setAttribute('cx', nx); c.setAttribute('cy', ny);
        };
        const up = () => {
          c.removeEventListener('pointermove', move);
          c.removeEventListener('pointerup', up);
          c.removeEventListener('pointercancel', up);
          render(); // 조각 다시 그리기
        };
        c.addEventListener('pointermove', move);
        c.addEventListener('pointerup', up);
        c.addEventListener('pointercancel', up);
      });
      g.appendChild(c);
    }
    svg.appendChild(g);
  }

  // ---------- 3. 색칠 ----------
  function stepPaint() {
    figure({ paint: true });
    paintInfo = h('div', { class: 'live' });
    updatePaintInfo();
    put(panel, 
      h('h2', {}, '조각을 눌러 색칠해요'),
      paintInfo,
      h('button', { type: 'button', class: 'btn', onclick: () => { s.shaded = []; render(); } }, '모두 지우기'),
      isEqual() ? null : h('p', { class: 'muted small' }, '똑같이 나누지 않은 그림은 "똑같이 나누었을까?" 문제로 만들어요.'),
    );
  }

  // ---------- 사진 ----------
  function stepPhoto() {
    stage.appendChild(s.photo ? h('img', { class: 'problem-photo', src: s.photo, alt: '고른 사진' }) : h('p', { class: 'muted' }, '사진이 여기에 보여요'));
    const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'file-input' });
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        s.photo = await shrinkImage(f, 1024);
        render();
      } catch (_) {
        feedback('info', '사진을 열 수 없어요', 1200);
      }
    });
    put(panel, 
      h('h2', {}, '📷 사진으로 문제 만들기'),
      h('p', {}, '피자, 케이크, 색종이처럼 나누어진 물건을 찍어요.'),
      h('p', { class: 'privacy' }, '⚠ 얼굴이나 이름이 나오지 않게 찍어요.'),
      h('label', { class: 'btn btn-soft' }, '사진 찍기 / 고르기', file),
      h('button', { type: 'button', class: 'btn', onclick: () => { reset(); render(); } }, '그림으로 만들기로 돌아가기'),
    );
  }

  // ---------- 4. 문제 유형 ----------
  function stepType() {
    if (s.photoMode) stage.appendChild(h('img', { class: 'problem-photo', src: s.photo, alt: '고른 사진' }));
    else figure();
    const types = s.photoMode ? ['write', 'equal'] : ['write', 'compare', 'equal'];
    const desc = {
      write: s.photoMode ? '사진 속 부분을 분수로 써요' : '색칠한 부분을 분수로 써요',
      compare: '내 분수와 다른 분수 중 더 큰 것을 골라요',
      equal: s.photoMode ? '사진 속 물건을 똑같이 나누었는지 맞혀요' : '이 그림이 똑같이 나누어졌는지 맞혀요',
    };
    const disabled = (t) => !s.photoMode && t !== 'equal' && (!isEqual() || !s.shaded.length);
    put(panel, 
      h('h2', {}, '어떤 문제로 낼까요?'),
      ...types.map((t) => h('button', {
        type: 'button', class: 'btn type-btn', 'aria-pressed': String(s.type === t), disabled: disabled(t),
        onclick: () => { s.type = t; s.answerOk = false; render(); },
      }, h('b', {}, TYPES[t].name), h('small', {}, desc[t]))),
      s.type === 'compare' ? compareSetup() : null,
    );
  }

  // 비교할 두 번째 분수 정하기
  function compareSetup() {
    const allowed = F.range(F.MIN_D, MAXD).filter((d) => shapeAllows(s.shape, d));
    if (!allowed.includes(s.b.d)) s.b.d = allowed[0];
    if (s.b.n > s.b.d) s.b.n = s.b.d;
    const view = h('div', { class: 'row' });
    const draw = () => {
      clear(view, F.fractionEl(s.b, 'big'),
        h('div', { class: 'col' },
          stepper('분모', () => s.b.d, (v) => {
            const i = allowed.indexOf(s.b.d) + v;
            if (allowed[i]) s.b.d = allowed[i];
            s.b.n = Math.min(s.b.n, s.b.d);
            s.answerOk = false; draw();
          }),
          stepper('분자', () => s.b.n, (v) => { s.b.n = Math.max(1, Math.min(s.b.d, s.b.n + v)); s.answerOk = false; draw(); })));
    };
    draw();
    return h('div', { class: 'card col' },
      h('b', {}, '비교할 분수'),
      view,
      h('label', { class: 'row' },
        h('input', { type: 'checkbox', checked: s.pictures, onchange: (e) => { s.pictures = e.target.checked; } }),
        '그림도 보여 주기'));
  }

  function stepper(label, get, change) {
    return h('div', { class: 'row stepper' }, h('span', { class: 'muted' }, label),
      h('button', { type: 'button', class: 'btn btn-icon', onclick: () => change(-1) }, '−'),
      h('b', {}, get()),
      h('button', { type: 'button', class: 'btn btn-icon', onclick: () => change(1) }, '+'));
  }

  // 정답(컴퓨터가 계산) — 학생이 넣은 답과 맞는지 확인한다
  function trueAnswer() {
    if (s.type === 'write') return s.photoMode ? null : F.read({ n: s.shaded.length, d: s.d });
    if (s.type === 'compare') {
      const c = F.compare({ n: s.shaded.length, d: s.d }, s.b);
      return c > 0 ? 'a' : c < 0 ? 'b' : '=';
    }
    if (s.type === 'equal') return s.photoMode ? null : (isEqual() ? 'yes' : 'no');
    return null;
  }

  // ---------- 5. 정답·힌트 ----------
  function stepAnswer() {
    if (s.photoMode) stage.appendChild(h('img', { class: 'problem-photo', src: s.photo, alt: '고른 사진' }));
    else figure();
    const want = trueAnswer();
    const status = h('p', { class: 'answer-status' }, s.answerOk ? '✓ 정답을 넣었어요' : '');
    const accept = (given) => {
      // 사진 문제는 컴퓨터가 정답을 모르므로 학생 답을 그대로 쓴다
      if (want === null || given === want) {
        s.answer = given;
        s.answerOk = true;
        status.textContent = '✓ 정답을 넣었어요';
        status.className = 'answer-status ok';
      } else {
        s.answerOk = false;
        status.textContent = '그림을 다시 확인해 볼까?';
        status.className = 'answer-status again';
        feedback('retry', '그림을 다시 확인해 볼까?', 1100);
      }
    };

    let input;
    if (s.type === 'write') {
      const fi = fracInput();
      input = h('div', { class: 'col' }, h('div', { class: 'row' }, fi.el, fi.pad),
        h('button', {
          type: 'button', class: 'btn btn-soft',
          onclick: () => {
            const v = fi.value();
            if (!v) return feedback('info', '분모와 분자를 모두 써요', 900);
            if (!F.isValid(v)) return feedback('info', '분자는 분모보다 클 수 없어요', 1200);
            accept(F.read(v));
          },
        }, '정답 확인'));
    } else if (s.type === 'compare') {
      const a = { n: s.shaded.length, d: s.d };
      input = h('div', { class: 'row' },
        ...[['a', F.read(a)], ['b', F.read(s.b)], ['=', '크기가 같아요']].map(([k, label]) => h('button', {
          type: 'button', class: 'btn', onclick: () => accept(k),
        }, k === '=' ? label : `${label}이 더 커요`)));
    } else {
      input = h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => accept('yes') }, '○ 똑같이 나누었어요'),
        h('button', { type: 'button', class: 'btn', onclick: () => accept('no') }, '✕ 똑같지 않아요'));
    }

    const hint = h('input', {
      class: 'text-input', maxlength: 40, value: s.hint, placeholder: '예: 전체를 몇 조각으로 나누었는지 세어 봐!',
      oninput: (e) => { s.hint = e.target.value; },
    });
    const prompt = h('input', {
      class: 'text-input', maxlength: 40, value: s.prompt, placeholder: TYPES[s.type].prompt,
      oninput: (e) => { s.prompt = e.target.value; },
    });
    put(panel, 
      h('h2', {}, '정답은 무엇일까요?'),
      input, status,
      h('label', { class: 'col' }, h('b', {}, '친구에게 줄 힌트'), hint),
      h('label', { class: 'col' }, h('b', {}, '문제 문장 (안 써도 돼요)'), prompt),
    );
  }

  function buildProblem() {
    const base = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      classCode: session.classCode, no: session.no, type: s.type,
      prompt: s.prompt.trim(), answer: s.answer, hint: s.hint.trim(),
    };
    if (s.photoMode) return { ...base, shape: 'photo', d: '', shaded: '{}', photo: s.photo };
    let spec;
    if (s.type === 'compare') {
      const a = { n: s.shaded.length, d: s.d };
      spec = {
        a, b: { ...s.b }, pictures: s.pictures,
        figA: fig(),
        figB: { shape: s.shape, d: s.b.d, layout: 'strips', shaded: F.range(0, s.b.n - 1) },
      };
    } else spec = { fig: fig() };
    return { ...base, shape: s.shape, d: s.d, shaded: JSON.stringify(spec) };
  }

  // ---------- 6. 미리보기 ----------
  function stepPreview() {
    const p = buildProblem();
    stage.classList.add('wide');
    stage.appendChild(h('div', { class: 'preview-box' }, renderProblem(p, {})));
    put(panel, 
      h('h2', {}, '미리보기'),
      h('p', {}, '친구가 보게 될 화면이에요. 직접 풀어 봐도 돼요.'),
      h('div', { class: 'card' }, h('b', {}, '힌트: '), p.hint || '(없음)'),
      h('p', { class: 'muted small' }, '제출하면 선생님이 확인한 뒤 문제은행에 올라가요.'),
    );
  }

  function submit() {
    const p = buildProblem();
    record('submitProblem', p);
    clear(stage);
    clear(panel, 
      h('h2', {}, '🎉 문제를 보냈어요!'),
      h('p', {}, '선생님이 확인하면 우리 반 문제은행에 나와요.'),
      h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: () => { reset(); render(); } }, '하나 더 만들기'),
      h('a', { class: 'btn', href: `../bank/` }, '문제은행 가기'),
    );
    clear(stepBar);
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    feedback('correct', '제출 완료!');
  }

  render();
}

// 사진을 긴 변 max px로 줄여 JPEG dataURL로 (학생 기기에서 줄여서 보낸다)
async function shrinkImage(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const hgt = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

