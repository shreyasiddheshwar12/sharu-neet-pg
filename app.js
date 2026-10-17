(function () {
  "use strict";
  const KEY = "neetpg2027-v1";
  const SCHED = window.NEET_SCHEDULE;
  const main = document.getElementById("app");
  if (!SCHED || !Array.isArray(SCHED.days) || !SCHED.days.length) {
    main.textContent = "The plan file (data/schedule.js) is missing. Keep index.html, app.js, styles.css and the data folder together, then reopen index.html.";
    return;
  }
  const DAYS = SCHED.days;
  const BY_DATE = Object.fromEntries(DAYS.map((d) => [d.date, d]));

  // Standard NEET PG subject order: Anatomy first, Anaesthesia last.
  const SUBJECT_ORDER = [
    "Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology",
    "Forensic Medicine", "Community Medicine (PSM)", "ENT", "Ophthalmology", "Medicine", "Surgery",
    "Obstetrics & Gynaecology", "Paediatrics", "Orthopaedics", "Dermatology", "Psychiatry",
    "Radiology", "Anaesthesia",
  ];
  const SUBJECTS = SUBJECT_ORDER.map((n) => SCHED.subjects.find((s) => s.name === n)).filter(Boolean);

  // One-click suggestions. Nothing is added unless she clicks; she sets her own due dates.
  const SUGGESTIONS = [
    { id: "core", name: "Core BTR videos", kind: "core" },
    { id: "marrow", name: "Marrow RR videos", kind: "custom" },
    { id: "rr", name: "RR videos", kind: "custom" },
    { id: "pyq", name: "PYQs", kind: "custom" },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `r${n}`, name: `Revision ${n}`, kind: "rev" })),
  ];
  const QUOTES = [
    "Small steps every day beat big plans never started. 🦋",
    "Future doctor, today's hour counts.",
    "Consistency is the quiet superpower.",
    "Tick one thing. Then the next. That's the whole game.",
    "Rest is part of the plan. So is showing up.",
  ];

  let state = loadState();
  let view = "today";
  let viewDate = todayISO();
  let editing = false;

  // ---------- storage & dates ----------
  function emptyState() {
    // custom: her own version of a day's blocks, keyed by date. blankPlan: days she hasn't edited start empty.
    return { done: {}, qbank: {}, reflect: {}, mocks: [], tasks: [], tracker: {}, custom: {}, blankPlan: false, lastUpdate: null };
  }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  // Fill in anything missing or malformed so the views never trip over a partial or older save.
  function normalize(raw) {
    const s = Object.assign(emptyState(), isObj(raw) ? raw : {});
    ["done", "qbank", "reflect", "tracker"].forEach((k) => { if (!isObj(s[k])) s[k] = {}; });
    if (!Array.isArray(s.mocks)) s.mocks = [];
    s.mocks = s.mocks.filter((m) => isObj(m) && Number(m.total) > 0);
    s.tasks = Array.isArray(s.tasks) ? s.tasks.filter((t) => isObj(t) && t.id && t.name) : [];
    s.tasks.forEach((t) => { if (typeof t.due !== "string") t.due = ""; });
    if (!isObj(s.custom)) s.custom = {};
    Object.keys(s.custom).forEach((d) => {
      const c = s.custom[d];
      if (!isObj(c) || !Array.isArray(c.blocks) || !BY_DATE[d]) { delete s.custom[d]; return; }
      c.blocks = c.blocks.filter((b) => isObj(b) && b.id);
    });
    s.blankPlan = s.blankPlan === true;
    // Keep anything saved by the earlier version: rebuild its task list from the tracker keys, no dates added.
    Object.keys(s.tracker || {}).forEach((k) => {
      const id = k.split("|")[1];
      if (id && !s.tasks.find((t) => t.id === id)) {
        const known = SUGGESTIONS.find((x) => x.id === id);
        s.tasks.push({ id, name: known ? known.name : id, due: "", kind: known ? known.kind : "custom" });
      }
    });
    return s;
  }
  function loadState() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return normalize({}); }
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) {
      if (!saveWarned) alert("This browser is blocking storage, so progress can't be saved. Try another browser, or turn off private mode.");
      saveWarned = true;
    }
  }
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
  function daysLeft() { return Math.max(0, daysBetween(todayISO(), SCHED.exam_date)); }

  // ---------- DOM helper (text only, nothing parsed as markup) ----------
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
  function toast(msg) {
    document.querySelectorAll(".toast").forEach((x) => x.remove());
    const t = h("div", { class: "toast", role: "status" }, msg);
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
  }
  const CHEERS = ["Nice work! 🦋", "One more down ✨", "Look at you go 💪", "Progress, not perfection 🌱", "Logged. Keep going!"];
  const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];

  // ---------- daily plan logic ----------
  const TYPES = [["study", "Study"], ["qbank", "Questions"], ["revise", "Revision"], ["notes", "Notes"],
    ["mock", "Mock"], ["buffer", "Catch-up"], ["reflect", "Reflect"]];
  const typeLabel = (t) => (TYPES.find((x) => x[0] === t) || [t, t || "Block"])[1];
  const byStart = (a, b) => (a.start || "99").localeCompare(b.start || "99");

  // The plan for a date as she sees it: her edited blocks if she changed the day, otherwise the suggested
  // blocks (or nothing, if she chose blank days). Returns null outside the plan's date range.
  function planDay(iso) {
    const base = BY_DATE[iso];
    if (!base) return null;
    const own = state.custom[iso];
    const mine = !!own || state.blankPlan;
    const blocks = (own ? own.blocks : state.blankPlan ? [] : base.blocks).slice().sort(byStart);
    const subjects = [...new Set(blocks.map((b) => b.subject).filter(Boolean))];
    return {
      date: iso,
      phase: state.blankPlan ? "" : base.phase,
      blocks,
      edited: !!own,
      focus: mine ? subjects.join(" · ") || (blocks.length ? "Your own plan" : "Nothing planned yet") : base.focus,
      mock: mine ? blocks.some((b) => b.type === "mock") : base.mock,
      qbank_target: mine ? null : base.qbank_target,
    };
  }
  function uid() { return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
  // First edit of a day copies what she currently sees, keeping block IDs so ticks carry over.
  function ownDay(iso) {
    if (!state.custom[iso]) state.custom[iso] = { blocks: planDay(iso).blocks.map((b) => Object.assign({}, b)) };
    return state.custom[iso];
  }
  function editBlock(iso, id, patch) {
    const b = ownDay(iso).blocks.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    save();
  }
  function addBlock(iso) {
    const blocks = ownDay(iso).blocks;
    const lastEnd = blocks.map((b) => b.end).filter(Boolean).sort().pop();
    blocks.push({ id: uid(), start: lastEnd || "09:00", end: "", type: "study", subject: "", title: "", detail: "" });
    save();
  }
  function removeBlock(iso, id) {
    const own = ownDay(iso);
    own.blocks = own.blocks.filter((b) => b.id !== id);
    delete state.done[id];
    save();
  }
  function copyDay(from, to) {
    state.custom[to] = { blocks: planDay(from).blocks.map((b) => Object.assign({}, b, { id: uid() })) };
    save();
  }
  function subjectChoices() {
    const own = Object.values(state.custom).flatMap((c) => c.blocks.map((b) => b.subject)).filter(Boolean);
    return [...new Set([...SUBJECT_ORDER, ...own])];
  }

  function blockDone(b) { return !!state.done[b.id]; }
  function dayStats(day) { return { done: day.blocks.filter(blockDone).length, total: day.blocks.length }; }
  // A day counts as "kept" when at least 80% of its blocks are ticked (an empty day never counts).
  function dayOk(iso) {
    const day = planDay(iso);
    if (!day || !day.blocks.length) return false;
    const s = dayStats(day);
    return s.done >= Math.ceil(s.total * 0.8);
  }
  function streak() {
    let iso = todayISO();
    if (!dayOk(iso)) iso = shift(iso, -1);
    let n = 0;
    while (BY_DATE[iso] && dayOk(iso)) { n++; iso = shift(iso, -1); }
    return n;
  }
  function overall() {
    const blocks = DAYS.flatMap((d) => planDay(d.date).blocks);
    const done = blocks.filter(blockDone).length;
    return { done, total: blocks.length, pct: blocks.length ? Math.round((100 * done) / blocks.length) : 0 };
  }
  function unfinished() {
    const today = todayISO();
    const out = [];
    for (let k = 1; k <= 3; k++) {
      const day = planDay(shift(today, -k));
      if (day) day.blocks.filter((b) => !blockDone(b) && b.type !== "reflect").forEach((b) => out.push(b));
    }
    return out;
  }

  // ---------- tracker logic ----------
  function tasks() { return state.tasks || []; }
  function taskById(id) { return tasks().find((t) => t.id === id); }
  function cellOf(subject, taskId) { return state.tracker[`${subject}|${taskId}`] || {}; }
  function setCell(subject, taskId, patch) {
    state.tracker[`${subject}|${taskId}`] = Object.assign({}, cellOf(subject, taskId), patch);
    touch();
  }
  // Any tracker edit counts as a check-in for the staleness check.
  function touch() { state.lastUpdate = todayISO(); save(); }
  function setTask(id, patch) { const t = taskById(id); if (t) Object.assign(t, patch); touch(); }
  function addTask(t) { state.tasks.push(t); touch(); }
  function removeTask(id) {
    state.tasks = tasks().filter((t) => t.id !== id);
    Object.keys(state.tracker).forEach((k) => { if (k.endsWith(`|${id}`)) delete state.tracker[k]; });
    touch();
  }
  function isLate(task, cell) { return !cell.done && !!task.due && task.due < todayISO(); }
  function cellClass(subject, task) {
    const c = cellOf(subject, task.id);
    if (c.done) return c.conf && c.conf <= 2 ? "done weak" : "done";
    return isLate(task, c) ? "overdue" : "";
  }
  function trackerIssues() {
    const out = { overdue: [], noDate: [], lowConf: [], seq: [] };
    const cores = tasks().filter((t) => t.kind === "core");
    SUBJECTS.forEach((s) => tasks().forEach((t) => {
      const c = cellOf(s.name, t.id);
      const label = `${s.name} · ${t.name}`;
      if (isLate(t, c)) out.overdue.push(`${label} (due ${shortDate(t.due)})`);
      if (c.done && !c.date) out.noDate.push(label);
      if (c.done && c.conf && c.conf <= 2) out.lowConf.push(label);
      if (t.kind === "rev" && c.done && cores.length && !cores.some((k) => cellOf(s.name, k.id).done)) out.seq.push(label);
    }));
    return out;
  }
  // Open tasks with a due date that is overdue or within 7 days.
  function dueSoon() {
    const cutoff = shift(todayISO(), 7);
    const out = [];
    SUBJECTS.forEach((s) => tasks().forEach((t) => {
      if (t.due && !cellOf(s.name, t.id).done && t.due <= cutoff) out.push({ subject: s.name, task: t });
    }));
    return out.sort((a, b) => a.task.due.localeCompare(b.task.due));
  }
  function trackerPct() {
    const total = SUBJECTS.length * tasks().length;
    if (!total) return 0;
    const done = SUBJECTS.reduce((a, s) => a + tasks().filter((t) => cellOf(s.name, t.id).done).length, 0);
    return Math.round((100 * done) / total);
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
      stat("Streak", `${streak()} day${streak() === 1 ? "" : "s"} 🔥`),
      stat("Plan complete", `${o.pct}%`),
      stat("Tracker done", `${trackerPct()}%`),
      stat("Questions solved", questions));
  }
  function blockRow(b) {
    return h("label", { class: `block t-${b.type}${blockDone(b) ? " done" : ""}` },
      h("input", {
        type: "checkbox",
        checked: blockDone(b),
        onchange: (e) => {
          if (e.target.checked) { state.done[b.id] = true; toast(cheer()); }
          else delete state.done[b.id];
          save(); render();
        },
      }),
      h("div", { class: "bmain" },
        h("div", { class: "meta" },
          h("span", { class: "time" }, [b.start, b.end].filter(Boolean).join("–")),
          h("span", { class: "tag" }, typeLabel(b.type))),
        h("div", { class: "title" }, b.title || b.subject || "Untitled block",
          b.subject && b.title && !b.title.includes(b.subject) ? h("span", { class: "subj" }, b.subject) : null),
        b.detail ? h("small", { class: "detail" }, b.detail) : null));
  }

  // Edit mode: every field of a block is editable. Text and time edits save on change without redrawing,
  // so typing is never interrupted; the list re-sorts by start time on the next redraw.
  function blockEditor(iso, b) {
    const set = (k) => (e) => editBlock(iso, b.id, { [k]: e.target.value.trim() });
    return h("div", { class: `block editing t-${b.type}` },
      h("div", { class: "bedit" },
        h("div", { class: "erow" },
          h("input", { type: "time", value: b.start || "", title: "Start", "aria-label": "Start time", onchange: set("start") }),
          h("span", { class: "muted" }, "to"),
          h("input", { type: "time", value: b.end || "", title: "End", "aria-label": "End time", onchange: set("end") }),
          h("select", {
            title: "Kind of block", "aria-label": "Kind of block",
            onchange: (e) => { editBlock(iso, b.id, { type: e.target.value }); render(); },
          }, ...TYPES.map(([v, l]) => h("option", { value: v, selected: b.type === v }, l))),
          h("button", {
            class: "icon danger", title: "Remove this block", "aria-label": "Remove this block",
            onclick: () => { removeBlock(iso, b.id); render(); },
          }, "✕")),
        h("input", { type: "text", list: "subject-list", value: b.subject || "", placeholder: "Subject (pick or type your own)", "aria-label": "Subject", maxlength: "60", onchange: set("subject") }),
        h("input", { type: "text", value: b.title || "", placeholder: "What will you do? e.g. Cardiology videos", "aria-label": "Title", maxlength: "120", onchange: set("title") }),
        h("input", { type: "text", value: b.detail || "", placeholder: "Notes (optional)", "aria-label": "Notes", maxlength: "200", onchange: set("detail") })));
  }

  function renderToday() {
    const wrap = h("section", {});
    const late = unfinished();
    if (viewDate === todayISO() && late.length) {
      wrap.append(h("div", { class: "banner" },
        `⚠️ ${late.length} unfinished block(s) from the last 3 days. Fit them into a catch-up slot this week.`));
    }
    if (viewDate === todayISO()) {
      const soon = dueSoon();
      const card = h("div", { class: "card" }, h("h3", {}, "📌 Due soon"));
      if (tasks().length === 0) {
        card.append(h("p", { class: "muted" }, "No tracker tasks yet. Add yours in the Tracker tab."));
      } else if (soon.length === 0) {
        card.append(h("p", { class: "muted" }, "Nothing due in the next 7 days. ✨"));
      } else {
        const ul = h("ul", { class: "compact" });
        soon.slice(0, 8).forEach((t) => ul.append(h("li", {},
          `${t.subject} · ${t.task.name} `,
          h("span", { class: t.task.due < todayISO() ? "late" : "muted" }, `due ${shortDate(t.task.due)}`))));
        card.append(ul);
        if (soon.length > 8) card.append(h("p", { class: "muted" }, `+${soon.length - 8} more in the Tracker tab`));
      }
      card.append(h("button", { class: "ghost", onclick: () => setView("tracker") }, "Open tracker →"));
      wrap.append(card);
    }
    wrap.append(statsBar());
    const day = planDay(viewDate);
    const first = DAYS[0].date, last = DAYS[DAYS.length - 1].date;
    const go = (iso) => { viewDate = iso; render(); };
    wrap.append(h("div", { class: "row daynav" },
      h("div", { class: "row" },
        h("button", { class: "chip", title: "Previous day", "aria-label": "Previous day", disabled: viewDate <= first, onclick: () => go(viewDate > last ? last : shift(viewDate, -1)) }, "◀"),
        h("strong", {}, fmt(viewDate)),
        h("button", { class: "chip", title: "Next day", "aria-label": "Next day", disabled: viewDate >= last, onclick: () => go(viewDate < first ? first : shift(viewDate, 1)) }, "▶"),
        viewDate !== todayISO() ? h("button", { class: "chip", onclick: () => go(todayISO()) }, "Back to today") : null),
      day ? h("div", { class: "row" },
        day.phase ? h("span", { class: "muted" }, day.phase) : null,
        h("button", { class: editing ? "primary" : "chip", onclick: () => { editing = !editing; render(); } }, editing ? "✓ Done editing" : "✏️ Edit day")) : null));
    if (!day) {
      const before = viewDate < first;
      wrap.append(h("div", { class: "empty" },
        h("b", {}, before ? `Your plan starts ${fmt(first)}` : "The plan has finished"),
        before ? `${daysBetween(viewDate, first) === 1 ? "Tomorrow" : `${daysBetween(viewDate, first)} days to go`}. Have a look at day 1 now.` : "All the best for the exam. 🦋",
        h("div", {}, h("button", { class: "primary", style: "margin-top:12px", onclick: () => go(before ? first : last) }, before ? "Preview day 1 →" : "Open the last day"))));
    } else {
      const s = dayStats(day);
      wrap.append(h("p", { class: "muted", style: "margin:4px 0 0" }, day.focus + (day.mock ? "  ·  🎯 MOCK DAY" : ""),
        day.edited ? h("span", { class: "pill soft" }, "your plan") : null));
      wrap.append(h("div", { class: "progress" }, h("i", { style: `width:${s.total ? Math.round((100 * s.done) / s.total) : 0}%` })));
      if (editing) wrap.append(renderDayEditor(day));
      else {
        const list = h("div", { class: "blocks" });
        day.blocks.forEach((b) => list.append(blockRow(b)));
        if (!day.blocks.length) {
          list.append(h("div", { class: "empty" }, h("b", {}, "Nothing planned for this day"),
            "Plan it your way: add your own subjects and blocks.",
            h("div", {}, h("button", { class: "primary", style: "margin-top:12px", onclick: () => { editing = true; render(); } }, "✏️ Plan this day"))));
        }
        wrap.append(list);
      }
      wrap.append(h("label", { class: "field" },
        day.qbank_target ? `Questions solved today (target ${day.qbank_target})` : "Questions solved today",
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

  function renderDayEditor(day) {
    const iso = day.date;
    const box = h("div", { class: "card editor" },
      h("h3", {}, "✏️ Plan this day your way"),
      h("p", { class: "muted" }, "Change any block, add your own subjects, or remove what you don't need. Changes save as you go."),
      h("datalist", { id: "subject-list" }, ...subjectChoices().map((n) => h("option", { value: n }))));
    const list = h("div", { class: "blocks" });
    day.blocks.forEach((b) => list.append(blockEditor(iso, b)));
    if (!day.blocks.length) list.append(h("p", { class: "muted" }, "No blocks yet. Add your first one below."));
    box.append(list);
    const copyTo = h("input", { type: "date", min: DAYS[0].date, max: DAYS[DAYS.length - 1].date, value: shift(iso, 1) <= DAYS[DAYS.length - 1].date ? shift(iso, 1) : "", "aria-label": "Copy to date" });
    box.append(
      h("div", { class: "row" },
        h("button", { class: "primary", onclick: () => { addBlock(iso); render(); } }, "+ Add block"),
        day.blocks.length ? h("button", {
          class: "danger", onclick: () => {
            if (confirm("Remove every block from this day?")) { state.custom[iso] = { blocks: [] }; day.blocks.forEach((b) => delete state.done[b.id]); save(); render(); }
          },
        }, "Clear this day") : null,
        day.edited && !state.blankPlan ? h("button", {
          class: "ghost", onclick: () => {
            if (confirm("Undo your changes and go back to the suggested plan for this day?")) { delete state.custom[iso]; save(); render(); }
          },
        }, "↺ Back to suggested plan") : null),
      h("div", { class: "row" },
        h("span", { class: "muted" }, "Copy this day to"), copyTo,
        h("button", {
          class: "chip", onclick: () => {
            const to = copyTo.value;
            if (!to || !BY_DATE[to] || to === iso) return toast("Pick another date inside the plan 📅");
            if (state.custom[to] && !confirm(`${fmt(to)} already has your own plan. Replace it?`)) return;
            copyDay(iso, to); toast(`Copied to ${shortDate(to)} ✨`);
          },
        }, "Copy")));
    return box;
  }

  function renderCalendar() {
    const rows = DAYS.map((d) => {
      const day = planDay(d.date);
      const s = dayStats(day);
      const cls = (s.done === 0 ? "" : dayOk(day.date) ? "good" : "partial") + (day.date === todayISO() ? " today" : "");
      const open = () => { viewDate = day.date; setView("today"); };
      return h("tr", {
        class: cls, tabindex: "0", onclick: open,
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
      },
        h("td", {}, fmt(day.date), day.date === todayISO() ? h("span", { class: "pill" }, "today") : null),
        state.blankPlan ? null : h("td", {}, day.phase),
        h("td", {}, day.focus, day.edited ? h("span", { class: "pill soft" }, "yours") : null),
        h("td", {}, s.total ? `${s.done}/${s.total}` : "–"));
    });
    const mode = (blank, label, hint) => h("label", { class: `mode${state.blankPlan === blank ? " on" : ""}` },
      h("input", {
        type: "radio", name: "planmode", checked: state.blankPlan === blank,
        onchange: () => { state.blankPlan = blank; save(); render(); },
      }),
      h("span", {}, h("b", {}, label), h("small", { class: "muted" }, hint)));
    main.replaceChildren(
      h("div", { class: "card" },
        h("h3", {}, "🗓️ How do you want to plan?"),
        h("div", { class: "modes" },
          mode(false, "Start from the suggested timetable", "Every day comes filled in. Edit any day to make it yours."),
          mode(true, "Blank days, I'll plan my own", "Days start empty. Open a day and add your own subjects and blocks.")),
        h("p", { class: "muted", style: "margin:10px 0 0" }, "Days you've already edited keep your plan either way. Open a day and tap ✏️ Edit day to change it.")),
      h("p", { class: "muted" }, "Tap a day to open it. Green = at least 80% done. Amber = some progress."),
      h("div", { class: "scroll card", style: "padding:0" }, h("table", { class: "cal" },
        h("thead", {}, h("tr", {}, h("th", {}, "Date"), state.blankPlan ? null : h("th", {}, "Phase"), h("th", {}, state.blankPlan ? "Subjects" : "Focus"), h("th", {}, "Done"))),
        h("tbody", {}, rows))));
  }

  function renderTracker() {
    const iss = trackerIssues();
    const stale = state.lastUpdate ? daysBetween(state.lastUpdate, todayISO()) : null;
    const wrap = h("section", {});

    // Add-task card: nothing is pre-filled. She picks suggestions or types her own.
    const nameIn = h("input", { type: "text", placeholder: "Type a task, e.g. Revision 9", maxlength: "60", style: "flex:1;min-width:200px" });
    const dueIn = h("input", { type: "date", title: "Due date (optional, your choice)" });
    const addOwn = () => {
      const name = nameIn.value.trim();
      if (!name) return toast("Give the task a name first ✏️");
      if (tasks().some((t) => t.name.toLowerCase() === name.toLowerCase())) return toast("You already have that task 🙂");
      const kind = /\brevision\b/i.test(name) ? "rev" : /\bcore\b/i.test(name) ? "core" : "custom";
      addTask({ id: `t${Date.now()}`, name, due: dueIn.value, kind });
      toast("Task added ✨");
      render();
    };
    nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") addOwn(); });
    const notAdded = SUGGESTIONS.filter((s) => !taskById(s.id));
    wrap.append(h("div", { class: "card addcard" },
      h("h3", {}, "➕ Your tasks"),
      h("p", { class: "muted" }, "Add only what you want to track. Set your own due date, or leave it blank."),
      h("div", { class: "row" }, nameIn, dueIn, h("button", { class: "primary", onclick: addOwn }, "Add task")),
      notAdded.length
        ? h("div", {},
          h("p", { class: "muted", style: "margin:12px 0 0" }, "Quick add:"),
          h("div", { class: "chips" }, ...notAdded.map((s) => h("button", {
            class: "chip",
            onclick: () => { addTask(Object.assign({ due: "" }, s)); toast(`${s.name} added`); render(); },
          }, `+ ${s.name}`))))
        : null));

    // Accountability panel.
    const check = (title, items, hint) => {
      const box = h("div", { class: `check ${items.length ? "bad" : "ok"}` }, h("b", {}, `${title}: ${items.length}`));
      if (items.length) {
        const ul = h("ul", { class: "compact" });
        items.slice(0, 6).forEach((i) => ul.append(h("li", {}, i)));
        if (items.length > 6) ul.append(h("li", {}, `+${items.length - 6} more`));
        box.append(ul, h("small", { class: "muted" }, hint));
      } else {
        box.append(h("div", { class: "muted" }, "All clear ✓"));
      }
      return box;
    };
    if (tasks().length) {
      wrap.append(h("div", { class: "checks" },
        check("Overdue", iss.overdue, "Finish these or move them into Saturday's buffer."),
        check("Done without a date", iss.noDate, "A date fills in when you tick Done. Fix any blanks."),
        check("Done but weak (1–2)", iss.lowConf, "Schedule a re-revision of these this week."),
        check("Revision before core videos", iss.seq, "Watch the core videos first, then revise."),
        stale === null
          ? h("div", { class: "check" }, h("b", {}, "Weekly check-in"), h("div", { class: "muted" }, "Tick your first task to start."))
          : stale >= 3
            ? h("div", { class: "check bad" }, h("b", {}, `No update for ${stale} days`), h("div", { class: "muted" }, "Take 20 minutes today to catch up."))
            : h("div", { class: "check ok" }, h("b", {}, "Up to date ✓"), h("div", { class: "muted" }, `Last update ${stale === 0 ? "today" : `${stale} day(s) ago`}.`))));
    }

    if (tasks().length === 0) {
      wrap.append(h("div", { class: "empty" }, h("b", {}, "No tasks yet"), "Pick a quick add above or type your own. Each task becomes a row, and each subject a column."));
      main.replaceChildren(wrap);
      return;
    }

    const headRow = h("tr", {}, h("th", { class: "sticky" }, "Task"), ...SUBJECTS.map((s) => h("th", {}, s.name)));
    const bodyRows = tasks().map((t) => h("tr", {},
      h("td", { class: "sticky" },
        h("div", { class: "row", style: "margin:0;justify-content:space-between;flex-wrap:nowrap" },
          h("span", { class: "taskname" }, t.name),
          h("button", {
            class: "icon danger", title: "Remove task", onclick: () => {
              if (confirm(`Remove "${t.name}" from every subject?`)) { removeTask(t.id); render(); }
            },
          }, "✕")),
        h("label", { class: "due-label" }, "Due date (your choice)",
          h("input", {
            type: "date", value: t.due || "",
            onchange: (e) => { setTask(t.id, { due: e.target.value }); render(); },
          }))),
      ...SUBJECTS.map((s) => trackerCell(s.name, t))));
    const footRow = h("tr", { class: "foot" }, h("th", { class: "sticky" }, "Subject complete"),
      ...SUBJECTS.map((s) => {
        const n = tasks().filter((t) => cellOf(s.name, t.id).done).length;
        return h("td", {}, h("span", { class: "pct" }, `${Math.round((100 * n) / tasks().length)}%`));
      }));

    wrap.append(h("div", { class: "scroll card", style: "padding:0" }, h("table", { class: "tracker" },
      h("thead", {}, headRow), h("tbody", {}, bodyRows), h("tfoot", {}, footRow))));
    wrap.append(h("p", { class: "muted" }, "In each cell: tick Done, the date you finished it, and how confident you feel (1 weak to 5 exam-ready)."));
    main.replaceChildren(wrap);
  }

  function trackerCell(subject, task) {
    const c = cellOf(subject, task.id);
    return h("td", { class: cellClass(subject, task) },
      h("div", { class: "cell" },
        h("label", { class: "tick" },
          h("input", {
            type: "checkbox",
            checked: !!c.done,
            onchange: (e) => {
              const on = e.target.checked;
              // Ticking stamps today's date (unless she already typed one); unticking clears it.
              setCell(subject, task.id, { done: on, date: on ? c.date || todayISO() : "" });
              if (on) toast(cheer());
              render();
            },
          }),
          "Done"),
        h("input", {
          type: "date", value: c.date || "", title: "Finished on",
          onchange: (e) => { setCell(subject, task.id, { date: e.target.value }); render(); },
        }),
        h("select", {
          title: "Confidence",
          onchange: (e) => { setCell(subject, task.id, { conf: Number(e.target.value) || 0 }); render(); },
        }, h("option", { value: "" }, "confidence –"),
          ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: c.conf === n }, `${n} / 5`)))));
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
        toast("Mock logged 🎯");
        save(); render();
      },
    },
      h("input", { type: "date", name: "date", value: todayISO(), required: true }),
      h("input", { type: "number", name: "score", placeholder: "Score", title: "Your score", min: "0", required: true }),
      h("input", { type: "number", name: "total", placeholder: "Total marks", title: "Total marks", value: "800", min: "1" }),
      h("input", { type: "text", name: "note", placeholder: "Weak areas" }),
      h("button", { class: "primary", type: "submit" }, "Add mock"));
    const sorted = state.mocks.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const last5 = sorted.slice(-5);
    const avg = last5.length
      ? Math.round(last5.reduce((a, m) => a + (100 * m.score) / m.total, 0) / last5.length)
      : null;
    const rows = sorted.slice().reverse().map((m) => h("tr", {},
      h("td", {}, m.date),
      h("td", {}, `${m.score}/${m.total}`),
      h("td", {}, `${Math.round((100 * m.score) / m.total)}%`),
      h("td", {}, m.note),
      h("td", {}, h("button", {
        class: "icon danger", title: "Delete this mock", onclick: () => {
          if (confirm(`Delete the mock from ${m.date}?`)) { state.mocks = state.mocks.filter((x) => x !== m); save(); render(); }
        },
      }, "✕"))));
    main.replaceChildren(
      h("div", { class: "card" }, h("h3", {}, "🎯 Mocks"),
        h("p", { class: "muted" }, avg === null
          ? "No mocks yet. Log one after every full mock."
          : `Average of your last ${last5.length} mock(s): ${avg}% of total.`),
        form),
      h("div", { class: "scroll card", style: "padding:0" }, h("table", {},
        h("thead", {}, h("tr", {}, ...["Date", "Score", "%", "Weak areas", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, rows.length ? rows : h("tr", {}, h("td", { colspan: "5", class: "muted" }, "Your mocks will appear here."))))));
  }

  function renderBackup() {
    const exportBtn = h("button", {
      class: "primary",
      onclick: () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = h("a", { href: url, download: `neetpg-progress-${todayISO()}.json` });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Backup downloaded 💾");
      },
    }, "Export progress (JSON)");
    const fileIn = h("input", {
      type: "file", accept: "application/json",
      onchange: (e) => {
        const file = e.target.files[0];
        if (!file) return;
        file.text()
          .then((t) => {
            const raw = JSON.parse(t);
            const looksRight = isObj(raw) && ["done", "tasks", "tracker", "mocks"].some((k) => k in raw);
            if (!looksRight) throw new Error("not a backup");
            if (!confirm("Replace the progress in this browser with this backup?")) return;
            state = normalize(raw); save(); render(); toast("Progress imported ✨");
          })
          .catch(() => alert("That file is not a valid progress backup. Nothing was changed."))
          .finally(() => { e.target.value = ""; });
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
    main.replaceChildren(h("div", { class: "card" },
      h("h3", {}, "💾 Backup"),
      h("p", { class: "muted" }, "Progress is stored in this browser only. Export every Sunday and keep the file somewhere safe."),
      h("div", { class: "row" }, exportBtn, h("label", { class: "muted" }, "Import: ", fileIn)),
      h("div", { class: "row" }, reset)));
  }

  // ---------- navigation ----------
  let rendering = false, queued = false, shown = "";
  function render() {
    // Re-rendering removes the focused input, which can fire another change event mid-render; queue it instead.
    if (rendering) { queued = true; return; }
    rendering = true;
    try {
      const key = view === "today" ? `today|${viewDate}|${editing}` : view;
      const same = key === shown;
      // Keep table scroll positions when the same screen redraws (e.g. after ticking a tracker cell).
      const scrolls = same ? [...main.querySelectorAll(".scroll")].map((el) => [el.scrollLeft, el.scrollTop]) : [];
      main.classList.toggle("enter", !same);
      document.getElementById("countdown-num").textContent = daysLeft();
      document.getElementById("quote").textContent = QUOTES[new Date().getDate() % QUOTES.length];
      const views = { today: renderToday, calendar: renderCalendar, tracker: renderTracker, mocks: renderMocks, backup: renderBackup };
      views[view]();
      main.querySelectorAll(".scroll").forEach((el, i) => { if (scrolls[i]) [el.scrollLeft, el.scrollTop] = scrolls[i]; });
      if (view === "calendar" && !same) {
        const row = main.querySelector("tr.today");
        if (row) row.scrollIntoView({ block: "center" });
      }
      document.querySelectorAll("nav button").forEach((b) => {
        b.classList.toggle("active", b.dataset.view === view);
        b.setAttribute("aria-pressed", String(b.dataset.view === view));
      });
      shown = key;
    } finally {
      rendering = false;
    }
    if (queued) { queued = false; render(); }
  }
  function setView(v) {
    view = v;
    if (v === "today" && !BY_DATE[viewDate]) viewDate = todayISO();
    render();
  }
  document.querySelector("nav").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.view;
    if (!v) return;
    if (v === "today") viewDate = todayISO();
    setView(v);
  });
  render();
})();
