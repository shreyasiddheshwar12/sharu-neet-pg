(function () {
  "use strict";
  const KEY = "neetpg2027-v1";
  const SCHED = window.NEET_SCHEDULE;
  const DAYS = SCHED.days;
  const BY_DATE = Object.fromEntries(DAYS.map((d) => [d.date, d]));
  const EXAM = new Date(SCHED.exam_date + "T00:00:00");
  const main = document.getElementById("app");

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

  // ---------- storage & dates ----------
  function emptyState() {
    return { done: {}, qbank: {}, reflect: {}, mocks: [], tasks: [], tracker: {}, lastUpdate: null };
  }
  function loadState() {
    let s;
    try { s = Object.assign(emptyState(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { s = emptyState(); }
    // Keep anything saved by the earlier version: rebuild its task list from the tracker keys, no dates added.
    if (!Array.isArray(s.tasks)) s.tasks = [];
    Object.keys(s.tracker || {}).forEach((k) => {
      const id = k.split("|")[1];
      if (id && !s.tasks.find((t) => t.id === id)) {
        const known = SUGGESTIONS.find((x) => x.id === id);
        s.tasks.push({ id, name: known ? known.name : id, due: "", kind: known ? known.kind : "custom" });
      }
    });
    return s;
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
    const t = h("div", { class: "toast" }, msg);
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
  }
  const CHEERS = ["Nice work! 🦋", "One more down ✨", "Look at you go 💪", "Progress, not perfection 🌱", "Logged. Keep going!"];
  const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];

  // ---------- daily plan logic ----------
  function blockDone(b) { return !!state.done[b.id]; }
  function dayStats(day) { return { done: day.blocks.filter(blockDone).length, total: day.blocks.length }; }
  // A day counts as "kept" when at least 80% of its blocks are ticked.
  function dayOk(iso) {
    const day = BY_DATE[iso];
    if (!day) return false;
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
    const blocks = DAYS.flatMap((d) => d.blocks);
    const done = blocks.filter(blockDone).length;
    return { done, total: blocks.length, pct: Math.round((100 * done) / blocks.length) };
  }
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
  function tasks() { return state.tasks || []; }
  function taskById(id) { return tasks().find((t) => t.id === id); }
  function cellOf(subject, taskId) { return state.tracker[`${subject}|${taskId}`] || {}; }
  function setCell(subject, taskId, patch) {
    state.tracker[`${subject}|${taskId}`] = Object.assign({}, cellOf(subject, taskId), patch);
    state.lastUpdate = todayISO();
    save();
  }
  function setTask(id, patch) { Object.assign(taskById(id), patch); save(); }
  function addTask(t) { state.tasks.push(t); save(); }
  function removeTask(id) {
    state.tasks = tasks().filter((t) => t.id !== id);
    Object.keys(state.tracker).forEach((k) => { if (k.endsWith(`|${id}`)) delete state.tracker[k]; });
    save();
  }
  function isLate(task, cell) { return !cell.done && !!task.due && task.due < todayISO(); }
  function cellClass(subject, task) {
    const c = cellOf(subject, task.id);
    if (c.done) return c.conf && c.conf <= 2 ? "done weak" : "done";
    return isLate(task, c) ? "overdue" : "";
  }
  function trackerIssues() {
    const out = { overdue: [], noDate: [], lowConf: [], seq: [] };
    const core = tasks().find((t) => t.kind === "core");
    SUBJECTS.forEach((s) => tasks().forEach((t) => {
      const c = cellOf(s.name, t.id);
      const label = `${s.name} · ${t.name}`;
      if (isLate(t, c)) out.overdue.push(`${label} (due ${shortDate(t.due)})`);
      if (c.done && !c.date) out.noDate.push(label);
      if (c.done && c.conf && c.conf <= 2) out.lowConf.push(label);
      if (t.kind === "rev" && c.done && core && !cellOf(s.name, core.id).done) out.seq.push(label);
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
          h("span", { class: "time" }, `${b.start}–${b.end}`),
          h("span", { class: "tag" }, b.type)),
        h("div", { class: "title" }, b.title),
        h("small", { class: "detail" }, b.detail)));
  }

  function renderToday() {
    const wrap = h("section", {});
    const late = unfinished();
    if (viewDate === todayISO() && late.length) {
      wrap.append(h("div", { class: "banner" },
        `⚠️ ${late.length} unfinished block(s) from the last 3 days. Move them into today's catch-up buffer or Saturday's buffer.`));
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
    const day = BY_DATE[viewDate];
    if (!day) {
      wrap.append(h("p", { class: "empty" }, viewDate < DAYS[0].date ? `Plan starts ${fmt(DAYS[0].date)}.` : "No plan for this date."));
    } else {
      const s = dayStats(day);
      wrap.append(h("div", { class: "row", style: "justify-content:space-between" },
        h("div", { class: "row" },
          h("button", { class: "chip", onclick: () => { viewDate = shift(viewDate, -1); render(); } }, "◀"),
          h("strong", {}, `${fmt(day.date)}`),
          h("button", { class: "chip", onclick: () => { viewDate = shift(viewDate, 1); render(); } }, "▶")),
        h("span", { class: "muted" }, day.phase)));
      wrap.append(h("p", { class: "muted", style: "margin:4px 0 0" }, day.focus + (day.mock ? "  ·  🎯 MOCK DAY" : "")));
      wrap.append(h("div", { class: "progress" }, h("i", { style: `width:${Math.round((100 * s.done) / s.total)}%` })));
      const list = h("div", { class: "blocks" });
      day.blocks.forEach((b) => list.append(blockRow(b)));
      wrap.append(list);
      wrap.append(h("label", { class: "field" },
        `Questions solved today (target ${day.qbank_target})`,
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
      h("p", { class: "muted" }, "Tap a day to open it. Green = at least 80% done. Amber = some progress."),
      h("div", { class: "scroll card", style: "padding:0" }, h("table", { class: "cal" },
        h("thead", {}, h("tr", {}, h("th", {}, "Date"), h("th", {}, "Phase"), h("th", {}, "Focus"), h("th", {}, "Done"))),
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
      const kind = /revision/i.test(name) ? "rev" : /core/i.test(name) ? "core" : "custom";
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
              setCell(subject, task.id, { done: on, date: on ? c.date || todayISO() : c.date });
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
      h("input", { type: "number", name: "score", placeholder: "Score", min: "0", required: true }),
      h("input", { type: "number", name: "total", placeholder: "Total marks", value: "800", min: "1" }),
      h("input", { type: "text", name: "note", placeholder: "Weak areas" }),
      h("button", { class: "primary", type: "submit" }, "Add mock"));
    const last5 = state.mocks.slice(-5);
    const avg = last5.length
      ? Math.round(last5.reduce((a, m) => a + (100 * m.score) / m.total, 0) / last5.length)
      : null;
    const rows = state.mocks.map((m, idx) => h("tr", {},
      h("td", {}, m.date),
      h("td", {}, `${m.score}/${m.total}`),
      h("td", {}, `${Math.round((100 * m.score) / m.total)}%`),
      h("td", {}, m.note),
      h("td", {}, h("button", { class: "icon danger", onclick: () => { state.mocks.splice(idx, 1); save(); render(); } }, "✕"))));
    main.replaceChildren(
      h("div", { class: "card" }, h("h3", {}, "🎯 Mocks"),
        h("p", { class: "muted" }, avg === null
          ? "No mocks yet. Log one after every full mock."
          : `Average of your last ${last5.length} mock(s): ${avg}% of total.`),
        form),
      h("div", { class: "scroll card", style: "padding:0" }, h("table", {},
        h("thead", {}, h("tr", {}, ...["Date", "Score", "%", "Weak areas", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, rows))));
  }

  function renderBackup() {
    const exportBtn = h("button", {
      class: "primary",
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
          .then((t) => { state = Object.assign(emptyState(), JSON.parse(t)); save(); render(); toast("Progress imported ✨"); })
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
    main.replaceChildren(h("div", { class: "card" },
      h("h3", {}, "💾 Backup"),
      h("p", { class: "muted" }, "Progress is stored in this browser only. Export every Sunday and keep the file somewhere safe."),
      h("div", { class: "row" }, exportBtn, h("label", { class: "muted" }, "Import: ", fileIn)),
      h("div", { class: "row" }, reset)));
  }

  // ---------- navigation ----------
  function render() {
    document.getElementById("countdown-num").textContent = daysLeft();
    document.getElementById("quote").textContent = QUOTES[new Date().getDate() % QUOTES.length];
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
    const v = e.target.closest("button")?.dataset.view;
    if (!v) return;
    if (v === "today") viewDate = todayISO();
    setView(v);
  });
  render();
})();
