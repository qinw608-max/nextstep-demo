#!/usr/bin/env python3
"""Read-only checks for this static site; requires Python 3 and Node.js.

Checks declared HTML/CSS references, static anchors, the eight literal scenario
definitions, and JavaScript syntax. Does not execute pages, contact the network,
parse arbitrary dynamic JavaScript URLs, or establish browser/visual correctness.
"""

import argparse
from collections import Counter
from html.parser import HTMLParser
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import unquote, urlsplit


DEMOS = tuple(f"demo-{name}.html" for name in (
    "scan", "sync", "edit", "live-edit", "annotate", "agent", "collapse", "template"
))
BASES = ("/", "/nextstep-demo/")
JS_TYPES = {"", "module", "text/javascript", "application/javascript",
            "text/ecmascript", "application/ecmascript"}
CSS_URL = re.compile(r"url\s*\(\s*(?:([\"'])(.*?)\1|([^)]*?))\s*\)", re.I | re.S)
IGNORED = {".git", "node_modules", ".venv", "__pycache__"}


def css_references(source, line=1):
    source = re.sub(r"/\*.*?\*/", lambda m: "\n" * m[0].count("\n"), source, flags=re.S)
    for match in CSS_URL.finditer(source):
        yield ((match[2] if match[1] else match[3]).strip(),
               line + source.count("\n", 0, match.start()), "CSS url")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.proofs, self.scripts = [], [], []
        self.ids, self.block, self.chunks = set(), None, []
        self.has_base = False

    def handle_starttag(self, tag, attributes):
        attrs, line = dict(attributes), self.getpos()[0]
        if attrs.get("id") is not None:
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name") is not None:
            self.ids.add(attrs["name"])
        for key in ("href", "src", "data-proof-file"):
            if attrs.get(key) is not None:
                self.refs.append((attrs[key], line, key))
        if "data-proof-file" in attrs:
            self.proofs.append(attrs["data-proof-file"] or "")
        if attrs.get("style"):
            self.refs.extend(css_references(attrs["style"], line))
        if tag == "base" and "href" in attrs:
            self.has_base = True
        if tag in {"script", "style"}:
            self.block = (tag, line, attrs)
            self.chunks = []

    def handle_data(self, data):
        if self.block:
            self.chunks.append(data)

    def handle_endtag(self, tag):
        if not self.block or self.block[0] != tag:
            return
        _, line, attrs = self.block
        source = "".join(self.chunks)
        if tag == "style":
            self.refs.extend(css_references(source, line))
        elif "src" not in attrs:
            kind = (attrs.get("type") or "").split(";", 1)[0].strip().lower()
            if kind in JS_TYPES:
                self.scripts.append((source, line, kind == "module"))
        self.block, self.chunks = None, []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="static document root (default: repository root)")
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    if not root.is_dir():
        parser.exit(1, "ERROR: --root must be an existing directory\n")
    errors, pages, references, scripts = [], {}, [], []
    css_count = 0

    def error(path, message, line=None):
        label = str(path.relative_to(root))
        errors.append(f"{label}{':' + str(line) if line else ''}: {message}")

    def within_root(path):
        try:
            path.resolve().relative_to(root)
            return True
        except (ValueError, OSError, RuntimeError):
            return False

    def read(path):
        if not within_root(path):
            error(path, "source escapes document root")
            return None
        try:
            return path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            error(path, "cannot read UTF-8 source")
            return None

    for path in sorted(root.rglob("*")):
        if IGNORED.intersection(path.relative_to(root).parts) or not path.is_file():
            continue
        if path.suffix.lower() not in {".html", ".htm", ".css"}:
            continue
        source = read(path)
        if source is None:
            continue
        if path.suffix.lower() == ".css":
            css_count += 1
            references.extend((path, *ref) for ref in css_references(source))
            continue
        page = Page()
        page.feed(source)
        page.close()
        pages[path.resolve()] = page
        references.extend((path, *ref) for ref in page.refs)
        scripts.extend((path, *script) for script in page.scripts)
        if page.has_base:
            error(path, "HTML <base href> is unsupported; URL checks require the document URL")

    for name in DEMOS:
        if not (root / name).is_file():
            error(root / name, "required demo is missing")
    interactive = root / "interactive.html"
    page = pages.get(interactive.resolve())
    if page is None:
        error(interactive, "required interaction entry is missing or unreadable")
    else:
        if Counter(page.proofs) != Counter(DEMOS):
            error(interactive, "data-proof-file must contain each of the 8 demos exactly once")
        arrays = []
        for source, line, _ in page.scripts:
            for match in re.finditer(r"\b(?:const|let|var)\s+demos\s*=\s*\[(.*?)\]\s*;", source, re.S):
                entries = list(re.finditer(r"\bfile\s*:\s*(['\"])([^'\"]+)\1", match[1]))
                arrays.append([entry[2] for entry in entries])
                for entry in entries:
                    offset = match.start(1) + entry.start()
                    references.append((interactive, entry[2], line + source.count("\n", 0, offset), "demos file"))
        if len(arrays) != 1 or Counter(arrays[0]) != Counter(DEMOS):
            error(interactive, "the literal demos array must contain each of the 8 demos exactly once")

    local_checks = 0
    for source, value, line, kind in references:
        try:
            url = urlsplit(value.strip())
            if url.scheme or url.netloc:
                continue
            path, fragment = unquote(url.path, errors="strict"), unquote(url.fragment, errors="strict")
        except (ValueError, UnicodeError):
            error(source, f"invalid {kind} URL", line)
            continue
        if "\\" in path or "\x00" in path:
            error(source, f"unsupported or invalid {kind} path", line)
            continue
        for base in BASES:
            local_checks += 1
            prefix = f"{kind} [base {base}]"
            if path.startswith("/"):
                if base != "/" and not (path.startswith(base) or path == base.rstrip("/")):
                    error(source, f"{prefix} leaves the deployment subdirectory", line)
                    continue
                pieces = path[len(base):].split("/")
                stack = []
            elif path:
                pieces = path.split("/")
                stack = list(source.relative_to(root).parent.parts)
            else:
                pieces, stack = [], list(source.relative_to(root).parts)
            escaped = False
            for part in pieces:
                if part == "..":
                    if not stack:
                        escaped = True
                        break
                    stack.pop()
                elif part not in {"", "."}:
                    stack.append(part)
            target = root.joinpath(*stack)
            if escaped or not within_root(target):
                error(source, f"{prefix} escapes document root", line)
                continue
            if target.is_dir():
                target /= "index.html"
            if not within_root(target):
                error(source, f"{prefix} escapes document root", line)
            elif not target.is_file():
                error(source, f"{prefix} missing file: {target.relative_to(root)}", line)
            elif fragment and target.suffix.lower() in {".html", ".htm"}:
                anchor = fragment.split(":~:", 1)[0]
                destination = pages.get(target.resolve())
                if anchor and (destination is None or anchor not in destination.ids):
                    error(source, f"{prefix} missing HTML anchor in {target.relative_to(root)}", line)

    root_js = sorted(root.glob("*.js"))
    for path in root_js:
        source = read(path)
        if source is not None:
            scripts.append((path, source, 1, False))
    node = shutil.which("node")
    checked_js = 0
    if not node:
        errors.append("JavaScript: Node.js is required for node --check; no syntax checks were run")
    else:
        env = dict(os.environ)
        env.pop("NODE_OPTIONS", None)
        for path, source, line, module in scripts:
            command = [node, "--check", "--input-type=" + ("module" if module else "commonjs")]
            try:
                result = subprocess.run(command, input=source, text=True, capture_output=True,
                                        timeout=15, env=env, cwd=root)
                checked_js += 1
                if result.returncode:
                    match = re.search(r"(?:\[stdin\]|\[eval\d*\]):(\d+)", result.stderr)
                    at = line + int(match[1]) - 1 if match else line
                    error(path, "JavaScript syntax check failed (source text suppressed)", at)
            except (OSError, subprocess.TimeoutExpired):
                error(path, "unable to complete node --check", line)

    status = "FAIL" if errors else "PASS"
    print(f"{status}: {len(pages)} HTML, {css_count} CSS, {local_checks} local reference checks "
          f"across {len(BASES)} bases, {checked_js} JavaScript syntax checks, 8 expected demos")
    for message in errors:
        print("ERROR: " + message)
    print("Scope: declared HTML/CSS URLs, static anchors, literal demos array; "
          "no network, page execution, dynamic JS URL analysis, or visual checks.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
