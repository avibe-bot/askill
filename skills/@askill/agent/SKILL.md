---
name: agent
description: Learn how to use and manage installed skills effectively
version: 1.0.0
author:
  name: askill
  github: askill
tags:
  - meta
  - skills
  - official
---

# askill Agent Guide

This skill teaches you how to work with skills installed via askill.

## Understanding Skills

Skills are capabilities installed to enhance your abilities. Each skill:
- Has a SKILL.md file with instructions
- May have commands you can run
- May depend on other skills

## Finding Installed Skills

Skills are installed in the `.askill/skills/` directory (project-level) or `~/.askill/skills/` (global).

To see what skills are available:

```bash
askill list
```

Or check the skills directory directly:
- Project skills: `./.askill/skills/`
- Global skills: `~/.askill/skills/`

## Reading Skill Instructions

Each skill has a SKILL.md file. When a user asks you to do something that might involve a skill:

1. Check if a relevant skill is installed
2. Read the skill's SKILL.md file
3. Follow the instructions provided

Example:
```
User: "Help me manage my memory across sessions"

You: Let me check for memory-related skills...
     [Read .askill/skills/@anthropic/memory/SKILL.md]
     Found @anthropic/memory skill. Following its instructions...
```

## Running Skill Commands

Skills may define commands. Run them with:

```bash
askill run <skill>:<command> [arguments]
```

### Finding Available Commands

1. Read the skill's SKILL.md frontmatter for `commands:` section
2. Or look for a "Commands" section in the documentation

### Example

If a skill defines:

```yaml
commands:
  save:
    run: python scripts/save.py
    description: Save data
```

Run it with:

```bash
askill run @scope/skillname:save --key mykey --value myvalue
```

### Setup Commands

Commands starting with `_` are internal. The `_setup` command installs dependencies:

```bash
askill run @scope/skillname:_setup
```

Run this if a skill's command fails due to missing dependencies.

## Handling Prerequisites

Skills may have prerequisites (system tools, environment setup). When you encounter a skill with prerequisites:

1. Read the "Prerequisites" section
2. Check if requirements are met
3. If not, help the user install them

Example:
```markdown
## Prerequisites
- Python 3.10+
- FFmpeg (`brew install ffmpeg` on macOS)
```

You should:
1. Check: `python3 --version`
2. Check: `ffmpeg -version`
3. If missing, suggest installation

## Skill Dependencies

Skills can depend on other skills. The `skills:` field in frontmatter lists dependencies:

```yaml
skills:
  - @anthropic/tools@^1.0.0
  - @askill/git@^2.0.0
```

These are automatically installed by askill. If a dependency is missing, suggest:

```bash
askill add <skill-slug>
```

## Best Practices

### 1. Always Read First

Before using a skill, read its SKILL.md completely. Skills contain specific instructions that may differ from general knowledge.

### 2. Use Commands When Available

If a skill provides commands, prefer using them over improvising:

```bash
# Good: Use the skill's command
askill run @skill/name:action

# Less ideal: Manually running scripts
python ~/.askill/skills/@skill/name/scripts/action.py
```

### 3. Handle Errors Gracefully

If a skill command fails:
1. Check if setup is needed (`askill run @skill/name:_setup`)
2. Check prerequisites
3. Read error messages and troubleshoot

### 4. Respect Skill Boundaries

Each skill has a specific purpose. Don't try to use a skill for something outside its scope.

## Troubleshooting

### "Command not found"

The skill might not define that command. Check the SKILL.md for available commands.

### "Module not found" / Import errors

Run the setup command:
```bash
askill run @scope/skillname:_setup
```

### "Skill not found"

The skill might not be installed:
```bash
askill add @scope/skillname
```

### "Permission denied"

The script might need execute permission:
```bash
chmod +x ~/.askill/skills/@scope/skillname/scripts/script.sh
```

## Example Workflow

User: "Review my code changes"

You:
1. Check for relevant skills: `askill list` or check `.askill/skills/`
2. Find `@anthropic/code-reviewer` is installed
3. Read `.askill/skills/@anthropic/code-reviewer/SKILL.md`
4. Follow instructions:
   - Check prerequisites (Python 3.10+)
   - Run command: `askill run @anthropic/code-reviewer:review`
5. Present results to user

## Summary

- **Discover**: `askill list` or check skills directory
- **Learn**: Read the skill's SKILL.md
- **Execute**: `askill run skill:command`
- **Setup**: `askill run skill:_setup` if needed
- **Troubleshoot**: Check prerequisites and dependencies
