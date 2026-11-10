#!/usr/bin/env python3
"""한국어 원문을 기준으로 번역 문서의 구조와 실행 예제를 검사합니다."""

import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LOCALES = ("en", "ja", "zh-Hans", "zh-Hant")
FENCE = re.compile(r"^```([^\n]*)\n([\s\S]*?)^```[ \t]*$", re.MULTILINE)
DECORATION = re.compile(r"[·•ㆍ∙⋅・‧✅❌✓]")
EXECUTABLE = {"go", "sh", "bash", "shell", "powershell", "sql", "json", "toml", "js", "javascript", "ts", "typescript", "makefile"}


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def headings(text):
    text = FENCE.sub("", text)
    return [len(m[1]) for m in re.finditer(r"^(#{1,6})\s+", text, re.MULTILINE)]


def explicit_anchors(text):
    return re.findall(r"\{#([^}]+)\}", FENCE.sub("", text))


def link_destinations(text):
    text = re.sub(r"`[^`]*`", "", FENCE.sub("", text))
    links = re.findall(r"\[[^\]]*\]\(([^\s)]+)", text)
    # 번역된 제목의 자동 섹션 ID는 빌드 결과에서 별도로 검사합니다.
    return [re.sub(r"^/(?:ko|en|ja|zh-Hans|zh-Hant)/", "/LOCALE/", link.split("#", 1)[0]) for link in links]


def example_code(language, code):
    """문자열과 지시문은 보존하고 번역 가능한 Go, 셸 주석만 분리합니다."""
    if language not in {"go", "sh", "bash", "shell"}:
        return code, []
    output, comments = [], []
    position, quote = 0, None
    shell = language != "go"
    # heredoc 본문은 셸 주석이 아닌 입력 데이터이므로 블록 전체를 엄격히 비교합니다.
    if shell and re.search(r"(?<!<)<<-?[ \t]*(?!<)", code):
        return code, []
    while position < len(code):
        char = code[position]
        if quote:
            output.append(char)
            position += 1
            if char == "\\" and quote != "`" and not (shell and quote == "'") and position < len(code):
                output.append(code[position])
                position += 1
            elif char == quote:
                quote = None
            continue
        if char in "\"'`":
            quote = char
        elif char == "\\" and shell and position + 1 < len(code):
            output.extend(code[position:position + 2])
            position += 2
            continue
        elif (not shell and code.startswith("//", position)) or (shell and char == "#" and (position == 0 or code[position - 1].isspace())):
            end = code.find("\n", position)
            if end == -1:
                end = len(code)
            comment = code[position + (1 if shell else 2):end]
            comments.append(comment)
            directive = comment.strip()
            if not shell and directive.startswith("@"):
                # Swaggo 매개변수의 이름, 출처, 타입과 필수 여부는 계속 비교합니다.
                if directive.startswith("@Param "):
                    directive = re.sub(r'"(?:\\.|[^"\\])*"', '"DESCRIPTION"', directive, count=1)
                output.append("// " + directive)
            elif not shell and re.match(r"(?:go:|line\s|\+build\b|nolint\b|lint:|Code generated\b|SPDX-)", directive):
                output.append("//" + comment)
            position = end
            continue
        elif not shell and code.startswith("/*", position):
            end = code.find("*/", position + 2)
            if end == -1:
                end = len(code)
            else:
                end += 2
            comment = code[position:end]
            comments.append(comment)
            output.append(comment if comment.startswith("/*line ") else " " + "\n" * comment.count("\n"))
            position = end
            continue
        output.append(char)
        position += 1
    return "\n".join(line.rstrip() for line in "".join(output).splitlines()), comments


def protected_blocks(text):
    return [(m[1].strip(), example_code(m[1].strip(), m[2])[0]) for m in FENCE.finditer(text) if m[1].strip() in EXECUTABLE]


def localized_blocks_match(source, translated, locale):
    """Only the explicitly mapped example text may vary between locales."""
    localizations = json.loads((ROOT / "scripts/example-localizations.json").read_text(encoding="utf-8"))[locale]
    expected = []
    for language, code in protected_blocks(source):
        for original, replacement in sorted(localizations.items(), key=lambda item: len(item[0]), reverse=True):
            code = code.replace(original, replacement)
        expected.append((language, code))
    return expected == protected_blocks(translated)


def untranslated_comments(text):
    return [comment for match in FENCE.finditer(text)
            for comment in example_code(match[1].strip(), match[2])[1]
            if re.search(r"[가-힣]", comment)]


def fence_kinds(text):
    return [m[1].strip() for m in FENCE.finditer(text)]


def table_shape(text):
    text = FENCE.sub("", text)
    result = []
    for line in text.splitlines():
        if line.strip().startswith("|"):
            line = re.sub(r"`[^`]*`", "CODE", line)
            result.append(len(re.split(r"(?<!\\)\|", line)))
    return result


def page_structure(text):
    keys, fixed_values = [], []
    if text.startswith("---\n"):
        frontmatter = text.split("\n---", 1)[0]
        for line in frontmatter.splitlines():
            match = re.match(r"^(\s*)(-\s+)?([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
            if match:
                keys.append((len(match[1]), bool(match[2]), match[3]))
                if match[3] in {"layout", "sidebar", "outline", "theme"}:
                    fixed_values.append((match[3], match[4].strip("\"'")))
    directives = re.findall(r"^:::[ \t]*([a-zA-Z]*)", FENCE.sub("", text), re.MULTILINE)
    return keys, fixed_values, directives


def prepare(locale, paths, destination):
    files = []
    for path in paths:
        source = (ROOT / path).resolve()
        relative = source.relative_to(DOCS / "ko")
        text = source.read_text(encoding="utf-8")
        blocks = []

        def protect(match):
            if match[1].strip() not in EXECUTABLE:
                return match[0]
            localizations = json.loads((ROOT / "scripts/example-localizations.json").read_text(encoding="utf-8"))[locale]
            if untranslated_comments(match[0]) or any(original in match[2] for original in localizations):
                return match[0]
            marker = f"<!-- SPINE_CODE_{len(blocks):03d} -->"
            blocks.append({"marker": marker, "text": match[0]})
            return marker

        draft = FENCE.sub(protect, text).replace("/ko/", f"/{locale}/")
        files.append({"source": str(source.relative_to(ROOT)), "target": str((DOCS / locale / relative).relative_to(ROOT)), "source_sha256": digest(text), "protected": blocks, "draft": draft})
    Path(destination).write_text(json.dumps({"locale": locale, "files": files}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_bundle(path):
    bundle = json.loads(Path(path).read_text(encoding="utf-8"))
    for item in bundle["files"]:
        source = (ROOT / item["source"]).read_text(encoding="utf-8")
        if digest(source) != item["source_sha256"]:
            raise ValueError(f"한국어 원문이 바뀌었습니다: {item['source']}")
        translated = item["translation"]
        for block in item["protected"]:
            if translated.count(block["marker"]) != 1:
                raise ValueError(f"예제 위치 표시자가 빠졌거나 중복됐습니다: {item['target']} {block['marker']}")
            translated = translated.replace(block["marker"], block["text"])
        if headings(source) != headings(translated):
            raise ValueError(f"제목 구조가 한국어와 다릅니다: {item['target']}")
        if explicit_anchors(source) != explicit_anchors(translated):
            raise ValueError(f"고정 섹션 ID가 한국어와 다릅니다: {item['target']}")
        if link_destinations(source) != link_destinations(translated):
            raise ValueError(f"링크 대상이나 순서가 한국어와 다릅니다: {item['target']}")
        if not localized_blocks_match(source, translated, bundle["locale"]):
            raise ValueError(f"실행 예제가 한국어와 다릅니다: {item['target']}")
        if untranslated_comments(translated):
            raise ValueError(f"코드 설명 주석에 한국어가 남아 있습니다: {item['target']}")
        if fence_kinds(source) != fence_kinds(translated) or table_shape(source) != table_shape(translated):
            raise ValueError(f"코드 블록이나 표의 구조가 한국어와 다릅니다: {item['target']}")
        if page_structure(source) != page_structure(translated):
            raise ValueError(f"페이지 설정이나 안내 블록이 한국어와 다릅니다: {item['target']}")
        target = ROOT / item["target"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(translated.rstrip() + "\n", encoding="utf-8")
        print(f"적용: {item['target']}")


def check():
    errors = []
    sources = sorted((DOCS / "ko").rglob("*.md"))
    expected = {p.relative_to(DOCS / "ko") for p in sources}
    for locale in LOCALES:
        actual = {p.relative_to(DOCS / locale) for p in (DOCS / locale).rglob("*.md")}
        for path in sorted(expected - actual):
            errors.append(f"{locale}/{path}: 번역 파일 없음")
        for path in sorted(actual - expected):
            errors.append(f"{locale}/{path}: 대응하는 한국어 원문 없음")
        for source in sources:
            target = DOCS / locale / source.relative_to(DOCS / "ko")
            if not target.exists():
                continue
            original, translated = source.read_text(encoding="utf-8"), target.read_text(encoding="utf-8")
            if headings(original) != headings(translated):
                errors.append(f"{target.relative_to(ROOT)}: 제목 구조 불일치")
            if explicit_anchors(original) != explicit_anchors(translated):
                errors.append(f"{target.relative_to(ROOT)}: 고정 섹션 ID 불일치")
            if link_destinations(original) != link_destinations(translated):
                errors.append(f"{target.relative_to(ROOT)}: 링크 대상 또는 순서 불일치")
            if not localized_blocks_match(original, translated, locale):
                errors.append(f"{target.relative_to(ROOT)}: 실행 예제 불일치")
            if untranslated_comments(translated):
                errors.append(f"{target.relative_to(ROOT)}: 코드 설명 주석에 한국어가 남아 있음")
            if fence_kinds(original) != fence_kinds(translated) or table_shape(original) != table_shape(translated):
                errors.append(f"{target.relative_to(ROOT)}: 코드 블록 또는 표 구조 불일치")
            if page_structure(original) != page_structure(translated):
                errors.append(f"{target.relative_to(ROOT)}: 페이지 설정 또는 안내 블록 불일치")
    for locale in ("ko", *LOCALES):
        for path in (DOCS / locale).rglob("*.md"):
            text = path.read_text(encoding="utf-8")
            if DECORATION.search(text):
                errors.append(f"{path.relative_to(ROOT)}: 장식용 기호가 남아 있음")
            if re.search(r"--json\b|--if-match\b|result\.(?:base_hash|changes|diff)", text):
                errors.append(f"{path.relative_to(ROOT)}: 사람용 문서에 에이전트 옵션이 남아 있음")
    for error in errors:
        print(error)
    if errors:
        raise SystemExit(1)
    print(f"한국어 {len(sources)}개, 번역 {len(sources) * len(LOCALES)}개: 구조와 실행 예제 일치")


class PageLinks(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if attributes.get("id"):
            self.ids.add(attributes["id"])
        if tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"])


def check_rendered(locales):
    directory = DOCS / ".vitepress" / "dist"
    pages = {p.resolve(): PageLinks(p.read_text(encoding="utf-8")) for p in directory.rglob("*.html")}
    errors = []
    checked = 0
    for path, page in pages.items():
        relative = path.relative_to(directory.resolve())
        if not relative.parts or relative.parts[0] not in locales:
            continue
        for href in page.links:
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            if url.path.startswith("/"):
                target = directory / unquote(url.path.lstrip("/"))
            elif url.path:
                target = path.parent / unquote(url.path)
            else:
                target = path
            if target.is_dir():
                target = target / "index.html"
            elif not target.suffix:
                target = target.with_suffix(".html")
            target = target.resolve()
            if not target.exists():
                errors.append(f"{relative}: 경로 없음 {href}")
                continue
            if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                errors.append(f"{relative}: 섹션 없음 {href}")
            checked += 1
    for error in sorted(set(errors)):
        print(error)
    if errors:
        raise SystemExit(1)
    print(f"렌더링된 문서의 내부 링크 {checked}개: 경로와 섹션 확인")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", choices=LOCALES)
    parser.add_argument("--bundle")
    parser.add_argument("--apply")
    parser.add_argument("--check-rendered", action="store_true")
    parser.add_argument("--locales", nargs="+", choices=("ko", *LOCALES), default=("ko", *LOCALES))
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()
    if args.check_rendered:
        check_rendered(args.locales)
    elif args.prepare:
        if not args.bundle or not args.paths:
            parser.error("--prepare에는 --bundle 경로와 한국어 문서 경로가 필요합니다")
        prepare(args.prepare, args.paths, args.bundle)
    elif args.apply:
        apply_bundle(args.apply)
    else:
        check()
