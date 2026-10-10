// 읽어 주기 (Web Speech API, ko-KR)
// 음성을 지원하지 않는 기기에서는 조용히 넘어간다(앱은 그대로 동작).

let koVoice = null;

function loadVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  koVoice = voices.find((v) => v.lang === 'ko-KR' && /google/i.test(v.name))
    || voices.find((v) => v.lang === 'ko-KR')
    || voices.find((v) => v.lang && v.lang.startsWith('ko'))
    || null;
}

if ('speechSynthesis' in window) {
  loadVoice();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoice);
}

export function canSpeak() {
  return 'speechSynthesis' in window;
}

// 말하기가 끝나면 resolve. 지원하지 않으면 바로 resolve.
export function speak(text, { rate = 0.9, pitch = 1.05 } = {}) {
  return new Promise((resolve) => {
    if (!canSpeak()) return resolve(false);
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (koVoice) u.voice = koVoice;
      u.rate = rate;
      u.pitch = pitch;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      speechSynthesis.speak(u);
      // 일부 브라우저는 onend가 안 오므로 안전장치
      setTimeout(() => resolve(true), 1500 + text.length * 250);
    } catch (_) {
      resolve(false);
    }
  });
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}
