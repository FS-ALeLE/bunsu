"""분수 탐험 일지(활동지 1~3)를 HWPX로 만든다.

사용법:  python docs/report/worksheets/make_worksheets.py
결과:    docs/report/worksheets/분수탐험일지_활동지1-3.hwpx, img/*.png
필요:    pip install python-hwpx matplotlib

분수 그림은 조각 크기가 정확해야 하므로 matplotlib로 직접 그린다(흑백 인쇄용 옅은 회색).
꾸밈 그림 자리에는 이미지 생성 프롬프트를 적어 두었다(image-prompts.md).
"""
import io
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle, Wedge, Circle

from hwpx import HwpxDocument, validate_editor_open_safety

HERE = Path(__file__).parent
IMG = HERE / "img"
IMG.mkdir(exist_ok=True)
OUT = HERE / "분수탐험일지_활동지1-3.hwpx"

MM = 283.465  # HWPUNIT per mm
INK = "#222222"
SHADE = "#C9C9C9"
HEAD_FILL = "#E6ECF3"
LW = 2.2


# ---------- 그림 ----------
def fig_ax(w_mm, h_mm):
    fig = plt.figure(figsize=(w_mm / 25.4, h_mm / 25.4), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w_mm)
    ax.set_ylim(0, h_mm)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def save(fig, name):
    path = IMG / name
    fig.savefig(path, dpi=300, transparent=False, facecolor="white")
    plt.close(fig)
    return path


def circle_parts(ax, cx, cy, r, angles, shaded=()):
    """angles: 조각 경계 각도(도, 12시 방향 0도, 시계 방향) 목록"""
    n = len(angles)
    for i in range(n):
        a1, a2 = angles[i], angles[(i + 1) % n] if i + 1 < n else angles[0] + 360
        # matplotlib Wedge: 3시 방향 0도, 반시계 → 변환
        t1, t2 = 90 - a2, 90 - a1
        ax.add_patch(Wedge((cx, cy), r, t1, t2, facecolor=SHADE if i in shaded else "white", edgecolor=INK, lw=LW))


def strip(ax, x, y, w, h, n, shaded=0):
    for i in range(n):
        ax.add_patch(Rectangle((x + i * w / n, y), w / n, h, facecolor=SHADE if i < shaded else "white", edgecolor=INK, lw=LW))


def vfrac(ax, x, y, num, den, size=13):
    ax.text(x, y + 2.6, str(num), ha="center", va="center", fontsize=size, fontweight="bold", color=INK)
    ax.plot([x - 3.2, x + 3.2], [y, y], color=INK, lw=1.6)
    ax.text(x, y - 2.8, str(den), ha="center", va="center", fontsize=size, fontweight="bold", color=INK)


def draw_images():
    paths = {}
    # 활동지1-② 피자 두 판: 가(똑같이 4), 나(똑같지 않게 4)
    fig, ax = fig_ax(120, 50)
    circle_parts(ax, 30, 25, 21, [0, 90, 180, 270])
    circle_parts(ax, 90, 25, 21, [0, 60, 170, 235])
    paths["pizza_two"] = save(fig, "ws1_pizza_two.png")

    # 활동지1-④ 빈 원(4)·띠(4)·정사각형(2×2)
    fig, ax = fig_ax(150, 44)
    circle_parts(ax, 22, 22, 19, [0, 90, 180, 270])
    strip(ax, 52, 14, 44, 16, 4)
    for i in range(2):
        for j in range(2):
            ax.add_patch(Rectangle((112 + i * 17, 5 + j * 17), 17, 17, facecolor="white", edgecolor=INK, lw=LW))
    paths["three_shapes"] = save(fig, "ws1_three_shapes.png")

    # 활동지2-③ 함정 피자: 큰 피자 1/3, 작은 피자 1/2
    fig, ax = fig_ax(120, 48)
    circle_parts(ax, 32, 24, 22, [0, 120, 240], shaded=(0,))
    circle_parts(ax, 92, 24, 12, [0, 180], shaded=(0,))
    paths["trap"] = save(fig, "ws2_trap_pizza.png")

    # 활동지2-④ 띠로 증명하기: (가) 5칸·5칸, (나) 4칸·6칸 — 왼쪽에 세로 분수
    fig, ax = fig_ax(160, 62)
    rows = [(2, 5), (4, 5), (1, 4), (1, 6)]
    ys = [50, 38, 18, 6]
    for (num, den), y in zip(rows, ys):
        vfrac(ax, 8, y + 4, num, den, size=11)
        strip(ax, 18, y, 120, 8, den)
        ax.add_patch(Circle((150, y + 4), 4.2, facecolor="white", edgecolor="#888888", lw=1))  # 답 쓰는 동그라미 자리
    paths["strips"] = save(fig, "ws2_strips.png")

    # 활동지3-① 설계도용 빈 틀: 원·사각형·띠 테두리(나누지 않음)
    fig, ax = fig_ax(150, 40)
    ax.add_patch(Circle((22, 20), 17, facecolor="white", edgecolor="#777777", lw=1.6, ls="--"))
    ax.add_patch(Rectangle((52, 3), 34, 34, facecolor="white", edgecolor="#777777", lw=1.6, ls="--"))
    ax.add_patch(Rectangle((100, 13), 46, 14, facecolor="white", edgecolor="#777777", lw=1.6, ls="--"))
    paths["blank"] = save(fig, "ws3_blank_frames.png")
    return paths


# ---------- HWPX ----------
class Sheet:
    def __init__(self):
        self.doc = HwpxDocument.new()
        d = self.doc
        d.page.set_margins(left=int(15 * MM), right=int(15 * MM), top=int(12 * MM), bottom=int(12 * MM))
        self.s = {
            "title": d.styles.ensure_run(bold=True, size=20),
            "sub": d.styles.ensure_run(size=10, color="#555555"),
            "head": d.styles.ensure_run(bold=True, size=11),
            "body": d.styles.ensure_run(size=10.5),
            "hint": d.styles.ensure_run(size=4, color="#777777")
            , "note": d.styles.ensure_run(size=9, color="#777777"),
            "prompt": d.styles.ensure_run(size=8, color="#7A7A7A", italic=True),
        }
        self.first = True

    def p(self, text="", style="body"):
        return self.doc.add_paragraph(text, char_pr_id_ref=self.s[style])

    def page_break(self):
        para = self.p("", "hint")
        para.element.set("pageBreak", "1")  # 이 문단부터 새 쪽
        return para

    def header(self, no, title, subtitle, art_prompt):
        t = self.doc.add_table(2, 2)
        if not self.first:  # 표를 담은 문단부터 새 쪽
            node = t.element
            while node is not None and not node.tag.endswith("}p"):
                node = node.getparent()
            node.set("pageBreak", "1")
        self.first = False
        t.set_column_widths([1, 3.2])
        t.merge_cells(0, 0, 1, 0)
        c = t.cell(0, 0)
        c.set_text("")
        c.add_paragraph(f"[그림 {no}]", char_pr_id_ref=self.s["note"])
        c.add_paragraph("image-prompts.md", char_pr_id_ref=self.s["prompt"])
        t.cell(0, 1).set_text("")
        t.cell(0, 1).add_paragraph(f"활동지 {no}  {title}", char_pr_id_ref=self.s["title"])
        t.cell(0, 1).add_paragraph(subtitle, char_pr_id_ref=self.s["sub"])
        t.cell(1, 1).set_text("")
        t.cell(1, 1).add_paragraph("3학년 (     )반 (     )번   이름 (                    )", char_pr_id_ref=self.s["body"])
        self.p("", "hint")

    def box(self, head, lines=(), image=None, img_mm=None, blank=0, table=None, after=()):
        """머리 칸(회색) + 내용 칸 한 덩어리. table=(rows) 이면 내용 칸 안에 작은 표."""
        t = self.doc.add_table(2, 1)
        t.set_cell_text(0, 0, head)
        t.set_cell_shading(0, 0, HEAD_FILL)
        hc = t.cell(0, 0)
        for para in hc.paragraphs:
            for r in para.runs:
                r.element.set("charPrIDRef", str(self.s["head"]))
        c = t.cell(1, 0)
        c.set_text("")
        for ln in lines:
            style = "note" if ln.startswith("※") else "body"
            c.add_paragraph(ln, char_pr_id_ref=self.s[style])
        if image:
            item = self.doc.add_image(Path(image).read_bytes(), "png")
            w, h = img_mm
            c.add_paragraph("").add_picture(item, width=int(w * MM), height=int(h * MM), align="CENTER")
        for ln in after:
            c.add_paragraph(ln, char_pr_id_ref=self.s["body"])
        if table:
            inner = c.add_table(len(table), len(table[0]))
            for i, row in enumerate(table):
                for j, val in enumerate(row):
                    inner.set_cell_text(i, j, val)
            if len(table[0]) == 2:
                inner.set_column_widths([3.4, 1])
        for _ in range(blank):
            c.add_paragraph("", char_pr_id_ref=self.s["body"])


SELF_CHECK = [
    ["나는 이렇게 할 수 있어요", "☆ ☆ ☆ ☆"],
    ["1. 똑같이 나눈 것과 그렇지 않은 것을 구별할 수 있다.", "☆ ☆ ☆ ☆"],
    ["2. 분수를 읽고 쓸 수 있다.", "☆ ☆ ☆ ☆"],
    ["3. 두 분수의 크기를 비교하고 그 이유를 말할 수 있다.", "☆ ☆ ☆ ☆"],
]


def build(paths):
    s = Sheet()

    # ---------------- 활동지 1 ----------------
    s.header(1, "분수 탐험 일지 ① 똑같이 나누어요", "1~2차시 · 분수 놀이터 탐험",
             "프롬프트: 피자를 똑같이 나누는 칼을 든 귀여운 탐험가 어린이, 탐험 모자와 배낭, 흰 배경, 단순한 선화 스타일, 흑백 인쇄용, 글자 없음")
    s.box("① 탐험 전 나의 모습  —  할 수 있는 만큼 별을 색칠해요", table=SELF_CHECK)
    s.box("② 공평하게 나누었을까?",
          ["두 피자를 4조각으로 나누었어요. 똑같이 나눈 피자에 ○, 아닌 피자에 × 하세요.",
           "        가 (     )                                         나 (     )"],
          image=paths["pizza_two"], img_mm=(62, 26),
          after=["그렇게 생각한 까닭: ______________________________________________________________"])
    s.box("③ 의견이 갈린 도형  —  웹앱 ‘똑같이 나누었을까?’",
          ["친구들 의견이 갈린 도형을 그려 보세요.",
           "조각을 겹쳐 보니 알게 된 점: _____________________________________________"],
          blank=2)
    s.box("④ 같은 분수, 다른 모양",
          ["세 도형에 똑같이 [  4분의 3  ]만큼 색칠하세요.",
           "※ 분수를 세로로 쓰고, 분모와 분자에 화살표로 이름을 붙여 보세요."],
          image=paths["three_shapes"], img_mm=(92, 27))
    s.box("⑤ 오늘의 정리",
          ["분수란 _____________________________________________________________________ 이다.",
           "오늘 나의 탐험 위치(분수 놀이터 미션):   1단계   2단계   3단계   도전 모드   (○ 하기)"])

    # ---------------- 활동지 2 ----------------
    s.header(2, "분수 탐험 일지 ② 어느 분수가 더 클까?", "3~4차시 · 분수 비교 돋보기 · 분수 비교 챌린지",
             "프롬프트: 커다란 돋보기로 피자 두 조각을 비교하는 어린이 탐험가, 궁금한 표정, 흰 배경, 단순한 선화 스타일, 흑백 인쇄용, 글자 없음")
    s.box("① 내 예상  —  지우지 말고 남겨 두어요",
          ["3분의 1 피자와 5분의 1 피자 중 더 큰 쪽은?      ( 3분의 1  /  5분의 1 )  ← ○ 하기",
           "왜냐하면 ____________________________________________________________________"])
    s.box("② 돋보기로 찾은 규칙",
          ["• 분모가 같으면 분자가 ____________ 수록 더 큰 분수예요.",
           "• 분자가 1이면 분모가 ____________ 수록 더 큰 분수예요."])
    s.box("③ 함정 피자",
          ["큰 피자의 3분의 1과 작은 피자의 2분의 1이에요. 색칠한 조각을 비교해 보세요."],
          image=paths["trap"], img_mm=(62, 25),
          after=["전체 크기가 다르면 분수의 크기를 비교할 수 ( 있다 / 없다 ).  까닭: ___________________________"])
    s.box("④ 띠로 증명하기",
          ["분수만큼 색칠하고, 오른쪽 ○ 안에 더 큰 분수 쪽 화살표(↑ 또는 ↓)를 쓰세요.",
           "※ 위 두 줄은 분모가 같은 분수, 아래 두 줄은 단위분수예요."],
          image=paths["strips"], img_mm=(100, 38))
    s.box("⑤ 친구에게 설명하기",
          ["7분의 2와 7분의 5 중 (                ) 이/가 더 큽니다.",
           "왜냐하면 ____________________________________________________________________"])
    s.box("⑥ 다시 보기",
          ["①의 내 예상은 ( 맞았다 / 바뀌었다 ).  생각을 바꾸게 한 것: _____________________________"])

    # ---------------- 활동지 3 ----------------
    s.header(3, "출제자 노트", "5~6차시 · 우리 반 문제은행",
             "프롬프트: 연필과 노트를 들고 문제를 만드는 어린이 탐험가, 머리 위에 전구, 흰 배경, 단순한 선화 스타일, 흑백 인쇄용, 글자 없음")
    s.box("① 문제 설계도",
          ["문제 유형:  □ 분수 쓰기    □ 더 큰 분수 고르기    □ 똑같이 나누었을까?",
           "모양: ____________    몇 조각으로 나눌까요? ______    몇 조각을 색칠할까요? ______",
           "아래 틀에 내 문제 그림을 먼저 그려 보세요(한 가지만 골라도 돼요)."],
          image=paths["blank"], img_mm=(100, 27))
    s.box("② 정답과 힌트 먼저 쓰기  —  앱에 넣기 전에!",
          ["정답: _________________________",
           "힌트(답을 말하지 않고 도와주기): ______________________________________________"])
    s.box("③ 함정 아이디어(하고 싶은 사람만)",
          ["친구가 헷갈릴 만한 점과 그렇게 만든 까닭: ______________________________________"])
    s.box("④ 친구 문제 풀이",
          ["푼 문제        출제자 번호        내 답        좋아요에 남길 한 줄(수학적 까닭을 넣어요)",
           "  1.             (      )번         ______      ____________________________________",
           "  2.             (      )번         ______      ____________________________________",
           "※ 예: “그림이 똑같이 나뉘어 있어서 좋았어요.”"])
    s.box("⑤ 탐험 후 나의 모습  —  활동지 1과 같은 질문이에요", table=SELF_CHECK)
    s.box("⑥ 3·2·1 성찰",
          ["알게 된 것 3가지: ___________________________________________________________",
           "신기했던 것 2가지: __________________________________________________________",
           "궁금한 것 1가지: ____________________________________________________________"])

    s.doc.save_to_path(OUT)
    return validate_editor_open_safety(str(OUT))


if __name__ == "__main__":
    report = build(draw_images())
    print("reopen_ok:", report.reopen_ok, "blocking:", report.blocking_package_errors)
    try:
        from hwpx.experimental import estimate_pages
        print("estimated pages:", estimate_pages(str(OUT)))
    except Exception as e:  # 실험 기능
        print("page estimate unavailable:", e)
