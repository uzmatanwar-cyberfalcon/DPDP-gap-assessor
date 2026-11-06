/* DPDP Gap Assessor: no framework, no network requests, nothing stored. */
(() => {
  'use strict';

  const root = document.getElementById('app');
  const foot = document.getElementById('foot');
  const D = window.DPDP_DATA;
  const SITE = window.DPDP_SITE || {};
  // The rating screen exists only when a form is configured in site-config.js.
  const RATING = SITE.rating && SITE.rating.formUrl && SITE.rating.ratingField ? SITE.rating : null;
  // These must match the options of the "role" question in the author's form exactly.
  const ROLES = ['Founder or co-founder', 'Works at a startup', 'Lawyer or consultant', 'Student', 'Other'];

  if (!D || !Array.isArray(D.rules) || D.rules.length === 0) {
    root.append(h('p', { class: 'fail' }, 'The rules data did not load. Run python scripts/build_data.py, then reload this page.'));
    return;
  }

  const RULES = D.rules;
  const TOTAL = RULES.length;

  const OUT = {
    gap:     { group: 'Fix first',                label: 'Gap',            glyph: '!' },
    unsure:  { group: 'Find out where you stand', label: 'Not sure',       glyph: '?' },
    applies: { group: 'Applies to you',           label: 'Applies to you', glyph: 'i' },
    ok:      { group: 'In place',                 label: 'In place',       glyph: '✓' },
    na:      { group: 'Doesn’t apply right now', label: 'Not applicable', glyph: '–' },
  };
  const ORDER = ['gap', 'unsure', 'applies', 'ok', 'na'];
  const COLLAPSED = new Set(['ok', 'na']);

  const state = { screen: 'intro', i: 0, answers: {}, rated: false, ratingSent: false, ratingFailed: false };

  /* ---------- helpers ---------- */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid);
    }
    return el;
  }

  const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function resultFor(rule) {
    const value = state.answers[rule.id] || 'unsure';
    const answer = rule.answers.find((a) => a.value === value) || rule.answers.find((a) => a.value === 'unsure');
    return { rule, answer, outcome: answer.outcome };
  }

  function nextStep(rule, outcome) {
    const note = rule.outcome_notes && rule.outcome_notes[outcome];
    if (note) return note;
    if (outcome === 'ok') return 'Keep a dated record of how you meet this, such as a screenshot, a policy or a signed contract.';
    if (outcome === 'na') return 'Nothing to do for now. Check again if your product or data practices change.';
    if (outcome === 'unsure') return `Find out where you stand, then act. ${rule.action}`;
    return rule.action;
  }

  function tally(results) {
    const c = { gap: 0, unsure: 0, applies: 0, ok: 0, na: 0 };
    results.forEach((r) => { c[r.outcome] += 1; });
    return c;
  }

  function summarySentence(c) {
    const parts = [];
    if (c.gap) parts.push(plural(c.gap, 'gap', 'gaps'));
    if (c.unsure) parts.push(`${c.unsure} to find out`);
    if (c.applies) parts.push(`${c.applies} that ${c.applies === 1 ? 'applies' : 'apply'} to you`);
    if (c.ok) parts.push(`${c.ok} in place`);
    if (c.na) parts.push(`${c.na} that ${c.na === 1 ? 'doesn’t' : 'don’t'} apply right now`);
    const last = parts.pop();
    const list = parts.length ? `${parts.join(', ')} and ${last}` : last;
    return `Of ${TOTAL} checks: ${list}.`;
  }

  /* ---------- navigation ---------- */

  function go(screen, i) {
    state.screen = screen;
    if (i != null) state.i = i;
    render();
  }

  function render() {
    const screens = { intro: introScreen, ask: askScreen, rate: rateScreen, report: reportScreen };
    root.replaceChildren(screens[state.screen]());
    const name = D.meta.title;
    document.title = state.screen === 'ask'
      ? `Question ${state.i + 1} of ${TOTAL} – ${name}`
      : state.screen === 'report' ? `Gap report – ${name}`
      : state.screen === 'rate' ? `Rate this tool – ${name}` : name;
    window.scrollTo(0, 0);
    const target = root.querySelector('[data-focus]');
    if (target) target.focus({ preventScroll: true });
  }

  /* ---------- screens ---------- */

  function introScreen() {
    return h('div', {},
      h('section', { class: 'row hero' },
        h('div', { class: 'margin' }, 'Act 22 of 2023'),
        h('div', { class: 'body' },
          h('h1', { class: 'title', tabindex: '-1', 'data-focus': '' }, 'Where does your startup stand on India’s data protection law?'),
          h('p', { class: 'lead' }, `Answer ${TOTAL} questions about how you handle personal data. You get a gap report that names the section of the DPDP Act behind each point and says what to do next.`),
          h('p', { class: 'lead' }, 'The DPDP Rules were notified in November 2025. Most core duties are expected to start in May 2027, so there is time to prepare.'),
          h('div', { class: 'actions' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => go('ask', 0) }, 'Start the check')),
          h('p', { class: 'fine' }, 'Runs in your browser. Your answers are not sent or saved anywhere. This is a preparation aid, not legal advice.'
            + (RATING ? ' If you choose to rate the tool, only your rating and anything you type with it are sent.' : '')))),
      h('section', { class: 'row sechead' },
        h('div', { class: 'margin' }),
        h('div', { class: 'body' }, h('h2', { class: 'sub' }, 'What the check covers'))),
      h('ul', { class: 'index' },
        RULES.map((r) => h('li', { class: 'row' },
          h('span', { class: 'margin' }, r.cite),
          h('span', { class: 'body' }, r.short)))));
  }

  function askScreen() {
    const rule = RULES[state.i];
    const qid = `q-${rule.id}`;
    const isLast = state.i === TOTAL - 1;

    const next = h('button', {
      id: 'next', class: 'btn primary', type: 'button', disabled: !state.answers[rule.id],
      onclick: () => {
        if (!state.answers[rule.id]) return;
        if (!isLast) go('ask', state.i + 1);
        else if (RATING && !state.rated) go('rate');
        else go('report');
      },
    }, isLast ? 'See the gap report' : 'Next question');

    const opts = h('fieldset', { class: 'opts', 'aria-labelledby': qid });
    rule.answers.forEach((a) => {
      opts.append(h('label', { class: 'opt' },
        h('input', {
          type: 'radio', name: 'answer', value: a.value, checked: state.answers[rule.id] === a.value,
          onchange: () => { state.answers[rule.id] = a.value; next.disabled = false; },
        }),
        h('span', {}, a.label)));
    });

    return h('section', { class: 'row ask' },
      h('div', { class: 'margin' }, rule.cite),
      h('div', { class: 'body' },
        h('p', { class: 'progress' }, `Question ${state.i + 1} of ${TOTAL}`),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progress', 'aria-valuemin': '1', 'aria-valuemax': String(TOTAL), 'aria-valuenow': String(state.i + 1) },
          h('span', { style: `width:${((state.i + 1) / TOTAL) * 100}%` })),
        h('h2', { class: 'q', id: qid, tabindex: '-1', 'data-focus': '' }, rule.question),
        rule.hint ? h('p', { class: 'hint' }, rule.hint) : null,
        opts,
        h('details', { class: 'asks' },
          h('summary', {}, 'What the Act asks'),
          h('p', {}, rule.obligation),
          h('p', { class: 'src' }, `${rule.source}.`)),
        h('div', { class: 'nav' },
          h('button', { class: 'link-btn', type: 'button', onclick: () => (state.i > 0 ? go('ask', state.i - 1) : go('intro')) }, 'Back'),
          next)));
  }

  function rateScreen() {
    let score = 0;
    const host = (() => { try { return new URL(RATING.formUrl).hostname; } catch (e) { return 'the author’s form'; } })();

    const status = h('p', { class: 'fine', role: 'status' });
    const send = h('button', { class: 'btn primary', type: 'button', disabled: true }, 'Send rating and see my report');
    const skip = h('button', { class: 'btn', type: 'button', onclick: () => { state.rated = true; go('report'); } }, 'Skip and see my report');

    const scale = h('fieldset', { class: 'scale', 'aria-labelledby': 'rt-q' });
    for (let n = 1; n <= 5; n += 1) {
      scale.append(h('label', { class: 'pick' },
        h('input', { type: 'radio', name: 'score', value: String(n), onchange: () => { score = n; send.disabled = false; } }),
        h('span', {}, String(n))));
    }

    const role = RATING.roleField
      ? h('select', { class: 'field', id: 'rt-role' },
          h('option', { value: '' }, 'Prefer not to say'),
          ROLES.map((r) => h('option', { value: r }, r)))
      : null;
    const comment = RATING.commentField
      ? h('textarea', { class: 'field', id: 'rt-comment', rows: '3', maxlength: '500' })
      : null;

    send.addEventListener('click', async () => {
      if (!score) return;
      send.disabled = true;
      skip.disabled = true;
      status.textContent = 'Sending…';
      const body = new URLSearchParams();
      body.set(RATING.ratingField, String(score));
      if (role && role.value) body.set(RATING.roleField, role.value);
      if (comment && comment.value.trim()) body.set(RATING.commentField, comment.value.trim().slice(0, 500));
      try {
        await fetch(RATING.formUrl, { method: 'POST', mode: 'no-cors', body, credentials: 'omit', referrerPolicy: 'no-referrer' });
        state.ratingSent = true;
      } catch (e) {
        state.ratingFailed = true;
      }
      state.rated = true;
      go('report');
    });

    return h('section', { class: 'row rate' },
      h('div', { class: 'margin' }, 'Optional'),
      h('div', { class: 'body' },
        h('h2', { class: 'q', id: 'rt-q', tabindex: '-1', 'data-focus': '' }, 'Before your report: how was answering these questions?'),
        h('p', { class: 'hint' }, 'You can skip this. Your report is the same either way.'),
        scale,
        h('p', { class: 'ends' }, h('span', {}, '1 = confusing'), h('span', {}, '5 = clear')),
        role ? h('label', { class: 'field-label', for: 'rt-role' }, 'Which best describes you? (optional)') : null,
        role,
        comment ? h('label', { class: 'field-label', for: 'rt-comment' }, 'Anything unclear? (optional). Please do not include personal details.') : null,
        comment,
        h('p', { class: 'fine' }, `If you send a rating, the score and anything you type go to the author’s feedback form (${host}). Your answers to the ${TOTAL} questions are not sent.`),
        h('div', { class: 'actions' }, send, skip),
        status));
  }

  function findingRow(res) {
    const { rule, answer, outcome } = res;
    const o = OUT[outcome];
    const status = h('span', { class: `status s-${outcome}` }, h('i', { 'aria-hidden': 'true' }, o.glyph), o.label);
    const detail = h('div', { class: 'detail' },
      h('p', {}, h('span', { class: 'lead-in' }, 'You answered. '), answer.label),
      h('p', {}, h('span', { class: 'lead-in' }, 'The Act asks. '), rule.obligation),
      h('p', {}, h('span', { class: 'lead-in' }, 'Next step. '), nextStep(rule, outcome)),
      h('p', { class: 'src' }, `${rule.source}. ${rule.phase}. Reviewed ${rule.reviewed_human}.`));

    const body = COLLAPSED.has(outcome)
      ? h('details', {}, h('summary', {}, h('span', { class: 'ttl' }, rule.short), status), detail)
      : h('div', {}, h('h3', { class: 'ttl' }, rule.short), status, detail);

    return h('div', { class: 'row finding' },
      h('div', { class: 'margin' }, rule.cite),
      h('div', { class: 'body' }, body));
  }

  function reportScreen() {
    const results = RULES.map(resultFor);
    const c = tally(results);

    const actions = h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => download(results) }, 'Download as Markdown'),
      h('button', { class: 'btn', type: 'button', onclick: () => printReport() }, 'Print or save as PDF'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => go('ask', 0) }, 'Change my answers'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => { state.answers = {}; state.rated = false; state.ratingSent = false; state.ratingFailed = false; go('intro'); } }, 'Start over'));

    const wrap = h('div', {},
      h('section', { class: 'row head' },
        h('div', { class: 'margin' }, new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })),
        h('div', { class: 'body' },
          h('h1', { class: 'title sm', tabindex: '-1', 'data-focus': '' }, 'Your gap report'),
          h('p', { class: 'summary' }, summarySentence(c)),
          state.ratingSent ? h('p', { class: 'fine' }, 'Thanks, your rating was sent.') : null,
          state.ratingFailed ? h('p', { class: 'fine' }, 'Your rating could not be sent. Your report is below.') : null,
          c.gap + c.unsure === 0
            ? h('p', { class: 'callout' }, 'No gaps in your answers. That is not the same as being compliant.')
            : null,
          h('p', { class: 'fine' }, `This check covers ${TOTAL} core duties and relies on your answers. It is a preparation aid, not legal advice.`),
          actions)));

    for (const key of ORDER) {
      const items = results.filter((r) => r.outcome === key);
      if (!items.length) continue;
      wrap.append(h('div', { class: 'row grouphead' },
        h('div', { class: 'margin' }),
        h('div', { class: 'body' }, h('h2', { class: 'group' }, `${OUT[key].group} (${items.length})`))));
      items.forEach((res) => wrap.append(findingRow(res)));
    }

    wrap.append(h('div', { class: 'row end' },
      h('div', { class: 'margin' }),
      h('div', { class: 'body' },
        h('p', { class: 'note' }, 'Check the official text of the Act and Rules before you rely on any point here. Exact deadlines and formats, for example for breach reports, are set in the Rules.'),
        SITE.feedbackUrl
          ? h('p', { class: 'note' }, 'Was this useful, or was something unclear? ',
              h('a', { href: SITE.feedbackUrl, target: '_blank', rel: 'noopener' }, 'Tell the author what to improve'),
              '. It opens a separate form, and the answers you gave here are not sent with it.')
          : null)));
    return wrap;
  }

  /* ---------- export ---------- */

  function toMarkdown(results) {
    const c = tally(results);
    const lines = [
      '# DPDP gap report', '',
      `Generated ${fmtDate(new Date())} with ${D.meta.title} v${D.meta.version}. Rules data last reviewed ${D.meta.data_reviewed_human}.`, '',
      '> A preparation aid, not legal advice or a certificate of compliance. It covers '
        + `${TOTAL} core duties and relies on the answers given.`, '',
      `**Summary:** ${summarySentence(c)}`, '',
    ];
    for (const key of ORDER) {
      const items = results.filter((r) => r.outcome === key);
      if (!items.length) continue;
      lines.push(`## ${OUT[key].group} (${items.length})`, '');
      for (const { rule, answer, outcome } of items) {
        lines.push(
          `### ${rule.short} (${rule.cite})`, '',
          `- **You answered:** ${answer.label}`,
          `- **The Act asks:** ${rule.obligation}`,
          `- **Next step:** ${nextStep(rule, outcome)}`,
          `- **Source:** ${rule.source}. ${rule.phase}. Reviewed ${rule.reviewed_human}.`, '');
      }
    }
    return lines.join('\n');
  }

  function download(results) {
    const blob = new Blob([toMarkdown(results)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `dpdp-gap-report-${new Date().toISOString().slice(0, 10)}.md` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printReport() {
    root.querySelectorAll('details').forEach((d) => { d.open = true; });
    window.print();
  }

  /* ---------- footer ---------- */

  function renderFooter() {
    const m = D.meta;
    const site = window.DPDP_SITE || {};
    foot.append(
      h('p', {}, `${m.title} v${m.version}. Rules data last reviewed ${m.data_reviewed_human}. ${RATING ? 'Runs in your browser. It makes no network requests unless you choose to send a rating.' : 'Runs entirely in your browser and makes no network requests.'}`),
      h('p', {}, 'Not legal advice. A gap report is a preparation aid, not a certificate of compliance. The DPDP Act and Rules are the authority.'),
      h('p', {},
        site.author ? `Created by ${site.author}. ` : '',
        site.repoUrl ? h('a', { href: site.repoUrl, rel: 'noopener' }, 'Source and rules data') : null,
        site.repoUrl ? '. ' : '',
        'Code under Apache-2.0, rules data under CC BY 4.0.'));
  }

  renderFooter();
  render();
})();
