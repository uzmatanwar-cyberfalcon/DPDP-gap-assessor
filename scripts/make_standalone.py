#!/usr/bin/env python3
"""Inline the CSS, data and JS into one file: dist/dpdp-gap-assessor.html (handy for sharing or previewing)."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")


def swap(tag, replacement):
    global html
    if tag not in html:
        raise SystemExit(f"tag not found in index.html: {tag}")
    html = html.replace(tag, replacement)


def script_safe(text):
    return text.replace("</script", "<\\/script")


css = (ROOT / "assets" / "style.css").read_text(encoding="utf-8")
data = (ROOT / "data" / "rules.js").read_text(encoding="utf-8")
app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
site = (ROOT / "site-config.js").read_text(encoding="utf-8")

swap('<link rel="stylesheet" href="assets/style.css">', f"<style>\n{css}</style>")
swap('<script src="data/rules.js"></script>', f"<script>\n{script_safe(data)}</script>")
swap('<script src="site-config.js"></script>', f"<script>\n{script_safe(site)}</script>")
swap('<script src="assets/app.js"></script>', f"<script>\n{script_safe(app)}</script>")

out = ROOT / "dist" / "dpdp-gap-assessor.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print("wrote", out.relative_to(ROOT), f"({out.stat().st_size // 1024} KB)")
