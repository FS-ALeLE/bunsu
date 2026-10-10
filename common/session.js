// 학급 코드 + 번호로 들어가기 (이름·로그인 없음)
// URL 파라미터
//   ?class=3반  학급 코드(교사가 QR에 넣어 둠)
//   ?no=12      번호
//   ?mode=board 칠판 모드, ?mode=maker 출제 모드

import { h } from './ui.js';

const KEY = 'fx-session';

export const params = new URLSearchParams(location.search);

export function mode() {
  return params.get('mode') || '';
}

export function isBoard() {
  return mode() === 'board';
}

// <html>에 board 클래스를 붙여 칠판 모드 글씨·버튼 크기를 키운다.
export function applyMode() {
  document.documentElement.classList.toggle('board', isBoard());
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
}

function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* 무시 */ }
}

export function cleanClass(s) {
  return String(s || '').replace(/[^0-9A-Za-z가-힣_-]/g, '').slice(0, 12);
}

export function getSession() {
  const saved = load() || {};
  const classCode = cleanClass(params.get('class')) || saved.classCode || '';
  const pn = Number(params.get('no'));
  const no = Number.isInteger(pn) && pn > 0 ? pn : (classCode === saved.classCode ? saved.no : 0);
  return classCode && no ? { classCode, no } : { classCode, no: 0 };
}

export function clearSession() {
  const s = load();
  if (s) save({ classCode: s.classCode, no: 0 });
}

// 학급 코드와 번호가 없으면 입력 화면을 띄우고, 다 받으면 resolve
export function ensureSession({ title = '분수 탐험대', askClass = true } = {}) {
  const s = getSession();
  if (s.classCode && s.no) {
    save(s);
    return Promise.resolve(s);
  }
  return new Promise((resolve) => {
    let no = '';
    const classInput = h('input', {
      type: 'text', class: 'text-input', maxlength: 12, value: s.classCode,
      placeholder: '예: 3반', autocomplete: 'off', 'aria-label': '학급 코드',
    });
    const noView = h('div', { class: 'login-no', 'aria-live': 'polite' }, '');
    const msg = h('p', { class: 'login-msg' }, '');
    const go = h('button', { class: 'btn btn-primary btn-big', type: 'button' }, '시작!');

    const render = () => { noView.textContent = no || '번호'; noView.classList.toggle('empty', !no); };
    const pad = h('div', { class: 'numpad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '←'].forEach((k) => {
      pad.appendChild(h('button', {
        type: 'button', class: 'btn numpad-key',
        onclick: () => {
          if (k === '←') no = no.slice(0, -1);
          else if (k === '지움') no = '';
          else if (no.length < 2) no = (no + k).replace(/^0+/, '');
          render();
        },
      }, k));
    });
    render();

    const box = h('div', { class: 'login-box' },
      h('h1', {}, title),
      h('p', { class: 'login-sub' }, '학급 코드와 내 번호를 넣어요'),
      askClass || !s.classCode
        ? h('label', { class: 'login-field' }, h('span', {}, '학급 코드'), classInput)
        : h('p', { class: 'login-class' }, `학급: ${s.classCode}`),
      h('div', { class: 'login-field' }, h('span', {}, '내 번호'), noView),
      pad, msg, go,
    );
    const overlay = h('div', { class: 'overlay login' }, box);

    go.addEventListener('click', () => {
      const classCode = cleanClass(classInput.value || s.classCode);
      const n = Number(no);
      if (!classCode) { msg.textContent = '학급 코드를 넣어 주세요.'; return; }
      if (!n || n > 40) { msg.textContent = '번호를 넣어 주세요.'; return; }
      const out = { classCode, no: n };
      save(out);
      overlay.remove();
      resolve(out);
    });
    document.body.appendChild(overlay);
  });
}
