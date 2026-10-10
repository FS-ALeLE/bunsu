// 효과음 (Web Audio로 그때그때 만든다. 소리 파일 없음)
// 기본 켜짐. 교사가 끄면 이 기기에 기억한다(localStorage 'fx-sound' = 'off').

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function soundOn() {
  try { return localStorage.getItem('fx-sound') !== 'off'; } catch (_) { return true; }
}

export function setSound(on) {
  try { localStorage.setItem('fx-sound', on ? 'on' : 'off'); } catch (_) { /* 무시 */ }
}

function tone(freq, start, dur, { type = 'sine', vol = 0.18 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.06, { type: 'triangle', vol: 0.08 }),
  correct: () => { tone(784, 0, 0.12); tone(1047, 0.1, 0.22); },
  retry: () => { tone(440, 0, 0.12, { type: 'triangle', vol: 0.12 }); tone(392, 0.12, 0.18, { type: 'triangle', vol: 0.1 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2)); },
  win: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, { type: 'square', vol: 0.07 })); },
  tick: () => tone(1200, 0, 0.04, { type: 'square', vol: 0.05 }),
};

export function play(name) {
  if (!soundOn()) return;
  try { SOUNDS[name]?.(); } catch (_) { /* 소리가 안 나도 앱은 계속 */ }
}
