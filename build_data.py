#!/usr/bin/env python3
"""Build data/rules.json and data/rules.js from data/rules.csv and data/answer-options.json.

    python scripts/build_data.py          write the generated files
    python scripts/build_data.py --check  fail if the data is invalid or the generated files are stale

Only rules whose "Verification status" is "verified" are shipped.
"""
import csv
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CSV_PATH = DATA / "rules.csv"
OPTIONS_PATH = DATA / "answer-options.json"
JSON_PATH = DATA / "rules.json"
JS_PATH = DATA / "rules.js"

OUTCOMES = {"ok", "gap", "unsure", "applies", "na"}
STANDARD_ANSWERS = [
    {"value": "yes", "label": "Yes", "outcome": "ok"},
    {"value": "no", "label": "No", "outcome": "gap"},
    {"value": "unsure", "label": "Not sure", "outcome": "unsure"},
]
CSV_COLUMNS = {
    "ID": "id",
    "Question": "question",
    "Obligation if the answer is No": "obligation",
    "Source": "source",
    "Plain-language action": "action",
    "Expected phase": "phase",
    "Verification status": "status",
    "Last reviewed": "reviewed",
}


def parse_date(text):
    text = text.strip()
    for fmt in ("%B %d, %Y", "%Y-%m-%d", "%d %B %Y"):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"cannot read date {text!r}")


def human(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def build():
    problems = []
    warnings = []

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in CSV_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            return None, [f"rules.csv is missing columns: {', '.join(missing)}"], warnings
        rows = list(reader)

    options = json.loads(OPTIONS_PATH.read_text(encoding="utf-8"))
    overlay = options.get("rules", {})
    meta = dict(options.get("meta", {}))

    seen = set()
    rules = []
    dates = []
    for n, raw in enumerate(rows, start=2):
        row = {CSV_COLUMNS[k]: (raw.get(k) or "").strip() for k in CSV_COLUMNS}
        rid = row["id"]
        where = f"rules.csv line {n} ({rid or 'no id'})"
        if not rid:
            problems.append(f"{where}: empty ID")
            continue
        if rid in seen:
            problems.append(f"{where}: duplicate ID")
            continue
        seen.add(rid)

        if row["status"].lower() != "verified":
            warnings.append(f"{rid} is '{row['status'] or 'blank'}', not verified: left out of the build")
            continue

        for field in ("question", "obligation", "source", "action", "phase", "reviewed"):
            if not row[field]:
                problems.append(f"{where}: empty '{field}'")

        extra = overlay.get(rid)
        if extra is None:
            problems.append(f"{where}: no entry in answer-options.json")
            continue
        for field in ("cite", "short"):
            if not extra.get(field):
                problems.append(f"{where}: answer-options.json needs '{field}'")

        try:
            reviewed = parse_date(row["reviewed"])
            dates.append(reviewed)
        except ValueError as err:
            problems.append(f"{where}: {err}")
            reviewed = None

        answers = extra.get("answers") or STANDARD_ANSWERS
        values = [a.get("value") for a in answers]
        if len(set(values)) != len(values):
            problems.append(f"{where}: duplicate answer values")
        for a in answers:
            if a.get("outcome") not in OUTCOMES:
                problems.append(f"{where}: answer {a.get('value')!r} has unknown outcome {a.get('outcome')!r}")
            if not a.get("label"):
                problems.append(f"{where}: answer {a.get('value')!r} has no label")
        unsure = [a for a in answers if a.get("value") == "unsure"]
        if not unsure or unsure[0].get("outcome") != "unsure":
            problems.append(f"{where}: needs an answer with value 'unsure' and outcome 'unsure'")

        notes = extra.get("outcome_notes", {})
        for key in notes:
            if key not in OUTCOMES:
                problems.append(f"{where}: outcome_notes has unknown outcome {key!r}")

        rules.append({
            "id": rid,
            "cite": extra.get("cite", ""),
            "short": extra.get("short", ""),
            "question": row["question"],
            "hint": extra.get("hint", ""),
            "answers": answers,
            "obligation": row["obligation"],
            "action": row["action"],
            "outcome_notes": {k: (row["action"] if v == "$action" else v) for k, v in notes.items()},
            "source": row["source"],
            "phase": row["phase"],
            "reviewed": reviewed.isoformat() if reviewed else "",
            "reviewed_human": human(reviewed) if reviewed else "",
        })

    for rid in overlay:
        if rid not in seen:
            problems.append(f"answer-options.json has '{rid}' but rules.csv has no such ID")
    if not rules:
        problems.append("no verified rules to ship")

    latest = max(dates) if dates else None
    meta["data_reviewed"] = latest.isoformat() if latest else ""
    meta["data_reviewed_human"] = human(latest) if latest else ""
    meta["rule_count"] = len(rules)
    return {"meta": meta, "rules": rules}, problems, warnings


def render(payload):
    as_json = json.dumps(payload, indent=2, ensure_ascii=True) + "\n"
    compact = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    as_js = "// Generated by scripts/build_data.py. Do not edit by hand.\nwindow.DPDP_DATA = " + compact + ";\n"
    return as_json, as_js


def main():
    check = "--check" in sys.argv[1:]
    payload, problems, warnings = build()
    for w in warnings:
        print("warning:", w)
    if problems:
        for p in problems:
            print("error:", p)
        sys.exit(1)

    as_json, as_js = render(payload)
    if check:
        stale = [p.name for p, text in ((JSON_PATH, as_json), (JS_PATH, as_js))
                 if not p.exists() or p.read_text(encoding="utf-8") != text]
        if stale:
            print("error: out of date:", ", ".join(stale), "- run python scripts/build_data.py")
            sys.exit(1)
        print(f"ok: {payload['meta']['rule_count']} verified rules, generated files are current")
        return

    JSON_PATH.write_text(as_json, encoding="utf-8")
    JS_PATH.write_text(as_js, encoding="utf-8")
    print(f"wrote {JSON_PATH.name} and {JS_PATH.name}: {payload['meta']['rule_count']} verified rules, "
          f"last reviewed {payload['meta']['data_reviewed_human']}")


if __name__ == "__main__":
    main()
