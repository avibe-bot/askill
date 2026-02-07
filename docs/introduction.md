# Introduction to askill

> The Agent-Native Skill Package Manager

## What is askill?

askill is a package manager designed specifically for AI agents. Just as npm manages packages for Node.js developers, askill manages skills for AI agents like Claude Code, Codex, OpenCode, OpenClaw, Cursor, and others.

## The Problem

AI agents are becoming increasingly capable, but they lack a standardized way to:

1. **Discover capabilities** - How does an agent know what skills are available?
2. **Install skills** - How do you add new capabilities to your agent?
3. **Share skills** - How do skill authors distribute their work?
4. **Manage dependencies** - How do skills depend on other skills?
5. **Trust skill safety** - How do you avoid risky or malicious skills mixed into public repos?

Currently, each agent has its own ad-hoc approach:
- Claude Code uses `.claude/` directory with markdown files
- Cursor uses `.cursor/rules/`
- Others have their own conventions

This fragmentation makes it hard for the ecosystem to grow.

## The Solution

askill provides:

### 1. A Universal Protocol

The **SKILL.md** format - a single file that contains everything an agent needs:

```markdown
---
name: code-reviewer
description: Review code for bugs and style issues
version: 1.0.0
dependencies:
  - @askill/git@^1.0.0
commands:
  review:
    run: python scripts/review.py
    description: Review staged changes
---

# Code Reviewer

When asked to review code, analyze it for:
- Potential bugs
- Security vulnerabilities
- Style inconsistencies
...
```

### 2. A Unified CLI

One command to install skills across all supported agents:

```bash
# Install a skill
askill install @anthropic/memory

# The skill is automatically configured for:
# - Claude Code (.claude/skills/)
# - Cursor (.cursor/skills/)
# - Windsurf (.windsurf/skills/)
# - And 40+ other agents
```

### 3. An Agent-First Design

Traditional package managers are designed for humans to read JSON configs and run commands. askill is designed for agents:

- **Natural language setup instructions** - Agents read and execute them
- **Unified command interface** - `askill run skill:command` works everywhere
- **Smart dependency resolution** - Skills can depend on other skills

### 4. Strict AI Skill Scoring

Every indexed skill is scored by AI across five dimensions: **Safety, Clarity, Reusability, Completeness, and Actionability**.

- **Safety first** - risky or malicious skills are filtered out early
- **Quality ranking** - excellent skills are promoted to top positions
- **Transparent evaluation** - users can compare skill quality before installing

## Design Philosophy

### 1. Progressive Disclosure

Simple skills are simple to write:

```markdown
---
name: my-skill
description: Does something useful
---

# My Skill

Instructions for the agent...
```

Advanced features are available when needed:

```yaml
---
name: advanced-skill
version: 2.1.0
dependencies:
  - @dep/one@^1.0.0
  - @dep/two@^2.0.0
commands:
  build:
    run: npm run build
    description: Build the project
---
```

### 2. Agent-Native, Not Human-Native

We don't try to make the CLI do everything. Instead:

| Task | Who handles it |
|------|---------------|
| Download skills | askill CLI |
| Parse dependencies | askill CLI |
| Install system deps | Agent reads instructions |
| Run setup scripts | Agent decides when |
| Execute commands | askill CLI (unified interface) |

### 3. Open Ecosystem

- **Indexed skills**: Automatically discovered from GitHub
- **Published skills**: Authors publish to askill.sh
- **No gatekeeping**: Anyone can publish under their scope

## Key Concepts

### Slugs

Every skill has a unique identifier (slug):

| Type | Format | Example |
|------|--------|---------|
| Published (scoped) | `@scope/name` | `@anthropic/memory` |
| Indexed (GitHub) | `gh:owner/repo/path` | `gh:facebook/react/scripts/errors` |

### Skills Directory Structure

Skills are installed to each agent's specific directory and symlinked from a canonical location:

```
project/
├── .agents/skills/              # Canonical location (source of truth)
│   └── memory/
│       └── SKILL.md
├── .claude/skills/              # Claude Code (symlink)
│   └── memory -> ../../.agents/skills/memory
├── .opencode/skills/            # OpenCode (symlink)
│   └── memory -> ../../.agents/skills/memory
└── .cursor/skills/              # Cursor (symlink)
    └── memory -> ../../.agents/skills/memory

~/.config/askill/
└── config.json                  # User preferences
```

### Agent Integration

When you install a skill, askill writes to the canonical location and creates symlinks in each agent's skills directory. The agent then discovers and uses the skill according to its own conventions.

## Next Steps

- [Getting Started](./getting-started.md) - Install your first skill
- [SKILL.md Specification](./skill-spec.md) - Write your own skill
- [Publishing Guide](./publishing.md) - Share your skill with the world
