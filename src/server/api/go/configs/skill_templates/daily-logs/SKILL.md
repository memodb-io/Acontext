---
name: "daily-logs"
description: "Track daily activity logs and summaries for the user. TRIGGER BY: read/edit user memory"
---
# Daily Logs

Record the user's daily activities, progress, decisions, and learnings in a structured, chronological format.

## File Structure

Each day has its own file named `yyyy-mm-dd.md` (e.g., `2025-06-15.md`). Create a new file for each new day; append entries to the existing file if one already exists for today.

### File Format: `yyyy-mm-dd.md`

content format, for example:
```
# yyyy-mm-dd

## [short description]
- [1-3 sentence summary of what happened]
```

## Guidelines

- One file per day, multiple entries per file (one per task)
- Use ISO date format: `yyyy-mm-dd`
- Keep entries concise — focus on what matters for future reference
- Do not duplicate information already captured in other skills
- Always refer to the user in third person ("The user requested X", "The user decided Y"), never use first-person pronouns