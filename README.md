# NEET PG 2027 Plan and Accountability App

Covers all 19 subjects, from 18 Oct 2026 to the exam, with a day-by-day plan and a tracker that works offline.

## Files

- `generate_schedule.py`: builds the plan. Edit `EXAM` and `PHASES` here, then run it again.
- `SCHEDULE.md`: the printable day-by-day plan (phases, subject allocation, one row per day).
- `data/schedule.json` and `data/schedule.js`: the plan as data. The app reads `schedule.js`.
- `index.html`, `app.js`, `styles.css`: the tracker. Open `index.html` in any browser. No server or install needed.

## Using the app

1. **Today**: tick blocks as you finish them. Enter questions solved and a short reflection each night. Use ◀ ▶ to move between days; before the plan starts, "Preview day 1" opens the first day.
2. **Calendar**: green days are 80% or more complete, amber days have some progress, and today is marked. Tap a day (or press Enter on it) to open it.
3. **Tracker**: starts empty. Add only the tasks you want, with the quick-add chips (Core BTR videos, Marrow RR videos, RR videos, PYQs, Revision 1 to 8) or your own typed name. Each task is a row and each of the 19 subjects is a column (Anatomy first, Anaesthesia last). Each task has an optional due date that you set yourself; blank means no due date. In each cell, tick Done and today's date fills in (you can change it; unticking clears it), then set confidence 1 to 5. The Today screen lists open tasks that are overdue or due in the next 7 days.
4. **Mocks**: log every full mock with score, total marks and weak areas. The average of your five most recent mocks (by date) shows your trend.
5. **Backup**: progress lives in this browser only. Export every Sunday. Importing asks before replacing anything, and a file that is not a backup changes nothing. Erase wipes all progress in this browser.

## Tracker checks

- **Overdue**: a task's due date has passed and that subject is not ticked Done.
- **Done without a date**: ticked Done but the finished-on date is blank.
- **Done but weak**: ticked Done with confidence 1 or 2.
- **Revision before core videos**: a revision task is done for a subject where no core-video task is done yet. Typed tasks with the word "revision" count as revision, and typed tasks with the word "core" count as core videos.
- **Weekly check-in**: warns after 3 or more days without any tracker update (ticking, dates, confidence, or adding, removing or re-dating a task).

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
