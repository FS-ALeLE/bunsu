# ∞ 분수 탐험대

3학년 분수 수업(See · Touch · Play)에서 쓰는 웹앱 모음입니다. 2026 충남 온수업 수업사례 공모전 출품작.

- 빌드 없이 동작하는 정적 사이트(HTML + CSS + 자바스크립트). 폴더째 GitHub Pages에 올리면 됩니다.
- 외부 CDN·글꼴을 쓰지 않습니다(학교망 차단 대비).
- 학생은 **학급 코드 + 번호**로만 들어옵니다. 이름·얼굴 같은 개인정보는 저장하지 않습니다.
- 구글 시트 주소가 없어도 모든 앱이 동작합니다(기록은 각 기기에 모아 두었다가 주소를 넣으면 보냄).

## 앱

| 앱 | 주소 | 쓰는 장면 |
| --- | --- | --- |
| ② 분수 놀이터 | `playground/` (`?mode=board` 칠판, `?mode=maker` 출제) | 1~2차시, 5~6차시 출제 |
| ④ 분수 비교 챌린지 | `challenge/` | 3~4차시 |
| ⑥ 분수 스피드 배틀 | `battle/` | 5~6차시 전자칠판 |
| 우리 반 문제은행 | `bank/` (`?mode=board` 좋아요 TOP3) | 5~6차시 |
| 교사 대시보드 | `teacher/` | 교사 |
| ①③⑤ 따라하기 결과물 | `follow-along/` | 각 차시 |

처음에는 `index.html`(모음 페이지)을 여세요. 학급 코드를 넣으면 학생용 링크와 QR이 만들어집니다.

## 다른 선생님이 쓰려면

1. 이 폴더를 내 GitHub 저장소에 올리고 [Settings → Pages]에서 배포합니다.
2. (기록을 모으려면) 구글 시트 → [확장 프로그램 → Apps Script]에 `gas/Code.gs`를 붙여 넣고 `setup` 실행 → 웹 앱으로 배포(실행: 나, 액세스: 모든 사용자).
3. 웹 앱 주소를 `common/api.js`의 `GAS_URL`에 넣거나, 모음 페이지 '선생님 설정'에 붙여 넣습니다. 교사 PIN은 시트 settings 탭의 `teacherPin`(기본 1234)을 바꿔 쓰세요.

URL 설정: `?class=학급코드`, `?no=번호`, `?mode=board|maker`, `?maxd=8`(분모 상한), `?api=웹앱주소`.

## 확인용 페이지

- `tests/multitouch.html` — 전자칠판 동시 터치 수 확인
- `tests/shapes.html` — 모든 모양 × 분모 2~12 조각 넓이 자동 확인

## 폴더

```
index.html, index.js   모음 페이지
common/                공통 모듈(분수·도형·읽어 주기·효과음·저장·로그인·화면·문제·QR)
playground/ challenge/ battle/ bank/ teacher/
follow-along/          ①③⑤ 채팅 제작본
gas/Code.gs            구글 앱스 스크립트
tests/                 확인용 페이지
docs/                  과정 기록과 화면
```
