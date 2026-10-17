(function () {
  "use strict";
  const KEY = "neetpg2027-v1";
  const SCHED = window.NEET_SCHEDULE;
  const DAYS = SCHED.days;
  const BY_DATE = Object.fromEntries(DAYS.map((d) => [d.date, d]));
  const EXAM = new Date(SCHED.exam_date + "T00:00:00");
  const EMPTY = { done: {}, qbank: {}, reflect: {}, mocks: [], confidence: {} };
  const main = document.getElementById("app");
  let state = loadState();
  let view = "today";
  let viewDate = todayISO();

  // ---------- storage & dates ----------
  function loadState() {
    try { return Object.assign({}, EMPTY, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return Object.assign({}, EMPTY); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function isoOf(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function todayISO() { return isoOf(new Date()); }
  function shift(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d); }
  function fmt(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function daysLeft() { return Math.round((EXAM - new Date(todayISO() + "T00:00:00")) / 86400000); }

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

  // ---------- progress logic ----------
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
  // Unfinished work from the last 3 days: this is what the accountability banner shows.
  function unfinished() {
    const today = todayISO();
    const out = [];
    for (let k = 1; k <= 3; k++) {
      const day = BY_DATE[shift(today, -k)];
      if (day) day.blocks.filter((b) => !blockDone(b) && b.type !== "reflect").forEach((b) => out.push(b));
    }
    return out;
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

  function renderSubjects() {
    const rows = SCHED.subjects.map((s) => {
      const planned = DAYS.flatMap((d) => d.blocks).filter((b) => b.subject === s.name);
      const doneN = planned.filter(blockDone).length;
      const current = state.confidence[s.name] || 3;
      const select = h("select", {
        onchange: (e) => { state.confidence[s.name] = Number(e.target.value); save(); },
      }, ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: n === current }, String(n))));
      return h("tr", {}, h("td", {}, s.name), h("td", {}, `${doneN}/${planned.length} blocks`), h("td", {}, select));
    });
    main.replaceChildren(
      h("p", { class: "muted" }, "Rate confidence 1 (weak) to 5 (exam-ready). Be honest. Your weakest three subjects get extra Qbank in Phase 3."),
      h("div", { class: "scroll" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "Subject"), h("th", {}, "Study blocks done"), h("th", {}, "Confidence"))),
        h("tbody", {}, rows))));
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
          .then((t) => { state = Object.assign({}, EMPTY, JSON.parse(t)); save(); render(); alert("Progress imported."); })
          .catch(() => alert("That file is not a valid progress backup."));
      },
    });
    const reset = h("button", {
      class: "danger",
      onclick: () => {
        if (confirm("Erase ALL progress stored in this browser?")) {
          localStorage.removeItem(KEY); state = Object.assign({}, EMPTY); render();
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
    const views = { today: renderToday, calendar: renderCalendar, subjects: renderSubjects, mocks: renderMocks, backup: renderBackup };
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
