// 분수 계산·비교·무작위 생성·읽기
// 분수는 { n, d } (분자, 분모). 이 단원은 진분수와 분자=분모(=1)만 다룬다.

export const MIN_D = 2;
export const MAX_D = 12;

export function frac(n, d) {
  return { n, d };
}

export function same(a, b) {
  return a.n === b.n && a.d === b.d;
}

// a가 크면 1, 작으면 -1, 크기가 같으면 0 (곱해서 비교하므로 오차 없음)
export function compare(a, b) {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l > r ? 1 : l < r ? -1 : 0;
}

// 비교 기호: '>' '<' '='
export function compareSymbol(a, b) {
  const c = compare(a, b);
  return c > 0 ? '>' : c < 0 ? '<' : '=';
}

export function read(f) {
  return `${f.d}분의 ${f.n}`;
}

export function key(f) {
  return `${f.n}:${f.d}`;
}

export function isValid(f) {
  return Number.isInteger(f.n) && Number.isInteger(f.d) && f.d >= 1 && f.n >= 1 && f.n <= f.d;
}

// ---------- 무작위 ----------

export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 분수 하나 만들기
//   minD, maxD : 분모 범위
//   whole      : 분자=분모(=1)도 낼지 (기본 false)
//   unit       : 단위분수만 (분자 1)
//   d          : 분모 고정
//   ds         : 허용 분모 목록(정육각형 2·3·6 같은 경우)
export function randomFraction(opts = {}) {
  const { minD = MIN_D, maxD = MAX_D, whole = false, unit = false } = opts;
  const ds = opts.ds || range(minD, maxD);
  const d = opts.d ?? pick(ds);
  const n = unit ? 1 : randInt(1, whole ? d : d - 1);
  return { n, d };
}

// 직전 문제와 같은 문제가 연속으로 나오지 않게 감싸 준다.
//   const next = noRepeat(() => randomFraction({ maxD: 6 }));
//   next() 를 부를 때마다 새 문제
export function noRepeat(gen, keyFn = defaultKey) {
  let last = null;
  return (...args) => {
    let item;
    for (let tries = 0; tries < 30; tries++) {
      item = gen(...args);
      if (keyFn(item) !== last) break;
    }
    last = keyFn(item);
    return item;
  };
}

function defaultKey(x) {
  return JSON.stringify(x);
}

export function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// ---------- 분모 상한 설정 ----------
// 우선순위: URL ?maxd=8 → 모음 페이지에서 저장한 값 → 앱 기본값
export function maxDenominator(appDefault = MAX_D) {
  const p = new URLSearchParams(location.search).get('maxd');
  let v = p ? Number(p) : NaN;
  if (!Number.isFinite(v)) {
    try { v = Number(localStorage.getItem('fx-maxd')); } catch (_) { v = NaN; }
  }
  if (!Number.isFinite(v) || v < MIN_D) return appDefault;
  return Math.min(MAX_D, Math.max(MIN_D, Math.round(v)));
}

// ---------- 세로 분수 표기 ----------
// 빗금(3/4) 표기는 쓰지 않는다. 분자 위, 가로선, 분모 아래.
export function fractionEl(f, cls = '') {
  const el = document.createElement('span');
  el.className = `frac ${cls}`.trim();
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', read(f));
  const n = document.createElement('span');
  n.className = 'frac-n';
  n.textContent = f.n ?? '';
  const d = document.createElement('span');
  d.className = 'frac-d';
  d.textContent = f.d ?? '';
  el.append(n, d);
  return el;
}

export function fractionHTML(f, cls = '') {
  return `<span class="frac ${cls}" role="img" aria-label="${read(f)}"><span class="frac-n">${f.n ?? ''}</span><span class="frac-d">${f.d ?? ''}</span></span>`;
}
