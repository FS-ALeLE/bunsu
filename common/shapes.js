// 도형 SVG 만들기
//   drawShape(type, d, shadedIndexes, opts) → <svg>
//   각 조각은 <path class="piece" data-i="0..d-1">, 색칠된 조각은 class "on".
//
// 모든 모양은 넓이가 같다(전체 = 120×120 정사각형 넓이). 3~4차시에
// "전체가 같아야 비교할 수 있다"를 배우므로 모양이 달라도 전체 크기는 같아야 한다.
// 그래서 viewBox도 모두 250×170으로 같게 두고 가운데에 그린다
// (가장 긴 띠 240과 가장 높은 정삼각형 158이 들어가는 크기).

const NS = 'http://www.w3.org/2000/svg';
export const BOX_W = 250;
export const BOX_H = 170;
const CX = BOX_W / 2;
const CY = BOX_H / 2;
const AREA = 120 * 120;

export const SHAPES = [
  { type: 'circle', name: '원' },
  { type: 'square', name: '정사각형' },
  { type: 'rect', name: '직사각형' },
  { type: 'bar', name: '띠' },
  { type: 'hexagon', name: '정육각형' },
  { type: 'triangle', name: '정삼각형' },
];

export function shapeName(type) {
  return SHAPES.find((s) => s.type === type)?.name ?? type;
}

// 정육각형은 2·3·6등분만 똑같이 나눌 수 있다.
export function shapeAllows(type, d) {
  if (type === 'hexagon') return d === 2 || d === 3 || d === 6;
  return d >= 1;
}

export function shapesFor(d, types = SHAPES.map((s) => s.type)) {
  return types.filter((t) => shapeAllows(t, d));
}

// d를 2 이상 두 수의 곱으로 나누는 방법들 (6 → [2,3], [3,2])
export function gridOptions(d) {
  const out = [];
  for (let r = 2; r <= d / 2; r++) if (d % r === 0 && d / r >= 2) out.push([r, d / r]);
  return out;
}

// ---------- 기하 ----------

const SIZE = {
  square: { w: 120, h: 120 },
  rect: { w: Math.sqrt(AREA * 1.5), h: Math.sqrt(AREA / 1.5) }, // 가로:세로 = 3:2
  bar: { w: 240, h: 60 }, // 4:1
};
const R_CIRCLE = Math.sqrt(AREA / Math.PI);
const S_HEX = Math.sqrt((2 * AREA) / (3 * Math.sqrt(3)));
const S_TRI = Math.sqrt((4 * AREA) / Math.sqrt(3));
const H_TRI = (Math.sqrt(3) / 2) * S_TRI;

function equalCuts(d) {
  const c = [];
  for (let i = 0; i <= d; i++) c.push(i / d);
  return c;
}

// 모양 전체의 테두리 상자 (tight 보기용)
export function shapeBounds(type) {
  if (SIZE[type]) {
    const { w, h } = SIZE[type];
    return { x: CX - w / 2, y: CY - h / 2, w, h };
  }
  if (type === 'circle') return { x: CX - R_CIRCLE, y: CY - R_CIRCLE, w: 2 * R_CIRCLE, h: 2 * R_CIRCLE };
  if (type === 'hexagon') {
    const h = Math.sqrt(3) * S_HEX;
    return { x: CX - S_HEX, y: CY - h / 2, w: 2 * S_HEX, h };
  }
  if (type === 'triangle') return { x: CX - S_TRI / 2, y: CY - H_TRI / 2, w: S_TRI, h: H_TRI };
  throw new Error(`모르는 모양: ${type}`);
}

// 조각 목록 만들기. 조각 = { poly: [[x,y]...] } 또는 { sector: {a0, a1} } (a는 바퀴 비율 0~1)
//   opts.layout : 'strips' | 'grid' (사각형만)
//   opts.grid   : [행, 열]
//   opts.cuts   : 경계 위치 [0, ..., 1] (띠·사각형 세로 띠·삼각형·원). 같지 않게 나눈 그림용.
export function pieces(type, d, opts = {}) {
  const cuts = opts.cuts || equalCuts(d);

  if (type === 'circle') {
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) out.push({ sector: { a0: cuts[i], a1: cuts[i + 1] } });
    return out;
  }

  if (SIZE[type]) {
    const b = shapeBounds(type);
    if (opts.layout === 'grid' && opts.grid) {
      const [rows, cols] = opts.grid;
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = b.x + (b.w * c) / cols;
          const x1 = b.x + (b.w * (c + 1)) / cols;
          const y0 = b.y + (b.h * r) / rows;
          const y1 = b.y + (b.h * (r + 1)) / rows;
          out.push({ poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
        }
      }
      return out;
    }
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const x0 = b.x + b.w * cuts[i];
      const x1 = b.x + b.w * cuts[i + 1];
      out.push({ poly: [[x0, b.y], [x1, b.y], [x1, b.y + b.h], [x0, b.y + b.h]] });
    }
    return out;
  }

  if (type === 'triangle') {
    const apex = [CX, CY - H_TRI / 2];
    const by = CY + H_TRI / 2;
    const bx = CX - S_TRI / 2;
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      out.push({ poly: [apex, [bx + S_TRI * cuts[i + 1], by], [bx + S_TRI * cuts[i], by]] });
    }
    return out;
  }

  if (type === 'hexagon') {
    // 평평한 면이 위·아래인 정육각형. v0이 왼쪽 꼭짓점, 시계 방향.
    const v = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + (k * Math.PI) / 3;
      v.push([CX + S_HEX * Math.cos(a), CY + S_HEX * Math.sin(a)]);
    }
    const o = [CX, CY];
    if (d === 2) return [{ poly: [v[0], v[1], v[2], v[3]] }, { poly: [v[3], v[4], v[5], v[0]] }];
    if (d === 3) {
      return [
        { poly: [o, v[0], v[1], v[2]] },
        { poly: [o, v[2], v[3], v[4]] },
        { poly: [o, v[4], v[5], v[0]] },
      ];
    }
    if (d === 6) return v.map((p, k) => ({ poly: [o, p, v[(k + 1) % 6]] }));
    throw new Error('정육각형은 2·3·6등분만 됩니다');
  }

  throw new Error(`모르는 모양: ${type}`);
}

function sectorPoint(a, r = R_CIRCLE) {
  const t = a * 2 * Math.PI - Math.PI / 2; // 12시 방향에서 시작, 시계 방향
  return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
}

function pathOf(p) {
  if (p.poly) return 'M' + p.poly.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
  const { a0, a1 } = p.sector;
  const span = a1 - a0;
  if (span >= 0.9999) {
    const r = R_CIRCLE;
    return `M${CX},${CY - r}A${r},${r} 0 1 1 ${CX},${CY + r}A${r},${r} 0 1 1 ${CX},${CY - r}Z`;
  }
  const [x0, y0] = sectorPoint(a0);
  const [x1, y1] = sectorPoint(a1);
  const large = span > 0.5 ? 1 : 0;
  return `M${CX},${CY}L${x0.toFixed(2)},${y0.toFixed(2)}A${R_CIRCLE.toFixed(2)},${R_CIRCLE.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}Z`;
}

export function pieceArea(p) {
  if (p.sector) return (p.sector.a1 - p.sector.a0) * Math.PI * R_CIRCLE * R_CIRCLE;
  let s = 0;
  const pts = p.poly;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

// 번호 붙일 자리
function labelPoint(p) {
  if (p.sector) {
    const span = p.sector.a1 - p.sector.a0;
    if (span >= 0.9999) return [CX, CY];
    return sectorPoint((p.sector.a0 + p.sector.a1) / 2, R_CIRCLE * (span > 0.3 ? 0.5 : 0.65));
  }
  // 삼각형 조각은 무게중심, 나머지는 꼭짓점 평균
  const pts = p.poly;
  const x = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const y = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  return [x, y];
}

// ---------- SVG ----------

// opts:
//   layout, grid, cuts : pieces() 참고. 사각형에서 layout을 안 주면 합성수일 때 띠/격자를 무작위로.
//   interactive        : true면 터치로 색칠 토글(끌면서 여러 조각 칠하기 가능)
//   onChange(indexes)  : 색칠이 바뀔 때
//   numbers            : 조각 번호(1, 2, 3…) 표시 — 오답 힌트용
//   tight              : 모양 크기에 딱 맞게 viewBox를 줄임(띠 힌트 등)
//   label              : 읽어 줄 설명(aria-label)
export function drawShape(type, d, shaded = [], opts = {}) {
  if (!shapeAllows(type, d)) throw new Error(`${shapeName(type)}은(는) ${d}등분할 수 없어요`);

  let layout = opts.layout;
  let grid = opts.grid;
  if ((type === 'square' || type === 'rect') && !opts.cuts && !layout) {
    const g = gridOptions(d);
    // 조각이 많으면 세로 띠가 너무 가늘어지므로 격자를 더 자주 고른다
    if (g.length && Math.random() < (d >= 8 ? 0.7 : 0.5)) {
      layout = 'grid';
      grid = g[Math.floor(Math.random() * g.length)];
    } else layout = 'strips';
  }
  if (layout === 'grid' && !grid) grid = gridOptions(d)[0];
  if (layout === 'grid' && !grid) layout = 'strips';

  const ps = pieces(type, d, { layout, grid, cuts: opts.cuts });
  const svg = document.createElementNS(NS, 'svg');
  if (opts.tight) {
    const b = shapeBounds(type);
    const m = 4;
    svg.setAttribute('viewBox', `${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}`);
  } else {
    svg.setAttribute('viewBox', `0 0 ${BOX_W} ${BOX_H}`);
  }
  svg.setAttribute('class', `shape shape-${type}${opts.className ? ' ' + opts.className : ''}`);
  svg.setAttribute('role', 'img');
  if (opts.label) svg.setAttribute('aria-label', opts.label);
  svg.dataset.type = type;
  svg.dataset.d = d;
  svg.dataset.layout = layout === 'grid' ? `grid-${grid[0]}x${grid[1]}` : layout || '';

  const on = new Set(shaded);
  const gPieces = document.createElementNS(NS, 'g');
  const gNums = document.createElementNS(NS, 'g');
  gNums.setAttribute('class', 'piece-nums');
  const fs = Math.max(11, Math.min(26, 30 - d * 1.4));
  ps.forEach((p, i) => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathOf(p));
    path.setAttribute('class', on.has(i) ? 'piece on' : 'piece');
    path.setAttribute('fill', '#ffffff');
    path.setAttribute('stroke', '#3d3a36');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linejoin', 'round');
    path.dataset.i = i;
    gPieces.appendChild(path);

    const [x, y] = labelPoint(p);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x.toFixed(1));
    t.setAttribute('y', y.toFixed(1));
    t.setAttribute('class', 'piece-num');
    t.setAttribute('font-size', fs.toFixed(1));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('pointer-events', 'none');
    t.textContent = i + 1;
    gNums.appendChild(t);
  });
  svg.append(gPieces, gNums);
  showNumbers(svg, !!opts.numbers);

  if (opts.interactive) makePaintable(svg, opts.onChange);
  return svg;
}

export function getShaded(svg) {
  return [...svg.querySelectorAll('.piece.on')].map((p) => Number(p.dataset.i));
}

export function setShaded(svg, indexes) {
  const on = new Set(indexes);
  svg.querySelectorAll('.piece').forEach((p) => p.classList.toggle('on', on.has(Number(p.dataset.i))));
}

export function showNumbers(svg, show) {
  svg.querySelector('.piece-nums').style.display = show ? '' : 'none';
}

// 앞에서부터 n조각 색칠한 번호 목록 [0..n-1]
export function firstN(n) {
  return Array.from({ length: n }, (_, i) => i);
}

// 무작위로 n조각 고르기 (색칠된 그림을 보여 줄 때 붙어 있지 않은 모양도 나오게)
export function randomPieces(d, n, contiguous = Math.random() < 0.6) {
  if (contiguous) {
    const start = Math.floor(Math.random() * d);
    return Array.from({ length: n }, (_, i) => (start + i) % d);
  }
  const all = Array.from({ length: d }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n).sort((a, b) => a - b);
}

// 터치로 색칠하기. 처음 누른 조각의 반대 상태로 끌고 지나가는 조각을 같이 칠한다.
// 손가락마다(pointerId) 따로 기억하므로 여러 명이 동시에 칠해도 섞이지 않는다.
function makePaintable(svg, onChange) {
  const strokes = new Map(); // pointerId → 칠할지(true)/지울지(false)
  const emit = () => onChange && onChange(getShaded(svg));

  svg.classList.add('paintable');
  svg.addEventListener('pointerdown', (e) => {
    if (svg.classList.contains('locked')) return;
    const p = e.target.closest('.piece');
    if (!p) return;
    e.preventDefault();
    const paint = !p.classList.contains('on');
    strokes.set(e.pointerId, paint);
    p.classList.toggle('on', paint);
    emit();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!strokes.has(e.pointerId) || svg.classList.contains('locked')) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const p = el && el.closest && el.closest('.piece');
    if (!p || !svg.contains(p)) return;
    const paint = strokes.get(e.pointerId);
    if (p.classList.contains('on') !== paint) {
      p.classList.toggle('on', paint);
      emit();
    }
  });
  const end = (e) => strokes.delete(e.pointerId);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}
