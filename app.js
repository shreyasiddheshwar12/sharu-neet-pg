(function () {
  "use strict";
  const KEY = "neetpg2027-v1";
  const SCHED = window.NEET_SCHEDULE;
  const DAYS = SCHED.days;
  const BY_DATE = Object.fromEntries(DAYS.map((d) => [d.date, d]));
  const EXAM = new Date(SCHED.exam_date + "T00:00:00");
  const main = document.getElementById("app");

  // Subjects in the standard NEET PG order (Anatomy first, Anaesthesia last).
  const SUBJECT_ORDER = [
    "Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology",
    "Forensic Medicine", "Community Medicine (PSM)", "ENT", "Ophthalmology", "Medicine", "Surgery",
    "Obstetrics & Gynaecology", "Paediatrics", "Orthopaedics", "Dermatology", "Psychiatry",
    "Radiology", "Anaesthesia",
  ];
  const SUBJECTS = SUBJECT_ORDER.map((n) => SCHED.subjects.find((s) => s.name === n)).filter(Boolean);

  // Tracker rows. "due" is a suggested finish date; edit here if the plan changes.
  const ROWS = [
    { key: "core", label: "Core BTR videos", due: "2026-12-31" },
    { key: "marrow", label: "Marrow RR videos", due: "2027-01-31" },
    { key: "rr", label: "RR videos", due: "2027-02-28" },
    { key: "pyq", label: "PYQs", due: "2027-04-10" },
    { key: "r1", label: "Revision 1", due: "2027-01-15" },
    { key: "r2", label: "Revision 2", due: "2027-02-15" },
    { key: "r3", label: "Revision 3", due: "2027-03-01" },
    { key: "r4", label: "Revision 4", due: "2027-03-20" },
    { key: "r5", label: "Revision 5", due: "2027-04-01" },
    { key: "r6", label: "Revision 6", due: "2027-04-15" },
    { key: "r7", label: "Revision 7", due: "2027-04-25" },
    { key: "r8", label: "Revision 8", due: "2027-05-05" },
  ];
  const isRevision = (key) => /^r\d$/.test(key);

  let state = loadState();
  let view = "today";
  let viewDate = todayISO();

  // ---------- storage & dates ----------
  function emptyState() {
    return { done: {}, qbank: {}, reflect: {}, mocks: [], tracker: {}, lastUpdate: null };
  }
  function loadState() {
    try { return Object.assign(emptyState(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return emptyState(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function isoOf(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function todayISO() { return isoOf(new Date()); }
  function shift(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d); }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000); }
  function fmt(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function shortDate(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  function daysLeft() { return daysBetween(todayISO(), SCHED.exam_date); }

  // ---------- DOM helper (no innerHTML, so nothing is parsed as markup) ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    });
    kids.flat().forEach((c) => {
      if (c === undefined || c === null || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  // ---------- daily plan logic ----------
  function blockDone(b) { return !!state.done[b.id]; }
  function dayStats(day) {
    return { done: day.blocks.filter(blockDone).length, total: day.blocks.length };
  }
  // A day counts as "kept" when at least 80% of its blocks are ticked.
  function dayOk(iso) {
    const day = BY_DATE[iso];
    if (!day) return false;
    const s = dayStats(day);
    return s.done >= Math.ceil(s.total * 0.8);
  }
  function streak() {
    let iso = todayISO();
    if (!dayOk(iso)) iso = shift(iso, -1); // today can still be in progress
    let n = 0;
    while (BY_DATE[iso] && dayOk(iso)) { n++; iso = shift(iso, -1); }
    return n;
  }
  function overall() {
    const blocks = DAYS.flatMap((d) => d.blocks);
    const done = blocks.filter(blockDone).length;
    return { done, total: blocks.length, pct: Math.round((100 * done) / blocks.length) };
  }
  // Unfinished work from the last 3 days: the accountability banner.
  function unfinished() {
    const today = todayISO();
    const out = [];
    for (let k = 1; k <= 3; k++) {
      const day = BY_DATE[shift(today, -k)];
      if (day) day.blocks.filter((b) => !blockDone(b) && b.type !== "reflect").forEach((b) => out.push(b));
    }
    return out;
  }

  // ---------- tracker logic ----------
  function cellOf(subject, row) { return state.tracker[`${subject}|${row}`] || {}; }
  function setCell(subject, row, patch) {
    state.tracker[`${subject}|${row}`] = Object.assign({}, cellOf(subject, row), patch);
    state.lastUpdate = todayISO();
    save();
  }
  function cellClass(subject, row) {
    const c = cellOf(subject, row.key);
    if (c.done) return c.conf && c.conf <= 2 ? "done weak" : "done";
    if (row.due < todayISO()) return "overdue";
    return "";
  }
  function trackerIssues() {
    const today = todayISO();
    const out = { overdue: [], noDate: [], lowConf: [], seq: [] };
    SUBJECTS.forEach((s) => ROWS.forEach((r) => {
      const c = cellOf(s.name, r.key);
      const label = `${s.name} · ${r.label}`;
      if (!c.done && r.due < today) out.overdue.push(`${label} (due ${shortDate(r.due)})`);
      if (c.done && !c.date) out.noDate.push(label);
      if (c.done && c.conf && c.conf <= 2) out.lowConf.push(label);
      if (isRevision(r.key) && c.done && !cellOf(s.name, "core").done) out.seq.push(label);
    }));
    return out;
  }
  // Open tasks that are overdue or due within the next 7 days.
  function dueSoon() {
    const cutoff = shift(todayISO(), 7);
    const out = [];
    SUBJECTS.forEach((s) => ROWS.forEach((r) => {
      if (!cellOf(s.name, r.key).done && r.due <= cutoff) out.push({ subject: s.name, row: r });
    }));
    return out.sort((a, b) => a.row.due.localeCompare(b.row.due));
  }

  // ---------- views ----------
  function stat(label, value) {
    return h("div", { class: "stat" }, h("b", {}, String(value)), h("span", {}, label));
  }
  function statsBar() {
    const o = overall();
    const questions = Object.values(state.qbank).reduce((a, n) => a + Number(n || 0), 0);
    return h("div", { class: "stats" },
      stat("Days to exam", daysLeft()),
      stat("Streak", `${streak()} d`),
      stat("Plan complete", `${o.pct}%`),
      stat("Questions solved", questions));
  }
  function blockRow(b) {
    return h("label", { class: `block t-${b.type}${blockDone(b) ? " done" : ""}` },
      h("input", {
        type: "checkbox",
        checked: blockDone(b),
        onchange: (e) => {
          if (e.target.checked) state.done[b.id] = true; else delete state.done[b.id];
          save(); render();
        },
      }),
      h("span", { class: "time" }, `${b.start}–${b.end}`),
      h("span", { class: "tag" }, b.type),
      h("span", { class: "title" }, b.title),
      h("small", { class: "detail" }, b.detail));
  }

  function renderToday() {
    const wrap = h("section", {});
    const late = unfinished();
    if (viewDate === todayISO() && late.length) {
      wrap.append(h("div", { class: "banner warn" },
        `${late.length} unfinished block(s) from the last 3 days. Move them into today's catch-up buffer or Saturday's buffer. Do not drop them.`));
    }
    if (viewDate === todayISO()) {
      const soon = dueSoon();
      const box = h("div", { class: "card" }, h("b", {}, `Tracker: ${soon.length} task(s) overdue or due in 7 days`));
      if (soon.length === 0) box.append(h("p", { class: "muted" }, "Nothing due. Well done."));
      else {
        const ul = h("ul", { class: "compact" });
        soon.slice(0, 8).forEach((t) => ul.append(h("li", {}, `${t.subject} · ${t.row.label}`, h("span", { class: t.row.due < todayISO() ? "tag late" : "tag" }, ` due ${shortDate(t.row.due)}`))));
        box.append(ul);
        if (soon.length > 8) box.append(h("p", { class: "muted" }, `+${soon.length - 8} more in the Tracker tab.`));
        box.append(h("button", { onclick: () => setView("tracker") }, "Open tracker"));
      }
      wrap.append(box);
    }
    wrap.append(statsBar());
    const day = BY_DATE[viewDate];
    if (!day) {
      wrap.append(h("p", {}, viewDate < DAYS[0].date ? `Plan starts ${fmt(DAYS[0].date)}.` : "No plan for this date."));
    } else {
      wrap.append(h("div", { class: "row" },
        h("button", { onclick: () => { viewDate = shift(viewDate, -1); render(); } }, "◀ Prev"),
        h("strong", {}, `${fmt(day.date)} · ${day.phase}`),
        h("button", { onclick: () => { viewDate = shift(viewDate, 1); render(); } }, "Next ▶")));
      wrap.append(h("p", { class: "muted" }, day.focus + (day.mock ? "  ·  MOCK DAY" : "")));
      const list = h("div", { class: "blocks" });
      day.blocks.forEach((b) => list.append(blockRow(b)));
      wrap.append(list);
      wrap.append(h("label", { class: "field" },
        `Questions solved today (target ${day.qbank_target}) `,
        h("input", {
          type: "number", min: "0", value: state.qbank[day.date] || 0,
          onchange: (e) => { state.qbank[day.date] = Number(e.target.value) || 0; save(); render(); },
        })));
      wrap.append(h("label", { class: "field" },
        "Reflection: what went wrong, what changes tomorrow?",
        h("textarea", {
          rows: "3",
          oninput: (e) => { state.reflect[day.date] = e.target.value; save(); },
        }, state.reflect[day.date] || "")));
    }
    main.replaceChildren(wrap);
  }

  function renderCalendar() {
    const rows = DAYS.map((day) => {
      const s = dayStats(day);
      const cls = s.done === 0 ? "" : dayOk(day.date) ? "good" : "partial";
      return h("tr", { class: cls, onclick: () => { viewDate = day.date; setView("today"); } },
        h("td", {}, fmt(day.date)),
        h("td", {}, day.phase),
        h("td", {}, day.focus),
        h("td", {}, `${s.done}/${s.total}`));
    });
    main.replaceChildren(
      h("p", { class: "muted" }, "Tap a day to open it. Green = at least 80% of blocks done. Amber = some progress."),
      h("div", { class: "scroll" }, h("table", { class: "cal" },
        h("thead", {}, h("tr", {}, h("th", {}, "Date"), h("th", {}, "Phase"), h("th", {}, "Focus"), h("th", {}, "Done"))),
        h("tbody", {}, rows))));
  }

  function renderTracker() {
    const iss = trackerIssues();
    const stale = state.lastUpdate ? daysBetween(state.lastUpdate, todayISO()) : null;

    const panel = h("div", { class: "checks" });
    const check = (title, items, hint) => {
      const box = h("div", { class: `check ${items.length ? "bad" : "ok"}` },
        h("b", {}, `${title}: ${items.length}`));
      if (items.length) {
        const ul = h("ul", { class: "compact" });
        items.slice(0, 6).forEach((i) => ul.append(h("li", {}, i)));
        if (items.length > 6) ul.append(h("li", {}, `+${items.length - 6} more`));
        box.append(ul, h("small", { class: "muted" }, hint));
      } else {
        box.append(h("small", { class: "muted" }, "All clear"));
      }
      return box;
    };
    panel.append(
      check("Overdue", iss.overdue, "Finish these or move them into this Saturday's buffer."),
      check("Done without a date", iss.noDate, "Date is filled in automatically when you tick a box. Fix any blanks."),
      check("Weak after done (confidence 1–2)", iss.lowConf, "Schedule a re-revision of these within a week."),
      check("Revision done before core videos", iss.seq, "Watch the core videos first, then revise."),
    );
    if (stale === null) panel.append(h("div", { class: "check" }, "Tick your first task to start the weekly check-in."));
    else if (stale >= 3) panel.append(h("div", { class: "check bad" },
      h("b", {}, `No tracker update for ${stale} days.`),
      h("small", { class: "muted" }, " Set aside 20 minutes today to catch up.")));

    const headRow = h("tr", {}, h("th", { class: "sticky" }, "Task"),
      ...SUBJECTS.map((s) => h("th", {}, s.name)));
    const bodyRows = ROWS.map((r) => h("tr", {},
      h("th", { class: "sticky" }, h("div", {}, r.label), h("small", { class: "muted" }, `due ${shortDate(r.due)}`)),
      ...SUBJECTS.map((s) => trackerCell(s.name, r))));
    const footRow = h("tr", { class: "foot" }, h("th", { class: "sticky" }, "Subject complete"),
      ...SUBJECTS.map((s) => {
        const n = ROWS.filter((r) => cellOf(s.name, r.key).done).length;
        return h("td", {}, `${Math.round((100 * n) / ROWS.length)}%`);
      }));

    main.replaceChildren(
      h("p", { class: "muted" }, "Each cell: tick Done, the date you finished, and how confident you feel (1 weak to 5 exam-ready). Scroll sideways for all 19 subjects."),
      panel,
      h("div", { class: "scroll" }, h("table", { class: "tracker" },
        h("thead", {}, headRow), h("tbody", {}, bodyRows), h("tfoot", {}, footRow))));
  }

  function trackerCell(subject, row) {
    const c = cellOf(subject, row.key);
    return h("td", { class: cellClass(subject, row) },
      h("label", { class: "tick" },
        h("input", {
          type: "checkbox",
          checked: !!c.done,
          onchange: (e) => {
            const on = e.target.checked;
            setCell(subject, row.key, { done: on, date: on ? c.date || todayISO() : c.date });
            render();
          },
        }),
        " Done"),
      h("input", {
        type: "date",
        value: c.date || "",
        title: "Date finished",
        onchange: (e) => { setCell(subject, row.key, { date: e.target.value }); render(); },
      }),
      h("select", {
        title: "Confidence",
        onchange: (e) => { setCell(subject, row.key, { conf: Number(e.target.value) || 0 }); render(); },
      }, h("option", { value: "" }, "confidence –"),
        ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: c.conf === n }, `${n} / 5`))));
  }

  function renderMocks() {
    const form = h("form", {
      class: "row",
      onsubmit: (e) => {
        e.preventDefault();
        const f = e.target.elements;
        state.mocks.push({
          date: f.date.value,
          score: Number(f.score.value),
          total: Number(f.total.value) || 800,
          note: f.note.value.trim(),
        });
        save(); render();
      },
    },
      h("input", { type: "date", name: "date", value: todayISO(), required: true }),
      h("input", { type: "number", name: "score", placeholder: "Score", min: "0", required: true }),
      h("input", { type: "number", name: "total", placeholder: "Total marks", value: "800", min: "1" }),
      h("input", { type: "text", name: "note", placeholder: "Weak areas" }),
      h("button", { type: "submit" }, "Add mock"));
    const last5 = state.mocks.slice(-5);
    const avg = last5.length
      ? Math.round(last5.reduce((a, m) => a + (100 * m.score) / m.total, 0) / last5.length)
      : null;
    const rows = state.mocks.map((m, idx) => h("tr", {},
      h("td", {}, m.date),
      h("td", {}, `${m.score}/${m.total}`),
      h("td", {}, `${Math.round((100 * m.score) / m.total)}%`),
      h("td", {}, m.note),
      h("td", {}, h("button", { onclick: () => { state.mocks.splice(idx, 1); save(); render(); } }, "Delete"))));
    main.replaceChildren(
      h("p", {}, avg === null
        ? "No mocks yet. Log one after every full mock."
        : `Average of your last ${last5.length} mock(s): ${avg}% of total.`),
      form,
      h("div", { class: "scroll" }, h("table", {},
        h("thead", {}, h("tr", {}, ...["Date", "Score", "%", "Weak areas", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, rows))));
  }

  function renderBackup() {
    const exportBtn = h("button", {
      onclick: () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const a = h("a", { href: URL.createObjectURL(blob), download: `neetpg-progress-${todayISO()}.json` });
        document.body.append(a); a.click(); a.remove();
      },
    }, "Export progress (JSON)");
    const fileIn = h("input", {
      type: "file", accept: "application/json",
      onchange: (e) => {
        const file = e.target.files[0];
        if (!file) return;
        file.text()
          .then((t) => { state = Object.assign(emptyState(), JSON.parse(t)); save(); render(); alert("Progress imported."); })
          .catch(() => alert("That file is not a valid progress backup."));
      },
    });
    const reset = h("button", {
      class: "danger",
      onclick: () => {
        if (confirm("Erase ALL progress stored in this browser?")) {
          localStorage.removeItem(KEY); state = emptyState(); render();
        }
      },
    }, "Erase all progress");
    main.replaceChildren(
      h("p", {}, "Progress is stored in this browser only. Export every Sunday and keep the file somewhere safe."),
      exportBtn,
      h("p", {}, "Import a backup: ", fileIn),
      reset);
  }

  // ---------- navigation ----------
  function render() {
    document.getElementById("countdown").textContent =
      `${daysLeft()} days to NEET PG 2027 (${fmt(SCHED.exam_date)})`;
    const views = { today: renderToday, calendar: renderCalendar, tracker: renderTracker, mocks: renderMocks, backup: renderBackup };
    views[view]();
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  }
  function setView(v) {
    view = v;
    if (v === "today" && !BY_DATE[viewDate]) viewDate = todayISO();
    render();
  }
  document.querySelector("nav").addEventListener("click", (e) => {
    const v = e.target.dataset.view;
    if (!v) return;
    if (v === "today") viewDate = todayISO();
    setView(v);
  });
  render();
})();
