// 학생이 만든 문제(출제 모드 → 문제은행) 그리기와 풀기
//
// 문제 한 개 = 시트 bank 탭 한 줄
//   type   : 'write'(분수 쓰기) | 'compare'(더 큰 분수 고르기) | 'equal'(똑같이 나누었을까?)
//   shaded : 그림 정보 JSON(아래 spec)
//   answer : write → "4분의 3", compare → 'a' | 'b' | '=', equal → 'yes' | 'no'
//   photo / photoFileId : 사진 문제(사진이 그림을 대신함)
//
// spec
//   write   : { fig }
//   compare : { a:{n,d}, b:{n,d}, figA, figB, pictures: true|false }
//   equal   : { fig }
//   fig     = { shape, d, layout, grid, cuts, shaded:[...] }

import * as F from './fraction.js';
import { drawShape } from './shapes.js';
import { h, fracInput, feedback } from './ui.js';
import { call } from './api.js';

export const TYPES = {
  write: { name: '분수 쓰기', prompt: '색칠한 부분을 분수로 써 보세요' },
  compare: { name: '더 큰 분수 고르기', prompt: '더 큰 분수를 골라 보세요' },
  equal: { name: '똑같이 나누었을까?', prompt: '똑같이 나누었을까요?' },
};

export function parseSpec(p) {
  if (p.spec) return p.spec;
  try { return JSON.parse(p.shaded || '{}'); } catch (_) { return {}; }
}

export function figSvg(fig, opts = {}) {
  return drawShape(fig.shape, fig.d, fig.shaded || [], {
    layout: fig.layout, grid: fig.grid, cuts: fig.cuts, ...opts,
  });
}

// 경계(cuts)가 똑같은 간격인가
export function isEqualCuts(cuts) {
  if (!cuts) return true;
  const d = cuts.length - 1;
  return cuts.every((c, i) => Math.abs(c - i / d) < 1e-3);
}

export function promptOf(p) {
  return p.prompt || TYPES[p.type]?.prompt || '';
}

// 사진 칸. 이 기기에서 만든 문제는 photo(dataUrl), 시트에 올라간 문제는 photoFileId로 받아 온다.
export function photoEl(p) {
  const img = h('img', { class: 'problem-photo', alt: '문제 사진' });
  if (p.photo) img.src = p.photo;
  else if (p.photoFileId) {
    img.alt = '사진을 불러오는 중…';
    call('photo', { id: p.photoFileId })
      .then((r) => { if (r && r.ok) img.src = r.dataUrl; else img.alt = '사진을 불러오지 못했어요'; })
      .catch(() => { img.alt = '사진을 불러오지 못했어요'; });
  }
  return img;
}

function hasPhoto(p) {
  return !!(p.photo || p.photoFileId);
}

// 풀 수 있는 문제 화면. onDone({ correct, given }) 은 한 번만 불린다.
export function renderProblem(p, { onDone } = {}) {
  const spec = parseSpec(p);
  let answered = false;
  const finish = (correct, given) => {
    if (answered) return;
    answered = true;
    feedback(correct ? 'correct' : 'retry', correct ? '정답!' : '아쉬워요! 힌트를 볼까?');
    onDone && onDone({ correct, given });
  };
  const promptEl = h('p', { class: 'prompt-text problem-prompt' }, promptOf(p));

  if (p.type === 'write') {
    const fi = fracInput();
    const visual = hasPhoto(p) ? photoEl(p) : figSvg(spec.fig);
    const ans = parseRead(p.answer);
    const ok = h('button', {
      type: 'button', class: 'btn btn-primary btn-big',
      onclick: () => {
        const v = fi.value();
        if (!v) return feedback('info', '분모와 분자를 모두 써요', 900);
        fi.lock();
        const correct = !!ans && F.same(v, ans);
        if (!correct && ans) fi.reveal(ans);
        finish(correct, F.read(v));
      },
    }, '확인');
    return h('div', { class: 'problem problem-write' },
      promptEl,
      h('div', { class: 'problem-body' },
        h('div', { class: 'problem-visual' }, visual),
        h('div', { class: 'problem-input' }, fi.el, fi.pad, ok)));
  }

  if (p.type === 'compare') {
    const pics = spec.pictures !== false;
    const side = (key, f, fig) => h('button', {
      type: 'button', class: 'btn pick-card', dataset: { key },
      onclick: () => choose(key),
    }, F.fractionEl(f), pics && fig ? h('div', { class: 'pick-fig' }, figSvg(fig)) : null);
    const cards = [side('a', spec.a, spec.figA), side('b', spec.b, spec.figB)];
    const same = h('button', { type: 'button', class: 'btn pick-same', dataset: { key: '=' }, onclick: () => choose('=') }, '크기가 같아요');
    const all = [...cards, same];
    function choose(key) {
      if (answered) return;
      all.forEach((b) => {
        b.disabled = true;
        if (b.dataset.key === p.answer) b.classList.add('is-answer');
        if (b.dataset.key === key && key !== p.answer) b.classList.add('is-wrong');
      });
      finish(key === p.answer, key === '=' ? '같아요' : F.read(spec[key]));
    }
    return h('div', { class: 'problem problem-compare' },
      promptEl,
      h('div', { class: 'pick-row' }, cards[0], h('span', { class: 'pick-vs' }, '와'), cards[1]),
      h('div', { class: 'center' }, same));
  }

  if (p.type === 'equal') {
    const visual = hasPhoto(p) ? photoEl(p) : figSvg(spec.fig);
    const yes = h('button', { type: 'button', class: 'btn btn-big yn', dataset: { key: 'yes' }, onclick: () => choose('yes') }, '○ 똑같이 나누었어요');
    const no = h('button', { type: 'button', class: 'btn btn-big yn', dataset: { key: 'no' }, onclick: () => choose('no') }, '✕ 똑같지 않아요');
    function choose(key) {
      if (answered) return;
      [yes, no].forEach((b) => {
        b.disabled = true;
        if (b.dataset.key === p.answer) b.classList.add('is-answer');
        if (b.dataset.key === key && key !== p.answer) b.classList.add('is-wrong');
      });
      finish(key === p.answer, key === 'yes' ? '똑같다' : '똑같지 않다');
    }
    return h('div', { class: 'problem problem-equal' },
      promptEl,
      h('div', { class: 'problem-visual' }, visual),
      h('div', { class: 'row center' }, yes, no));
  }

  return h('p', {}, '알 수 없는 문제 유형');
}

// 교사 화면·목록용 작은 미리보기(풀 수 없음)
export function renderPreview(p) {
  const spec = parseSpec(p);
  let visual;
  // 사진 문제는 교사가 승인 전에 얼굴·이름이 없는지 볼 수 있게 사진을 그대로 보여 준다
  if (hasPhoto(p) && p.type !== 'compare') visual = photoEl(p);
  else if (p.type === 'compare') {
    visual = h('div', { class: 'row center' }, F.fractionEl(spec.a), spec.pictures !== false ? figSvg(spec.figA) : null,
      h('span', {}, '와'), F.fractionEl(spec.b), spec.pictures !== false ? figSvg(spec.figB) : null);
  } else if (spec.fig) visual = figSvg(spec.fig);
  return h('div', { class: 'preview' },
    h('div', { class: 'preview-visual' }, visual),
    h('div', { class: 'preview-text' },
      h('b', {}, TYPES[p.type]?.name || p.type), ' · ', promptOf(p),
      h('div', { class: 'muted' }, `정답: ${answerText(p)}${p.hint ? ` · 힌트: ${p.hint}` : ''}`)));
}

export function answerText(p) {
  const spec = parseSpec(p);
  if (p.type === 'compare') return p.answer === '=' ? '크기가 같아요' : F.read(spec[p.answer] || {});
  if (p.type === 'equal') return p.answer === 'yes' ? '똑같이 나누었어요' : '똑같지 않아요';
  return p.answer;
}

// "4분의 3" → {n:3, d:4}
export function parseRead(s) {
  const m = String(s || '').match(/(\d+)\s*분의\s*(\d+)/);
  return m ? { n: Number(m[2]), d: Number(m[1]) } : null;
}
