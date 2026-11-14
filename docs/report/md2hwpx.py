"""보고서 초안 마크다운(.md)을 한글 HWPX 파일로 바꾼다.

사용법:  python docs/report/md2hwpx.py docs/report/draft-ch1-5.md 출력.hwpx
필요:    pip install python-hwpx

지원하는 마크다운(초안에 쓴 것만):
  # / ## / ### 제목, 문단, - 목록(들여쓰기 2칸 = 하위 목록), > 인용, | 표 |, --- 구분선(건너뜀)
  5장(교수·학습 과정안)의 **단계 (시간)** 블록은 보고서 형식의
  [학습단계 | 교수·학습활동 | 준비물(▶) 및 지도상 유의점(★)] 표로 묶는다.
"""
import re
import sys

from hwpx import HwpxDocument, validate_editor_open_safety

HEADER_FILL = "#E8EEF5"


def strip_md(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1(\2)", text)
    return text.strip()


def parse_row(line: str) -> list[str]:
    cells = line.strip().strip("|").split("|")
    return [strip_md(c) for c in cells]


def is_sep(line: str) -> bool:
    return bool(re.fullmatch(r"\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?", line.strip()))


class Builder:
    def __init__(self):
        self.doc = HwpxDocument.new()
        d = self.doc
        d.page.set_margins(left=5669, right=5669, top=4252, bottom=4252)  # 20mm / 15mm (HWPUNIT)
        self.st = {
            "title": d.styles.ensure_run(bold=True, size=18),
            "h2": d.styles.ensure_run(bold=True, size=14, color="#1F3A5F"),
            "h3": d.styles.ensure_run(bold=True, size=12),
            "bold": d.styles.ensure_run(bold=True),
            "quote": d.styles.ensure_run(italic=True, color="#444444"),
            "note": d.styles.ensure_run(color="#B03A2E"),
        }
        self.in_lesson = False

    def para(self, text, style=None):
        kw = {"char_pr_id_ref": self.st[style]} if style else {}
        return self.doc.add_paragraph(text, **kw)

    def table(self, rows: list[list[str]], header=True, weights=None):
        ncol = max(len(r) for r in rows)
        rows = [r + [""] * (ncol - len(r)) for r in rows]
        t = self.doc.add_table(len(rows), ncol)
        for i, r in enumerate(rows):
            for j, val in enumerate(r):
                t.set_cell_text(i, j, val, split_paragraphs=True)
                if header and i == 0:
                    t.set_cell_shading(i, j, HEADER_FILL)
        if not weights:
            # 열 너비: 열마다 가장 긴 줄 길이를 기준으로(너무 좁거나 넓지 않게)
            longest = [max(max((len(x) for x in r[j].split("\n")), default=0) for r in rows) for j in range(ncol)]
            weights = [min(max(w, 4), 40) for w in longest]
        t.set_column_widths(weights)
        self.para("")
        return t

    def lesson_table(self, stages):
        rows = [["학습단계", "교수·학습활동", "준비물(▶) 및\n지도상 유의점(★)"]]
        for name, acts, notes in stages:
            rows.append([name, "\n".join(acts), "\n".join(notes)])
        self.table(rows, weights=[1.2, 6, 2.6])


def convert(md_path: str, out_path: str):
    lines = open(md_path, encoding="utf-8").read().splitlines()
    b = Builder()
    i = 0
    stages = []  # 5장 과정안 단계 모음

    def flush_stages():
        nonlocal stages
        if stages:
            b.lesson_table(stages)
            stages = []

    while i < len(lines):
        line = lines[i]
        s = line.strip()

        if s.startswith("## 5."):
            b.in_lesson = True
        elif s.startswith("## ") and not s.startswith("## 5."):
            flush_stages()
            b.in_lesson = False

        # 과정안 단계 블록: **이름 (시간)** + 아래 목록
        stage_m = re.fullmatch(r"\*\*(.+?)\*\*", s)
        if b.in_lesson and stage_m and not stage_m.group(1).startswith("["):
            label = stage_m.group(1)
            tm = re.search(r"\((\d+분)\)\s*$", label)
            label = re.sub(r"\s*\(\d+분\)\s*$", "", label)
            stage, _, title = [x.strip() for x in label.partition("·")]
            acts, notes = [], []
            if stage in ("탐험 준비", "정리"):  # '탐험 준비 · 도입', '정리 · 탐험 성찰'
                stage, title = (title, "") if stage == "탐험 준비" else (stage, title)
            if title:
                acts.append("■ " + title)
            name = stage + ("\n(" + tm.group(1) + ")" if tm else "")
            i += 1
            while i < len(lines):
                raw = lines[i]
                t = raw.strip()
                if not t:
                    i += 1
                    if i < len(lines) and lines[i].strip().startswith(("-", ">", " ")):
                        continue
                    break
                if t.startswith(("**", "|", "#", "【")) and not raw.startswith(" "):
                    break
                depth = (len(raw) - len(raw.lstrip(" "))) // 2
                body = strip_md(t.lstrip("-> ").strip())
                if t.startswith("- ▶") or t.startswith("- ★") or t.startswith("- 【"):
                    notes.append(body)
                elif t.startswith(">"):
                    acts.append("  " * max(depth, 1) + "“" + body.strip('"“”') + "”" if not body.startswith("예:") else "  " * max(depth, 1) + body)
                else:
                    mark = "■ " if body.startswith("■") else ("• " if depth == 0 else "- ")
                    body = body.lstrip("■ ").strip()
                    acts.append("  " * depth + mark + body)
                i += 1
            stages.append((name, acts, notes))
            continue

        if b.in_lesson and stages and (s.startswith("|") or s.startswith("**[") or s.startswith("###") or s.startswith("【")):
            flush_stages()

        if not s or s == "---":
            i += 1
            continue
        if s.startswith("# "):
            b.para(strip_md(s[2:]), "title")
        elif s.startswith("## "):
            b.para("")
            b.para(strip_md(s[3:]), "h2")
        elif s.startswith("### "):
            b.para(strip_md(s[4:]), "h3")
        elif s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                if not is_sep(lines[i]):
                    rows.append(parse_row(lines[i]))
                i += 1
            b.table(rows)
            continue
        elif s.startswith(">"):
            b.para(strip_md(s.lstrip("> ")), "quote")
        elif s.startswith("- "):
            depth = (len(line) - len(line.lstrip(" "))) // 2
            b.para("  " * depth + ("• " if depth == 0 else "- ") + strip_md(s[2:]))
        elif s.startswith("【"):
            b.para(strip_md(s), "note")
        elif re.fullmatch(r"\*\*(.+?)\*\*", s):
            b.para(strip_md(s), "bold")
        elif s.startswith("▲"):
            b.para(s, "bold")
        else:
            b.para(strip_md(s))
        i += 1

    flush_stages()
    b.doc.save_to_path(out_path)
    report = validate_editor_open_safety(out_path)
    return report


if __name__ == "__main__":
    rep = convert(sys.argv[1], sys.argv[2])
    print(rep)
