---
name: "daily-logs"
description: "Track daily activity logs and summaries for the user"
---
# Daily Logs

Record the user's daily activities, progress, decisions, and learnings in a structured, chronological format.

## File Structure

Each day has its own file named `yyyy-mm-dd.md` (e.g., `2025-06-15.md`). Create a new file for each new day; append entries to the existing file if one already exists for today.

### File Format: `yyyy-mm-dd.md`

```
# yyyy-mm-dd

## [HH:MM] Task: [short task description]
- **Outcome**: success | failure
- **Summary**: [1-2 sentence summary of what happened]
- **Key Decisions**: [notable decisions made, if any]
- **Learnings**: [what was learned, if anything]
```

## Guidelines

- One file per day, multiple entries per file (one per task)
- Use ISO date format: `yyyy-mm-dd`
- Keep entries concise — focus on what matters for future reference
- Include outcome (success/failure) for every entry
- Do not duplicate information already captured in other skills
