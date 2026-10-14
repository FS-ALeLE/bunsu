"""보고서 '과정 중심 평가 내용 및 자료' 표를 HWPX로 만든다.

사용법:  python docs/report/make_evaluation.py
결과:    docs/report/보고서_평가표.hwpx
형식:    2025 우수보고서(사회과)의 평가 표와 같은 짜임(차시 | 구분 | 평가영역 | 평가 내용 | 평가방법)
"""
from pathlib import Path

from hwpx import HwpxDocument, validate_editor_open_safety

OUT = Path(__file__).parent / "보고서_평가표.hwpx"
HEAD_FILL = "#E6ECF3"

TITLE = "6. 과정 중심 평가 내용 및 자료"
HEADER = ["차시", "구분", "평가영역", "평가 내용", "평가방법"]
ROWS = [
    # 차시, 구분, 평가영역, 평가 내용, 평가방법
    ("1~2", "수학", "지식·이해",
     "•똑같이 나눈 것과 그렇지 않은 것을 구별하고, 분모와 분자가 나타내는 것을 설명할 수 있다.",
     "관찰 평가\n(출구 카드)"),
    ("1~2", "수학", "과정·기능",
     "•주어진 분수를 여러 가지 모양으로 나타내고, 읽고 쓸 수 있다.",
     "산출물 평가\n(활동지1·미션 기록)"),
    ("1~2", "수학", "가치·태도",
     "•자기 속도에 맞게 미션에 도전하며 분수를 끈기 있게 탐구하려는 태도를 지닌다.",
     "자기평가"),
    ("3~4", "수학", "지식·이해",
     "•분모가 같은 분수끼리, 단위분수끼리 크기를 비교할 수 있다.",
     "웹앱 기록 평가\n(챌린지 레벨)"),
    ("3~4", "수학", "과정·기능",
     "•분수의 크기를 비교한 방법을 띠 그림이나 말로 설명할 수 있다.",
     "구술 평가\n(활동지2·이유 기록)"),
    ("3~4", "수학", "가치·태도",
     "•친구의 설명을 듣고 근거를 들어 자신의 생각을 고치거나 덧붙이려는 태도를 지닌다.",
     "동료평가"),
    ("5~6", "수학", "지식·이해",
     "•분수의 의미와 크기 비교 방법을 활용하여 친구가 만든 분수 문제를 해결할 수 있다.",
     "관찰 평가"),
    ("5~6", "수학", "과정·기능",
     "•분수의 의미가 드러나는 문제를 만들고 정답과 힌트를 제시할 수 있다.",
     "산출물 평가\n(출제 문제·활동지3)"),
    ("5~6", "수학", "가치·태도",
     "•게임과 문제 공유 활동에서 친구의 생각을 존중하고 바른 말로 피드백하려는 태도를 지닌다.",
     "동료평가\n(댓글)"),
]


def build():
    doc = HwpxDocument.new()
    doc.page.set_margins(left=5669, right=5669, top=4252, bottom=4252)
    bold = doc.styles.ensure_run(bold=True, size=13)
    doc.add_paragraph(TITLE, char_pr_id_ref=bold)

    t = doc.add_table(len(ROWS) + 1, len(HEADER))
    t.set_column_widths([0.9, 0.9, 1.15, 6.3, 1.9])
    for j, h in enumerate(HEADER):
        t.set_cell_text(0, j, h)
        t.set_cell_shading(0, j, HEAD_FILL)
    for i, row in enumerate(ROWS, start=1):
        for j, val in enumerate(row):
            t.set_cell_text(i, j, val, split_paragraphs=True)
    # 차시·구분 칸을 세 줄씩 합치기(2025 보고서와 같은 모양)
    for start in (1, 4, 7):
        for col in (0, 1):
            t.merge_cells(start, col, start + 2, col)
            t.set_cell_text(start, col, ROWS[start - 1][col])

    doc.add_paragraph("")
    note = doc.styles.ensure_run(size=9, color="#666666")
    doc.add_paragraph("※ 웹앱 기록(분수 놀이터 미션 단계, 분수 비교 챌린지 레벨·이유 고르기, 문제은행 출제 문제·댓글)은 "
                      "교사 대시보드와 구글 시트에 저장되어 평가 자료로 활용한다. "
                      "활동지1-①과 활동지3-⑤의 같은 자기 점검 문항으로 수업 전후 변화를 비교한다.", char_pr_id_ref=note)
    doc.save_to_path(OUT)
    return validate_editor_open_safety(str(OUT))


if __name__ == "__main__":
    r = build()
    print("reopen_ok:", r.reopen_ok, "blocking:", r.blocking_package_errors)
