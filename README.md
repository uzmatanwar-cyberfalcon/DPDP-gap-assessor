# DPDP Gap Assessor

A free, open-source tool for Indian startups. Answer 13 questions about how you handle personal data and get a gap report against the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025. Every finding names the section behind it and says what to do next.

**Privacy by design:** it runs entirely in your browser. No server, no accounts, no analytics, no external fonts or scripts, nothing stored. Your answers never leave your device.

## What it is not

- It is **not legal advice** and it does **not certify compliance**. It is a preparation aid. The Act and Rules are the authority.
- It covers **13 core duties**, not the whole law. Exact deadlines and formats (for example for breach reports) are in the Rules, so check them.
- A clean report does not mean you are compliant. It means nothing in your answers triggered a gap in these 13 checks.
- Most core duties are expected to apply from **May 2027**. Each finding shows the expected phase from the rules data.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

To share a single file, run `python scripts/make_standalone.py` and use `dist/dpdp-gap-assessor.html`.

## The rules data

The rules live in `data/rules.csv`: one row per duty, with the question, what the Act asks, the source provision, a plain-language action, the expected phase, a verification status and the date last reviewed. `data/answer-options.json` adds the short citation, a short title and, where a plain Yes/No does not fit (for example "Do you process children's data?"), the answer options and what each one means.

`python scripts/build_data.py` turns these into `data/rules.json` and `data/rules.js`, which the page loads.

**Rule of the project: nothing ships until it is verified.** Rows whose status is not `verified` are left out of the build. To add or change a rule:

1. Read the provision in the official text. Write the summary in your own words and cite the section.
2. Edit the row in `data/rules.csv`, and set the status and review date.
3. Add or update its entry in `data/answer-options.json`.
4. Run `python scripts/build_data.py`, then commit the generated files.

`python scripts/build_data.py --check` fails on bad data or stale generated files. The GitHub Action in `.github/workflows/check.yml` runs it on every push.

## Optional: ratings and feedback

Both are off until you fill them in, so forks of this project send nothing by default.

- **Rating screen:** a skippable 1 to 5 rating shown after the last question and before the report. It asks how clear the questions were, and can also ask for a role and a comment. It sends only those fields to **your** Google Form. It never sends the user's answers. To turn it on, create a Google Form with a 1 to 5 linear scale question (and, if you want them, a multiple-choice role question with these exact options: Founder or co-founder, Works at a startup, Lawyer or consultant, Student, Other, plus a short-answer comment question), then fill in the `rating` block in `site-config.js`.
- **Feedback link:** `feedbackUrl` in `site-config.js` adds a link under the report and in the footer.

Ratings from a public page can be spoofed, because anyone can read the form address in the page source and post to it. Treat the numbers as indicative, not as proof, and keep named testimonials for anything you need to be able to verify.

If the rating screen is on, the page makes a network request only when someone chooses to send a rating. The privacy wording on the intro, rating and footer text changes to match.

## Hosting

Host it free on GitHub Pages (Settings, Pages, deploy from the `main` branch, root folder). No cloud account is needed and there is nothing to pay for. Anyone can also fork it and host it themselves.

## Licence and credit

- Code: Apache-2.0. Add the licence text as `LICENSE` (GitHub offers it as a template when you add a file). Keep the `NOTICE` file, which carries the author credit.
- Rules data (`data/`): CC BY 4.0. Reuse requires credit to the author. See `data/LICENSE.md`.

Before publishing, replace `[Your name]` in `NOTICE` and `data/LICENSE.md`, and fill `author` and `repoUrl` in `site-config.js`. A plain text editor is enough; you do not need to run anything.

## Roadmap

- Map each finding to security controls (ISO 27001, SOC 2 style).
- A retention schedule helper for common records such as job applicants' CVs.
- AI-governance checks.
