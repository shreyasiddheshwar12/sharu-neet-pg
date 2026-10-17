# NEET PG 2027 Plan and Accountability App

Covers all 19 subjects, from 18 Oct 2026 to the exam, with a day-by-day plan and a tracker that works offline.

## Files

- `generate_schedule.py`: builds the plan. Edit `EXAM` and `PHASES` here, then run it again.
- `SCHEDULE.md`: the printable day-by-day plan (phases, subject allocation, one row per day).
- `data/schedule.json` and `data/schedule.js`: the plan as data. The app reads `schedule.js`.
- `index.html`, `app.js`, `styles.css`: the tracker. Open `index.html` in any browser. No server or install needed.

## Using the app

1. **Today**: tick blocks as you finish them. Enter questions solved and a short reflection each night.
2. **Calendar**: green days are 80% or more complete, amber days have some progress. Tap a day to open it.
3. **Tracker**: one column per subject (Anatomy to Anaesthesia), one row per task (core videos, RR videos, PYQs, revisions 1-8). Tick Done, the date fills in automatically, and set confidence. The check panel flags overdue tasks, weak subjects and missed sequence. The Today screen lists tasks due in the next 7 days.
4. **Mocks**: log every full mock with score and weak areas. The average of the last five shows your trend.
5. **Backup**: progress lives in this browser only. Export every Sunday.

## Rules the app enforces

- If unfinished blocks from the last 3 days exist, the Today screen shows them. They go into the Saturday buffer, not the bin.
- The streak counts days with 80% or more of blocks done. Today is allowed to be incomplete.

## Changing the exam date

The date in `generate_schedule.py` is a placeholder. Set the official date, then run:

```
python3 generate_schedule.py
```

Your progress in the browser is kept, because it is keyed by block ID and block IDs are date-based. Blocks on dates that move will reset, so export your backup first.

## Caveats

- Topic lists are the major areas by subject, not the full syllabus. Check them against the official NBEMS syllabus and your chosen books.
- Subject weights are planning estimates for time allocation. Verify against recent papers.
