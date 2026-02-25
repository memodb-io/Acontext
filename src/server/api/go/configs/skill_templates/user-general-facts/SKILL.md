---
name: "user-general-facts"
description: "Capture and organize general facts about the user by topic"
---
# User General Facts

Learn and recall general facts about the user — preferences, background, goals, and other persistent information that helps personalize interactions.

## File Structure

Organize facts into topic-specific files named `[TOPIC].md`. Create a new file when a new category of facts is discovered; update the existing file when new facts are found for that topic.

### File Format: `[TOPIC].md`

```
# [Topic Name]

- [third-person fact about the user, e.g. "The user prefers TypeScript"]
- [third-person fact about the user, e.g. "The user's name is Gus"]
```

### Example Topics

- `coding-preferences.md` — preferred languages, frameworks, code style conventions
- `tech-stack.md` — tools, services, and infrastructure the user works with
- `communication-style.md` — how the user prefers to interact (concise vs. detailed, etc.)
- `work-context.md` — role, team, projects, company details
- `goals.md` — current objectives, priorities, long-term goals

## Guidelines

- One topic per file — do not mix unrelated facts in the same file
- Use lowercase kebab-case for file names (e.g., `coding-preferences.md`)
- Choose clear, broad topic names
- Update existing facts when corrections are provided — do not keep stale information
- Keep facts concise, objective, and actionable
- Only record facts explicitly stated or clearly demonstrated by the user — do not speculate
- **Always use third-person pronouns** when referring to the user. Write "The user prefers X" or "The user's name is Y", never "I prefer X" or "My name is Y". These files are read by agents who would mistake first-person "I" as referring to themselves.
