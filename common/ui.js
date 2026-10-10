// 화면 조각 도우미: 요소 만들기, 정답/다시 해 볼까 알림, 숫자 패드, 상단 막대

import { play, soundOn, setSound } from './sound.js';
import { onStatus } from './api.js';

// h('button', { class: 'btn', onclick }, '글자', 자식요소…)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 자식 붙이기. null·false는 건너뛴다(조건부로 넣는 요소가 많아서).
export function put(el, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

// 비우고 새로 채우기
export function clear(el, ...children) {
  while (el.firstChild) el.firstChild.remove();
  return put(el, ...children);
}

// 화면 가운데 잠깐 뜨는 알림.  kind: 'correct' | 'retry' | 'info' | 'level'
// 오답은 빨강 대신 노랑 '다시 해 볼까?'
export function feedback(kind, text, ms = 1100) {
  const defaults = { correct: '정답!', retry: '다시 해 볼까?', level: '레벨 업!', info: '' };
  const el = h('div', { class: `feedback feedback-${kind}`, role: 'status' }, text || defaults[kind]);
  document.body.appendChild(el);
  if (kind === 'correct') play('correct');
  else if (kind === 'retry') play('retry');
  else if (kind === 'level') play('levelup');
  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    }, ms);
  });
}

// 숫자 패드. onKey('3' | '←' | '지움')
export function numberPad(onKey, { keys } = {}) {
  const pad = h('div', { class: 'numpad' });
  (keys || ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '←']).forEach((k) => {
    pad.appendChild(h('button', {
      type: 'button',
      class: 'btn numpad-key',
      onclick: () => { play('tap'); onKey(k); },
    }, k));
  });
  return pad;
}

// 세로 분수 입력 칸(분자 위, 분모 아래) + 숫자 패드. 분모부터 쓴다.
//   const fi = fracInput();  fi.el, fi.pad, fi.value() → {n, d} | null, fi.lock(), fi.reveal(f)
export function fracInput() {
  const val = { n: '', d: '' };
  let focus = 'd';
  let locked = false;
  const slotN = h('div', { class: 'slot', role: 'button', 'aria-label': '분자', onclick: () => setFocus('n') });
  const slotD = h('div', { class: 'slot', role: 'button', 'aria-label': '분모', onclick: () => setFocus('d') });
  function setFocus(k) { if (!locked) { focus = k; render(); } }
  function render() {
    slotN.textContent = val.n;
    slotD.textContent = val.d;
    slotN.classList.toggle('active', focus === 'n' && !locked);
    slotD.classList.toggle('active', focus === 'd' && !locked);
  }
  const pad = numberPad((k) => {
    if (locked) return;
    if (k === '←') val[focus] = val[focus].slice(0, -1);
    else if (k === '지움') { val.n = ''; val.d = ''; focus = 'd'; }
    else if (val[focus].length < 2) {
      val[focus] = (val[focus] + k).replace(/^0+/, '');
      // 분모 칸에 2~9를 쓰면 바로 분자 칸으로(1로 시작하면 10·11·12일 수 있으니 기다림)
      if (focus === 'd' && (val.d.length === 2 || (val.d && val.d !== '1'))) focus = 'n';
    }
    render();
  });
  const el = h('div', { class: 'frac-input' },
    h('span', { class: 'slot-label' }, '분자'), slotN, h('div', { class: 'bar' }), slotD, h('span', { class: 'slot-label' }, '분모'));
  render();
  return {
    el, pad,
    value: () => (val.n && val.d ? { n: Number(val.n), d: Number(val.d) } : null),
    lock() { locked = true; render(); },
    reveal(f) {
      val.n = String(f.n); val.d = String(f.d);
      slotN.classList.add('good'); slotD.classList.add('good');
      locked = true; render();
    },
  };
}

// 상단 막대: 홈 링크, 제목, 오른쪽 칸(right), 소리 켜기/끄기, 저장 상태
//   back: 함수를 주면 ⌂ 대신 ← 버튼(앱 안 처음 화면으로)
export function topBar({ title, right = [], home = '../index.html', back = null, showStatus = true } = {}) {
  const sound = h('button', {
    type: 'button',
    class: 'btn btn-icon',
    title: '효과음 켜기/끄기',
    'aria-label': '효과음 켜기/끄기',
  });
  const renderSound = () => { sound.textContent = soundOn() ? '🔊' : '🔈'; sound.setAttribute('aria-pressed', String(soundOn())); };
  sound.addEventListener('click', () => { setSound(!soundOn()); renderSound(); });
  renderSound();

  const st = h('span', { class: 'save-status' });
  if (showStatus) {
    onStatus(({ state, pending }) => {
      st.dataset.state = state;
      st.textContent = state === 'local' ? '이 기기에 저장'
        : state === 'offline' ? `연결 끊김 · 대기 ${pending}`
          : state === 'pending' ? `보내는 중 ${pending}` : '저장됨';
    });
  }

  return h('header', { class: 'topbar' },
    back ? h('button', { type: 'button', class: 'btn btn-icon home', onclick: back, 'aria-label': '뒤로' }, '←')
      : home ? h('a', { class: 'btn btn-icon home', href: home, 'aria-label': '처음으로' }, '⌂') : null,
    h('h1', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-right' }, ...right, showStatus ? st : null, sound),
  );
}

// 작은 꽃가루(정답 축하)
export function sparkle(x = innerWidth / 2, y = innerHeight / 2) {
  const colors = ['#f7a04b', '#2fa463', '#ffd23f', '#3a86d8', '#e86fa0'];
  for (let i = 0; i < 14; i++) {
    const s = h('span', { class: 'spark' });
    const a = (Math.PI * 2 * i) / 14;
    const dist = 60 + Math.random() * 60;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.background = colors[i % colors.length];
    s.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 700);
  }
}

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
