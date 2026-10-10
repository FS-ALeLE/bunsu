// 모음 페이지: 앱 링크, QR, 선생님 설정, 구글 시트 연결 안내

import { h, clear } from './common/ui.js';
import { qrSvg } from './common/qr.js';
import { apiUrl, setApiUrl, call, hasBackend, GAS_URL } from './common/api.js';
import { cleanClass } from './common/session.js';
import { soundOn, setSound } from './common/sound.js';

const hub = document.getElementById('hub');
const CLASS_KEY = 'fx-hub-class';

let classCode = load(CLASS_KEY) || '';

function load(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
function save(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (_) { /* 무시 */ } }

// 학생 기기로 보낼 주소: 학급 코드와(설정했다면) 시트 주소를 붙인다.
// 시트 주소를 api.js 파일에 직접 넣었다면 ?api= 는 붙이지 않는다.
function link(path, extra = {}) {
  const u = new URL(path, location.href);
  if (classCode && extra.class !== false) u.searchParams.set('class', classCode);
  Object.entries(extra).forEach(([k, v]) => { if (k !== 'class' && v) u.searchParams.set(k, v); });
  const api = apiUrl();
  if (api && api !== GAS_URL && extra.api !== false) u.searchParams.set('api', api);
  return u.href;
}

const APPS = [
  {
    num: '①', follow: true, title: '똑같이 나누었을까?', when: '1~2차시 · 따라하기 프롬프트 결과물',
    desc: '채팅 한 번으로 만든 버전 그대로.', links: [['열기', 'follow-along/equal-parts.html', { class: false, api: false }]],
  },
  {
    num: '②', title: '분수 놀이터', when: '1~2차시 태블릿 · 전자칠판 릴레이 / 5~6차시 출제',
    desc: '모양을 똑같이 나누고 색칠하며 분수를 읽고 써요. 미션 3단계 → 도전 모드.',
    links: [['태블릿', 'playground/'], ['칠판 모드', 'playground/', { mode: 'board', api: false }], ['출제 모드', 'playground/', { mode: 'maker' }]],
  },
  {
    num: '③', follow: true, title: '분수 비교 돋보기', when: '3~4차시 · 따라하기 프롬프트 결과물',
    desc: '채팅 한 번으로 만든 버전 그대로.', links: [['열기', 'follow-along/compare-lens.html', { class: false, api: false }]],
  },
  {
    num: '④', title: '분수 비교 챌린지', when: '3~4차시 태블릿 개별',
    desc: '그림 비교 → 분모가 같은 분수 → 단위분수 → 이유 말하기. 3연속 정답이면 레벨 업.',
    links: [['태블릿', 'challenge/']],
  },
  {
    num: '⑤', follow: true, title: '분수 줄 세우기', when: '5~6차시 · 따라하기 프롬프트 결과물',
    desc: '채팅 한 번으로 만든 버전 그대로.', links: [['열기', 'follow-along/fraction-line-up.html', { class: false, api: false }]],
  },
  {
    num: '⑥', title: '분수 스피드 배틀', when: '5~6차시 전자칠판 게임 (2~4모둠 동시 터치)',
    desc: '듣고 고르기 · 색칠하기 · 더 큰 분수 · 줄 세우기. 기록은 남기지 않아요.',
    links: [['전자칠판', 'battle/', { class: false, api: false }]],
  },
  {
    num: '★', title: '우리 반 문제은행', when: '5~6차시 공유',
    desc: '친구가 만든 문제를 풀고 좋아요·댓글. 칠판 모드는 좋아요 TOP3.',
    links: [['태블릿', 'bank/'], ['칠판 TOP3', 'bank/', { mode: 'board' }]],
  },
  {
    num: '✎', title: '교사 대시보드', when: '교사 전용 (PIN)',
    desc: '미션 단계·레벨 분포, 오답 많은 문제 TOP5, 문제 승인.',
    links: [['대시보드', 'teacher/', { class: false }], ['학생용 공개 보기', 'teacher/', { view: 'public' }]],
    teacher: true,
  },
];

function render() {
  const classInput = h('input', {
    class: 'text-input', value: classCode, placeholder: '예: 3반', maxlength: 12, 'aria-label': '학급 코드',
    onchange: (e) => { classCode = cleanClass(e.target.value); save(CLASS_KEY, classCode); render(); },
  });

  clear(hub,
    h('header', { class: 'hero' },
      h('div', {},
        h('h1', {}, '∞ 분수 탐험대'),
        h('p', {}, 'See · Touch · Play — 3학년 분수 수업 웹앱 모음')),
      h('label', { class: 'class-box' }, h('b', {}, '학급 코드'), classInput)),
    classCode ? null : h('p', { class: 'note' }, '학급 코드를 넣으면 학생용 주소와 QR에 학급 코드가 들어가요. 학생은 번호만 넣으면 돼요.'),
    h('h2', {}, '수업 앱'),
    h('div', { class: 'apps' }, APPS.map(appCard)),
    settings(),
    gasGuide(),
    h('p', { class: 'note' }, '학생 이름·사진 속 얼굴 같은 개인정보는 저장하지 않아요. 학생은 학급 코드와 번호로만 들어와요.'),
  );
}

function appCard(a) {
  return h('article', { class: 'app-card' },
    h('h3', {}, h('span', { class: `num ${a.follow ? 'follow' : ''}` }, a.num), a.title),
    h('div', { class: 'when' }, a.when),
    h('p', {}, a.desc),
    h('div', { class: 'links' }, a.links.map(([label, path, extra = {}]) => {
      const url = link(path, extra);
      return [
        h('a', { class: 'btn btn-soft', href: url, target: '_blank', rel: 'noopener' }, label),
        a.teacher ? null : h('button', { type: 'button', class: 'btn', title: 'QR 크게 보기', onclick: () => showQr(`${a.title} · ${label}`, url) }, 'QR'),
      ];
    })),
  );
}

function showQr(title, url) {
  const ov = h('div', { class: 'qr-overlay', role: 'dialog', 'aria-label': 'QR 코드' },
    h('h2', {}, title),
    qrSvg(url, { size: 600 }),
    h('div', { class: 'mono' }, url),
    h('button', { type: 'button', class: 'btn btn-big', onclick: () => ov.remove() }, '닫기'));
  const esc = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
  document.body.appendChild(ov);
}

// ---------- 선생님 설정 ----------
function settings() {
  const msg = h('p', { class: 'msg' });
  const api = h('input', { class: 'text-input', value: load('fx-api') || GAS_URL, placeholder: 'https://script.google.com/macros/s/…/exec', 'aria-label': '웹 앱 주소' });
  const test = async () => {
    msg.className = 'msg';
    msg.textContent = '확인하는 중…';
    try {
      const r = await call('ping');
      msg.className = r && r.ok ? 'msg ok' : 'msg bad';
      msg.textContent = r && r.ok ? '✓ 구글 시트와 연결되었어요' : '응답이 이상해요. 주소를 확인해 주세요.';
    } catch (_) {
      msg.className = 'msg bad';
      msg.textContent = '연결할 수 없어요. 주소와 배포 설정(액세스: 모든 사용자)을 확인해 주세요.';
    }
  };
  const maxd = h('select', {
    class: 'text-input', style: { flex: 'none', width: '8rem' }, 'aria-label': '분모 상한',
    onchange: (e) => { save('fx-maxd', e.target.value === '12' ? '' : e.target.value); },
  }, [6, 8, 10, 12].map((v) => h('option', { value: v, selected: String(v) === (load('fx-maxd') || '12') }, `${v}까지`)));
  const sound = h('input', { type: 'checkbox', checked: soundOn(), onchange: (e) => setSound(e.target.checked) });

  return h('details', {},
    h('summary', {}, '⚙ 선생님 설정'),
    h('div', { class: 'col' },
      h('b', {}, '구글 시트 웹 앱 주소'),
      h('div', { class: 'setting-row' }, api,
        h('button', {
          type: 'button', class: 'btn btn-primary',
          onclick: async () => {
            const v = api.value.trim();
            if (v && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)) {
              msg.className = 'msg bad';
              msg.textContent = '웹 앱 주소는 https://script.google.com/macros/s/…/exec 모양이에요.';
              return;
            }
            setApiUrl(v);
            render();
            if (v) test();
          },
        }, '저장'),
        hasBackend() ? h('button', { type: 'button', class: 'btn', onclick: test }, '연결 확인') : null),
      msg,
      h('p', { class: 'note' }, hasBackend()
        ? '저장한 주소는 학생용 링크와 QR에 함께 들어가요. 학생 기기는 QR로 한 번 들어오면 주소를 기억해요.'
        : '주소가 없어도 모든 앱이 동작해요. 기록은 각 기기에 모아 두었다가 주소를 넣으면 보내요.'),
      h('div', { class: 'setting-row' }, h('b', {}, '분모 상한'), maxd, h('span', { class: 'note' }, '"분모 8까지만"처럼 줄일 때 (이 기기에 적용, 주소 뒤 ?maxd=8 로도 가능)')),
      h('label', { class: 'setting-row' }, sound, h('b', {}, '효과음 켜기'), h('span', { class: 'note' }, '(이 기기)')),
    ),
  );
}

// ---------- 구글 시트 연결 안내(다른 선생님용 3단계) ----------
function gasGuide() {
  return h('details', {},
    h('summary', {}, '📋 우리 반 기록을 구글 시트에 모으기 (3단계)'),
    h('ol', { class: 'steps' },
      h('li', {}, h('b', {}, '시트 만들기: '), '구글 시트를 새로 만들고(또는 공유받은 시트에서 [파일 → 사본 만들기]) [확장 프로그램 → Apps Script]를 열어요. ',
        h('a', { href: 'gas/Code.gs', target: '_blank', rel: 'noopener' }, 'gas/Code.gs'), ' 내용을 통째로 붙여 넣고 저장한 뒤, 함수 목록에서 ', h('code', {}, 'setup'), '을 골라 [실행]하고 권한을 허용해요.'),
      h('li', {}, h('b', {}, '배포: '), '[배포 → 새 배포 → 유형: 웹 앱] 실행 사용자 ', h('b', {}, '나'), ', 액세스 ', h('b', {}, '모든 사용자'), '로 배포해요. 시트의 settings 탭에서 ', h('code', {}, 'teacherPin'), '(교사 PIN, 기본 1234)을 꼭 바꿔요.'),
      h('li', {}, h('b', {}, '주소 붙여 넣기: '), '나온 웹 앱 주소를 위 ', h('b', {}, '⚙ 선생님 설정'), '에 붙여 넣어요. (파일을 고칠 수 있다면 ', h('code', {}, 'common/api.js'), '의 ', h('code', {}, 'GAS_URL'), ' 칸에 넣으면 모든 기기에 바로 적용돼요.)'),
    ),
    h('p', { class: 'note' }, '사진 문제의 사진은 선생님 구글 드라이브의 "분수 탐험대 사진" 폴더에 저장돼요.'),
  );
}

render();
