// 예시(가상) 자료 — 보고서 화면 캡처용
//   교사 대시보드·문제은행 칠판 TOP3에 주소 뒤 ?demo=1 을 붙이면 이 자료를 보여 준다.
//   구글 시트나 이 기기 기록에는 아무것도 쓰지 않는다(화면에서만 만들어 보여 줌).
//
//   학생 25명이 6차시 동안 활동했다고 가정하고, 앱의 실제 규칙(3연속 정답 → 다음 단계,
//   틀리면 한 번 더, 두 번 틀리면 다음 문제)대로 문제 풀이를 흉내 낸다.
//   같은 씨앗 값이면 언제 열어도 같은 자료가 나온다(캡처를 다시 해도 숫자가 같음).

import * as F from './fraction.js';
import { shapeAllows } from './shapes.js';

export const DEMO_CLASS = '1반';
const STUDENTS = 25;
const SEED = 20261015;

// 차시 날짜(가정): 1~2차시, 3~4차시, 5~6차시
const DAYS = { s1: '2026-10-15', s2: '2026-10-20', s3: '2026-10-22' };

// ---------- 고정 씨앗 난수 ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoDb(classCode = DEMO_CLASS) {
  const r = rng(SEED);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const chance = (p) => r() < p;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const db = { log: [], progress: [], bank: [], comments: [] };

  // 학생마다 '이해 정도'(0.55~0.97)를 정한다. 몇 명은 단위분수 오개념이 있다.
  const students = Array.from({ length: STUDENTS }, (_, i) => {
    const ability = clamp(0.5 + (r() + r()) / 2 * 0.46, 0.5, 0.95);
    return { no: i + 1, ability, unitMisconception: chance(0.4) };
  });

  // 시각: 그날 수업 시간(09:00~10:20) 안에서 순서대로
  const clock = (day, startMin) => {
    let m = startMin;
    return (step = 0.6) => {
      m += step + r() * step;
      const hh = 9 + Math.floor(m / 60);
      const mm = Math.floor(m % 60);
      const ss = Math.floor(r() * 60);
      return `${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}+09:00`;
    };
  };

  const log = (row) => db.log.push({ classCode, reason: '', ...row });

  // ================= ② 분수 놀이터 미션 (1~2차시) =================
  const STAGE = { 1: '1단계 보고 쓰기', 2: '2단계 읽고 색칠하기', 3: '3단계 같은 분수, 다른 모양', 4: '도전 모드' };
  const pgProblem = (kind) => {
    if (kind === 1) { const d = int(2, 6); return { kind, f: { n: int(1, d - 1), d } }; }
    if (kind === 2) { const d = int(2, 12); return { kind, f: { n: chance(0.1) ? d : int(1, d - 1), d } }; }
    const d = int(2, 10); return { kind, f: { n: int(1, d - 1), d } };
  };
  const pgChance = (s, p, challenge) => {
    let c = s.ability + 0.02;
    if (p.kind === 1) c += 0.08 - 0.02 * (p.f.d - 2);
    if (p.kind === 2) c -= p.f.d >= 9 ? 0.2 : p.f.d >= 7 ? 0.08 : 0; // 조각이 많으면 세다가 틀림
    if (p.kind === 3) c -= 0.1 + (p.f.d >= 8 ? 0.1 : 0); // 세 모양을 모두 맞게 칠해야 함
    if (challenge) c -= 0.05;
    return clamp(c, 0.25, 0.98);
  };

  for (const s of students) {
    const t = clock(DAYS.s1, 25 + r() * 3);
    let stage = 1;
    let streak = 0;
    let solved = 0;
    const count = int(8, 16) + Math.round(s.ability * 10); // 35분 동안 푼 문제 수
    for (let q = 0; q < count; q++) {
      const challenge = stage === 4;
      const p = pgProblem(challenge ? pick([1, 2, 3]) : stage);
      const question = `${STAGE[p.kind]}: ${F.read(p.f)}`;
      let ok = false;
      let missed = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        ok = chance(pgChance(s, p, challenge) + (attempt ? 0.12 : 0)); // 번호 힌트 뒤에는 조금 더 잘 맞힘
        if (!ok) missed = true;
        solved++;
        log({ time: t(), no: s.no, app: 'playground', mode: 'mission', level: stage, question, answer: ok ? F.read(p.f) : '', correct: ok });
      }
      if (missed) streak = 0; // 실제 앱처럼 한 번이라도 틀리면 연속 정답은 처음부터
      if (ok) {
        streak++;
        if (stage < 4 && streak >= 3) {
          stage++;
          streak = 0;
          log({ time: t(0.1), no: s.no, app: 'playground', mode: 'stage', level: stage, question: '단계 변경', answer: STAGE[stage], correct: true });
        }
      } else streak = 0;
    }
    db.progress.push({ classCode, no: s.no, app: 'playground', stage, solved, correctStreak: streak, updatedAt: t(0) });
  }

  // ================= ④ 분수 비교 챌린지 (3~4차시) =================
  const REASONS = ['분모가 같고 분자가 커서', '분자가 1이고 분모가 작아서 한 조각이 커서', '그림으로 확인해서'];
  const sameDen = () => {
    const d = int(3, 12);
    const a = int(1, d - 1);
    let b = a;
    if (!chance(0.12)) while (b === a) b = int(1, d - 1);
    return { type: 'same', a: { n: a, d }, b: { n: b, d } };
  };
  const unitFrac = () => {
    const da = int(2, 12);
    let db2 = da;
    if (!chance(0.12)) while (db2 === da) db2 = int(2, 12);
    return { type: 'unit', a: { n: 1, d: da }, b: { n: 1, d: db2 } };
  };
  const sym = (a, b) => F.compareSymbol(a, b);

  for (const s of students) {
    const t = clock(DAYS.s2, 32 + r() * 3);
    let level = 1;
    let streak = 0;
    let solved = 0;
    const count = int(8, 16) + Math.round(s.ability * 8); // 30분 동안 푼 문제 수
    for (let q = 0; q < count; q++) {
      const p = level <= 2 ? sameDen() : level === 3 ? unitFrac() : (chance(0.5) ? sameDen() : unitFrac());
      const answer = sym(p.a, p.b);
      let c = s.ability + (level === 1 ? 0.1 : 0.02);
      // 단위분수 오개념: 분모가 크면 더 크다고 생각함
      if (p.type === 'unit' && answer !== '=' && s.unitMisconception) c -= 0.55;
      if (answer === '=') c -= 0.1;
      let ok = false;
      let missed = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        ok = chance(clamp(c + (attempt ? 0.15 : 0), 0.15, 0.98));
        if (!ok) missed = true;
        const given = ok ? answer : (p.type === 'unit' && answer !== '=' ? (answer === '>' ? '<' : '>') : pick(['>', '<', '='].filter((x) => x !== answer)));
        let reason = '';
        if (level === 4 && answer !== '=') {
          const right = p.type === 'same' ? 0 : 1;
          const ri = chance(clamp(s.ability - 0.1, 0.3, 0.92)) ? right : pick([2, 2, 1 - right]);
          reason = REASONS[ri] + (ri === right ? '' : ' (다른 이유)');
        }
        solved++;
        log({
          time: t(), no: s.no, app: 'challenge', mode: p.type, level,
          question: `Lv${level} ${F.read(p.a)} ○ ${F.read(p.b)}`, answer: given, correct: ok, reason,
        });
      }
      if (missed) streak = 0; // 실제 앱처럼 한 번이라도 틀리면 연속 정답은 처음부터
      if (ok) {
        streak++;
        if (level < 4 && streak >= 3) { level++; streak = 0; }
      } else streak = 0;
    }
    db.progress.push({ classCode, no: s.no, app: 'challenge', stage: level, solved, correctStreak: streak, updatedAt: t(0) });
  }

  // ================= 문제은행 (5~6차시) =================
  // 문제 유형·모양에 맞는 힌트와 댓글
  const HINTS = {
    write: ['전체를 몇 조각으로 나누었는지 먼저 세어 봐!', '색칠한 조각만 세어 보면 돼', '분모는 전체 조각 수야', '피자를 나눈다고 생각해 봐', ''],
    same: ['분모가 같으면 분자를 비교해 봐', '색칠한 조각 수를 비교해 봐', ''],
    unit: ['분자가 1이면 분모가 작을수록 커', '조각 하나의 크기를 비교해 봐', '피자를 많이 나누면 한 조각은 어떻게 될까?'],
    equal: ['접어서 겹쳐 본다고 생각해 봐', '조각 크기가 모두 같은지 봐!', '똑같은 크기인지 잘 봐!', ''],
  };
  const COMMENTS = {
    any: ['힌트 덕분에 맞혔어요', '조금 어려웠지만 좋은 문제예요', '다시 풀어 보고 싶어요', '저도 이런 문제 만들래요', '쉽고 재밌어요'],
    write: ['색칠한 게 깔끔해요'],
    many: ['조각이 많아서 세는 게 재밌어요'],
    triangle: ['삼각형으로 낸 게 신기해요'],
    hexagon: ['육각형 문제 처음 봐요'],
    equal: ['똑같이 안 나눈 거 찾기 재밌어요', '함정이 있어서 좋아요'],
    unit: ['분모가 큰데 더 작아서 놀랐어요'],
    same: ['분자만 보면 돼서 좋아요'],
  };
  // 같은 문제에는 같은 댓글이 겹치지 않게
  const commentFor = (b) => {
    const sp = JSON.parse(b.shaded);
    const keys = ['any', b.type === 'compare' ? (sp.a.n === 1 && sp.b.n === 1 ? 'unit' : 'same') : b.type, b.shape];
    if (b.type === 'write' && b.d >= 6) keys.push('many');
    const used = new Set(db.comments.filter((c) => c.bankId === b.id).map((c) => c.text));
    const options = keys.flatMap((k) => COMMENTS[k] || []).filter((t) => !used.has(t));
    return options.length ? pick(options) : null;
  };
  const SHAPES_W = ['circle', 'circle', 'square', 'rect', 'bar', 'bar', 'triangle', 'hexagon'];
  const fig = (shape, d, n) => ({ shape, d, layout: 'strips', grid: null, cuts: null, shaded: Array.from({ length: n }, (_, i) => i) });
  const shapeFor = (d) => { let sh; do sh = pick(SHAPES_W); while (!shapeAllows(sh, d)); return sh; };

  const t3 = clock(DAYS.s3, 40);
  const makers = students.filter((s) => s.no !== 7 && s.no !== 19); // 2명은 시간 안에 제출 못 함
  let idx = 0;
  for (const s of makers) {
    const many = s.ability > 0.85 && chance(0.5) ? 2 : 1;
    for (let k = 0; k < many; k++) {
      idx++;
      const type = pick(['write', 'write', 'write', 'compare', 'compare', 'equal', 'equal']);
      const base = {
        id: `demo${String(idx).padStart(2, '0')}`, classCode, no: s.no, type, prompt: '', hint: '',
        photoFileId: '', photo: '', approved: true, likes: 0, createdAt: t3(0.5),
      };
      if (type === 'write') {
        const d = int(2, 10);
        const n = int(1, d - 1);
        const shape = shapeFor(d);
        db.bank.push({ ...base, shape, d, hint: pick(HINTS.write), shaded: JSON.stringify({ fig: fig(shape, d, n) }), answer: F.read({ n, d }) });
      } else if (type === 'compare') {
        const shape = pick(['circle', 'bar', 'square', 'rect']);
        const unit = chance(0.4);
        const da = unit ? int(2, 9) : int(3, 10);
        const a = { n: unit ? 1 : int(1, da - 1), d: da };
        let b;
        if (unit) { let d2 = da; while (d2 === da) d2 = int(2, 9); b = { n: 1, d: d2 }; } else {
          let n2 = a.n; while (n2 === a.n) n2 = int(1, da - 1); b = { n: n2, d: da };
        }
        const c = F.compare(a, b);
        db.bank.push({
          ...base, shape, d: da, hint: pick(HINTS[unit ? 'unit' : 'same']), answer: c > 0 ? 'a' : c < 0 ? 'b' : '=',
          shaded: JSON.stringify({ a, b, pictures: chance(0.6), figA: fig(shape, a.d, a.n), figB: fig(shape, b.d, b.n) }),
        });
      } else {
        const shape = pick(['circle', 'bar', 'square', 'rect', 'triangle']);
        const d = int(2, 5);
        const equal = chance(0.4);
        let cuts = null;
        if (!equal) {
          // 일부러 똑같지 않게 나눈 그림
          do {
            const inner = Array.from({ length: d - 1 }, () => 0.08 + r() * 0.84).sort((x, y) => x - y);
            cuts = [0, ...inner, 1];
          } while (cuts.some((v, i) => i && v - cuts[i - 1] < 0.08) || cuts.every((v, i) => Math.abs(v - i / d) < 0.05));
        }
        db.bank.push({
          ...base, shape, d, hint: pick(HINTS.equal), answer: equal ? 'yes' : 'no',
          shaded: JSON.stringify({ fig: { shape, d, layout: 'strips', grid: null, cuts, shaded: [] } }),
        });
      }
    }
  }
  // 마지막에 낸 4문제는 아직 승인 전
  db.bank.slice(-4).forEach((b) => { b.approved = false; });

  // 문제은행 릴레이: 승인된 문제를 친구들이 풀고 좋아요·댓글
  const approved = db.bank.filter((b) => b.approved);
  const tr = clock(DAYS.s3, 62);
  const TYPE_NAME = { write: '분수 쓰기', compare: '더 큰 분수 고르기', equal: '똑같이 나누었을까?' };
  const answerText = (b) => {
    if (b.type === 'compare') {
      const sp = JSON.parse(b.shaded);
      return b.answer === '=' ? '크기가 같아요' : F.read(sp[b.answer]);
    }
    if (b.type === 'equal') return b.answer === 'yes' ? '똑같이 나누었어요' : '똑같지 않아요';
    return b.answer;
  };
  // 문제마다 '인기'를 정해 좋아요가 몇 문제에 몰리게
  approved.forEach((b) => { b._pop = r() ** 2; });
  for (const s of students) {
    const n = int(5, 9);
    const pool = approved.filter((b) => b.no !== s.no);
    for (let k = 0; k < n && pool.length; k++) {
      const b = pool.splice(Math.floor(r() * pool.length), 1)[0];
      let c = s.ability + 0.05;
      if (b.type === 'equal' && b.answer === 'no') c -= 0.08;
      const ok = chance(clamp(c, 0.3, 0.97));
      log({
        time: tr(0.4), no: s.no, app: 'bank', mode: b.type, level: '',
        question: `${b.no}번 친구 문제 · ${TYPE_NAME[b.type]} · ${answerText(b)}`, answer: ok ? answerText(b) : '', correct: ok,
      });
      if (chance(0.25 + b._pop * 0.7)) b.likes++;
      if (chance(0.12 + b._pop * 0.3)) {
        const text = commentFor(b);
        if (text) db.comments.push({ id: `c${db.comments.length + 1}`, bankId: b.id, classCode, no: s.no, text, createdAt: tr(0.1) });
      }
    }
  }
  approved.forEach((b) => { delete b._pop; });

  db.log.sort((a, b) => a.time.localeCompare(b.time));
  return db;
}
