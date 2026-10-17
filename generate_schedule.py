#!/usr/bin/env python3
"""Builds the NEET PG 2027 study plan.

Writes:
  data/schedule.json  machine-readable plan
  data/schedule.js    same data as a browser global, so index.html works offline
  SCHEDULE.md         human-readable day-by-day plan

Change EXAM or PHASES below, then run:  python3 generate_schedule.py
"""
import datetime as dt
import json
import math
import pathlib
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent
EXAM = dt.date(2027, 5, 15)  # PLACEHOLDER: replace with the official NEET PG 2027 exam date

# subject -> (weight, major topics). Weight decides how many study slots a subject gets.
SUBJECTS = {
    "Medicine": (6, ["Cardiology", "Respiratory", "Gastroenterology & hepatology", "Nephrology", "Endocrinology",
                     "Haematology", "Neurology", "Infectious & tropical diseases", "Rheumatology", "Emergency & critical care"]),
    "Surgery": (5, ["GI & hepatobiliary surgery", "Breast & thyroid", "Trauma & ATLS", "Vascular surgery", "Urology",
                    "Neurosurgery", "Burns & plastic surgery", "Paediatric surgery", "Surgical oncology", "Perioperative care & shock"]),
    "Obstetrics & Gynaecology": (4, ["Antenatal care & complications", "Labour & intrapartum care", "Puerperium & lactation",
                                     "Menstrual disorders & infertility", "Contraception", "Gynaecological oncology",
                                     "Obstetric emergencies (PPH, eclampsia)", "Neonatal care & family planning"]),
    "Paediatrics": (3, ["Neonatology", "Growth, development & nutrition", "Immunisation", "Childhood infections",
                        "Genetics & inborn errors", "Paediatric cardiology & respiratory", "Neurology & developmental disorders",
                        "Paediatric emergencies"]),
    "Community Medicine (PSM)": (3, ["Epidemiology & biostatistics", "Study designs & screening", "National health programmes",
                                     "Nutrition & vitamins", "Occupational & environmental health", "Communicable disease control",
                                     "Vital statistics & health economics", "Health care management & planning"]),
    "Pharmacology": (3, ["Autonomic & cardiovascular drugs", "CNS drugs", "Chemotherapy & antimicrobials",
                         "Autacoids & respiratory drugs", "Endocrine & GIT drugs", "Toxicology & antidotes",
                         "General pharmacology (PK/PD)", "Immunosuppressants & haematinics"]),
    "Pathology": (3, ["Cell injury & inflammation", "Neoplasia", "Haematopathology", "Immunopathology",
                      "CVS & respiratory pathology", "GI & renal pathology", "Bone, CNS & endocrine pathology", "Genetic disorders"]),
    "Microbiology": (3, ["General bacteriology", "Virology", "Mycology & parasitology", "Immunology",
                         "Sterilisation & lab diagnosis", "Antimicrobials & resistance", "Hospital infection control",
                         "Systematic bacteriology"]),
    "Anatomy": (3, ["Upper & lower limb", "Thorax & abdomen", "Head, neck & neuroanatomy", "Pelvis & perineum",
                    "Embryology", "Histology", "Surface & radiological anatomy", "Clinical correlations"]),
    "Physiology": (3, ["Cell, nerve & muscle", "Cardiovascular physiology", "Respiration", "Renal & body fluids",
                       "GIT & endocrine", "Neurophysiology & special senses", "Reproduction", "Blood & haematology"]),
    "Biochemistry": (2, ["Metabolism & enzymes", "Carbohydrate & lipid metabolism", "Amino acids & proteins",
                         "Vitamins & minerals", "Molecular biology", "Clinical biochemistry & lab tests", "Nutrition",
                         "Acid-base & electrolytes"]),
    "ENT": (2, ["Ear: otitis & hearing loss", "Nose & paranasal sinuses", "Pharynx & larynx", "Oral cavity & neck",
                "Head & neck oncology", "ENT emergencies & foreign bodies", "Facial nerve & vertigo", "Tracheostomy & audiology"]),
    "Ophthalmology": (2, ["Anatomy, optics & refraction", "Glaucoma", "Cataract", "Retina", "Cornea & conjunctiva",
                          "Uveitis & neuro-ophthalmology", "Squint & paediatric eye", "Ocular trauma & ocular pharmacology"]),
    "Orthopaedics": (2, ["Trauma & fractures", "Upper limb", "Lower limb", "Spine", "Bone infections & tumours",
                         "Paediatric orthopaedics", "Metabolic & neuromuscular", "Arthritis & joint replacement"]),
    "Psychiatry": (2, ["Classification & psychopathology", "Schizophrenia & psychosis", "Mood disorders", "Anxiety & OCD",
                       "Substance use", "Personality, sleep & sexual disorders", "Child psychiatry", "Psychopharmacology & ECT"]),
    "Dermatology": (2, ["Infections & infestations", "Papulosquamous disorders", "Vesiculobullous disorders",
                        "Pigmentary disorders", "STDs & leprosy", "Hair & nail disorders", "Skin tumours",
                        "Drug reactions & cutaneous signs"]),
    "Anaesthesia": (2, ["Pre-operative assessment & airway", "Inhalational & IV agents", "Muscle relaxants & reversal",
                        "Regional anaesthesia", "Monitoring & ventilation", "Resuscitation (ACLS)",
                        "Fluids & blood transfusion", "Pain & ICU"]),
    "Forensic Medicine": (2, ["Medical jurisprudence & law", "Identification", "Injuries & wounds", "Asphyxial deaths",
                              "Forensic toxicology", "Sexual offences", "Postmortem changes & time of death",
                              "Forensic psychiatry & ethics"]),
    "Radiology": (1, ["Radiation physics & safety", "Chest imaging", "GI & abdominal imaging", "CNS imaging",
                      "Musculoskeletal imaging", "Obstetric & paediatric imaging", "Interventional radiology & contrast",
                      "Nuclear medicine"]),
}

PHASES = [
    {"name": "P1 Foundation", "start": dt.date(2026, 10, 18), "end": dt.date(2026, 12, 31), "new": True,
     "qbank": 50, "mock_days": [],
     "goal": "First pass through all 19 subjects. High-yield subjects get more days."},
    {"name": "P2 Depth", "start": dt.date(2027, 1, 1), "end": dt.date(2027, 2, 28), "new": True,
     "qbank": 80, "mock_days": [],
     "goal": "Second pass: textbook chapters with Qbank after every topic. Weekly timed test on Sundays."},
    {"name": "P3 Revision", "start": dt.date(2027, 3, 1), "end": dt.date(2027, 4, 10), "new": False,
     "qbank": 100, "mock_days": [2, 6],
     "goal": "Rapid revision of all subjects. Two full mocks a week (Wed, Sun)."},
    {"name": "P4 Simulation", "start": dt.date(2027, 4, 11), "end": EXAM - dt.timedelta(days=1), "new": False,
     "qbank": 150, "mock_days": [0, 2, 4, 6],
     "goal": "Full mocks Mon/Wed/Fri/Sun, PYQs and error log. No new content."},
]


def B(start, end, kind, title, detail, subject=None):
    return {"start": start, "end": end, "type": kind, "title": title, "detail": detail, "subject": subject}


def allocate(total):
    weight_sum = sum(w for w, _ in SUBJECTS.values())
    exact = {s: total * w / weight_sum for s, (w, _) in SUBJECTS.items()}
    alloc = {s: math.floor(v) for s, v in exact.items()}
    spare = total - sum(alloc.values())
    for s in sorted(exact, key=lambda s: exact[s] - alloc[s], reverse=True)[:spare]:
        alloc[s] += 1
    return alloc


def interleave(alloc):
    remaining = dict(alloc)
    order = list(alloc)
    seq, last = [], None
    while any(remaining.values()):
        options = [s for s in order if remaining[s] > 0 and s != last] or [s for s in order if remaining[s] > 0]
        pick = max(options, key=lambda s: remaining[s])
        seq.append(pick)
        remaining[pick] -= 1
        last = pick
    return seq


def plan_slots(n_days):
    """Two new-topic slots per day. Each subject's topics are spread evenly over its slots."""
    alloc = allocate(2 * n_days)
    seen = Counter()
    out = []
    for s in interleave(alloc):
        k = seen[s]
        seen[s] += 1
        topics = SUBJECTS[s][1]
        out.append((s, topics[min(int(k * len(topics) / alloc[s]), len(topics) - 1)]))
    return out


def phase_for(d):
    for ph in PHASES:
        if ph["start"] <= d <= ph["end"]:
            return ph
    raise ValueError(f"no phase for {d}")


def day_record(d, phase, focus, qbank, is_mock, blocks):
    return {
        "date": d.isoformat(),
        "weekday": d.strftime("%a"),
        "phase": phase,
        "focus": focus,
        "qbank_target": qbank,
        "mock": is_mock,
        "blocks": [dict(b, id=f"{d.isoformat()}-{n}") for n, b in enumerate(blocks, 1)],
    }


def build_new_topic_day(d, ph, slots, i):
    a, b = slots[2 * i], slots[2 * i + 1]
    back = 2 * i - 6
    rev = slots[back][0] if back >= 0 else "earlier topics"
    label = "New" if ph["name"].startswith("P1") else "Second pass"
    half = ph["qbank"] // 2
    blocks = [
        B("07:00", "09:00", "study", f"{label}: {a[0]} — {a[1]}", "Read or watch, then write a 10-line summary from memory", a[0]),
        B("09:15", "11:15", "study", f"{label}: {b[0]} — {b[1]}", "Same method; list every high-yield point", b[0]),
        B("11:30", "12:30", "qbank", f"Qbank: {a[0]} ({half} Q)", "Solve blind; review every wrong or guessed question", a[0]),
        B("14:00", "15:30", "revise", f"Spaced revision: {rev}", "Blank-page recall first, then check your notes"),
        B("15:45", "17:15", "notes", f"Flashcards & tables: {a[0]} + {b[0]}", "One-liners and comparison tables"),
        B("17:30", "18:30", "qbank", f"Qbank: {b[0]} ({half} Q)", "Same rules as the morning set", b[0]),
        B("20:30", "21:00", "reflect", "Error log & tomorrow's plan", "Log why each wrong answer was wrong; set tomorrow's blocks"),
    ]
    if d.weekday() == 6:  # Sunday
        if ph["name"].startswith("P2"):
            blocks[5] = B("17:30", "18:30", "mock", "Weekly timed test (50 mixed Q)", "Exam conditions; review every error")
        else:
            blocks[5] = B("17:30", "18:30", "qbank", "Weekly review: redo this week's wrong Qs", "Only questions you got wrong or guessed")
    if d.weekday() == 5:  # Saturday: buffer for anything missed this week
        blocks[3:5] = [B("14:00", "17:15", "buffer", "Catch-up buffer",
                         "Missed blocks from this week go here first; if none, do a 2-hour Qbank set")]
    return day_record(d, ph["name"], f"{a[0]} · {b[0]}", ph["qbank"], False, blocks)


def build_revision_day(d, ph, i):
    rot = list(SUBJECTS)
    r1, r2 = rot[(2 * i) % len(rot)], rot[(2 * i + 1) % len(rot)]
    is_mock = d.weekday() in ph["mock_days"]
    p4 = ph["name"].startswith("P4")
    blocks = [
        B("07:00", "08:30", "revise", f"Rapid revision: {r1}", "One pass through tables, mnemonics and high-yield lists", r1),
        B("08:45", "10:15", "revise", f"Rapid revision: {r2}", "One pass through tables, mnemonics and high-yield lists", r2),
    ]
    if is_mock:
        blocks += [
            B("10:30", "14:00", "mock", "Full mock (200 Q, 3.5 h, timed)", "Exam conditions: no phone, no breaks beyond the official ones"),
            B("14:30", "16:30", "mock", "Mock review", "Every wrong or guessed question: reason, fix, flashcard"),
        ]
    else:
        blocks += [
            B("10:30", "12:30", "qbank", ("PYQ: " if p4 else "Qbank: ") + f"{ph['qbank']} mixed Q",
              "Timed in two sets; review every error"),
            B("14:00", "16:00", "study", "Weak-subject deep dive",
              "Your lowest-scoring subject from the Mocks tab; notes plus one textbook chapter"),
        ]
    blocks += [
        B("17:00", "18:00", "notes", "Mistake notebook", "Rewrite the 20 most recent errors in one line each"),
        B("20:30", "21:00", "reflect", "Error log & tomorrow's plan", "Update the Mocks tab if you took a mock"),
    ]
    focus = ("Full mock + review · " if is_mock else "") + f"Revise: {r1} · {r2}"
    return day_record(d, ph["name"], focus, ph["qbank"], is_mock, blocks)


def build_days(plans):
    days = []
    d = PHASES[0]["start"]
    while d <= EXAM:
        if d == EXAM:
            days.append(day_record(d, "Exam", "NEET PG 2027: exam day", 0, False, [
                B("08:00", "12:00", "exam", "NEET PG 2027: exam day", "Light breakfast, admit card, reach the centre early")]))
        elif d == EXAM - dt.timedelta(days=1):
            days.append(day_record(d, "P4 Simulation", "Exam eve: light recall only", 0, False, [
                B("09:00", "10:30", "revise", "Light recall of your error log", "Read only; no new questions"),
                B("20:00", "21:00", "reflect", "Pack and sleep", "Admit card, photo ID, pen and water ready; in bed by 22:00")]))
        else:
            ph = phase_for(d)
            i = (d - ph["start"]).days
            if ph["new"]:
                days.append(build_new_topic_day(d, ph, plans[ph["name"]], i))
            else:
                days.append(build_revision_day(d, ph, i))
        d += dt.timedelta(days=1)
    return days


def render_markdown(data, plans):
    lines = [
        "# NEET PG 2027: Day-by-Day Plan", "",
        f"Exam date used: **{EXAM:%A, %d %B %Y}**. This is a placeholder. Set the official date in "
        "`generate_schedule.py` and run it again.", "",
        "## Phases", "",
        "| Phase | Dates | Goal | Qbank / day |", "|---|---|---|---|",
    ]
    for p in data["phases"]:
        s, e = dt.date.fromisoformat(p["start"]), dt.date.fromisoformat(p["end"])
        lines.append(f"| {p['name']} | {s:%d %b %Y} – {e:%d %b %Y} | {p['goal']} | {p['qbank']} |")
    c1 = Counter(s for s, _ in plans["P1 Foundation"])
    c2 = Counter(s for s, _ in plans["P2 Depth"])
    lines += ["", "## Subject allocation", "",
              "Each study day has two new-topic slots of about 2 hours. Weight reflects how heavily a subject is usually tested.", "",
              "| Subject | Weight | Phase 1 (days) | Phase 2 (days) | Major topics |", "|---|---|---|---|---|"]
    for s in data["subjects"]:
        n = s["name"]
        lines.append(f"| {n} | {s['weight']} | {c1[n] / 2:.1f} | {c2[n] / 2:.1f} | {len(s['topics'])} |")
    lines += ["", "## Daily rhythm", "",
              "- 07:00–11:15: two new-topic blocks (Phases 1–2) or rapid revision (Phases 3–4)",
              "- 11:30–18:30: Qbank with mandatory error review, revision, or a mock",
              "- 20:30–21:00: error log and tomorrow's plan. Non-negotiable.", "",
              "## Weekly rules", "",
              "- Saturday is the catch-up buffer. Anything missed during the week moves there first.",
              "- Sunday ends with a weekly test (Phase 2) or a redo of the week's wrong questions (Phase 1).",
              "- Two mock days a week from March 1; four from April 11.", "",
              "## Day by day", "",
              "| Date | Day | Phase | Focus | Qbank target | Mock |", "|---|---|---|---|---|---|"]
    for d in data["days"]:
        dd = dt.date.fromisoformat(d["date"])
        lines.append(f"| {dd:%d %b %Y} | {d['weekday']} | {d['phase']} | {d['focus']} | {d['qbank_target']} | {'Yes' if d['mock'] else ''} |")
    return "\n".join(lines) + "\n"


def main():
    plans = {ph["name"]: plan_slots((ph["end"] - ph["start"]).days + 1) for ph in PHASES if ph["new"]}
    days = build_days(plans)
    data = {
        "exam_date": EXAM.isoformat(),
        "phases": [{"name": p["name"], "start": p["start"].isoformat(), "end": p["end"].isoformat(),
                    "goal": p["goal"], "qbank": p["qbank"]} for p in PHASES],
        "subjects": [{"name": s, "weight": w, "topics": t} for s, (w, t) in SUBJECTS.items()],
        "days": days,
    }
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "schedule.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (ROOT / "data" / "schedule.js").write_text(
        "window.NEET_SCHEDULE = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    (ROOT / "SCHEDULE.md").write_text(render_markdown(data, plans), encoding="utf-8")
    print(f"{len(days)} days written: {days[0]['date']} -> {days[-1]['date']}; subjects: {len(SUBJECTS)}")


if __name__ == "__main__":
    main()
