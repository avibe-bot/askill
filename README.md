# askill - Agent Skill Package Manager

> The package manager designed for AI agents.

## Overview

askill is a universal skill package manager for AI agents. Just as npm manages packages for Node.js, askill manages skills for AI agents like Claude Code, Cursor, Windsurf, and 40+ others.

## Quick Start

```bash
# Install the CLI
npm install -g @askill/cli

# Install a skill
askill install @anthropic/memory

# Use it - just ask your agent:
# "Use the memory skill to remember my preferences"
```

## Documentation

See the [docs/](./docs/) directory for complete documentation:

- [Introduction](./docs/introduction.md) - What is askill and why it exists
- [Getting Started](./docs/getting-started.md) - Quick start guide
- [SKILL.md Specification](./docs/skill-spec.md) - Complete protocol specification
- [Slug System](./docs/slug-system.md) - How skill identification works
- [Publishing Guide](./docs/publishing.md) - How to publish skills
- [CLI Reference](./docs/cli-reference.md) - Complete CLI documentation

## Design Philosophy

### 1. Agent-Native

Traditional package managers are designed for humans. askill is designed for agents:

- **Natural language instructions** in SKILL.md
- **Unified command interface** (`askill run skill:command`)
- **Smart dependency resolution** between skills

### 2. Progressive Disclosure

Simple skills are simple:

```markdown
---
name: my-skill
description: Does something useful
---

Instructions for the agent...
```

Advanced features available when needed:

```yaml
---
name: advanced-skill
version: 2.1.0
skills:
  - @dep/one@^1.0.0
commands:
  build:
    run: npm run build
---
```

### 3. Open Ecosystem

- **Published skills**: `@scope/name` - Authors publish to askill.sh
- **Indexed skills**: `gh:owner/repo/path` - Auto-discovered from GitHub

## Slug System

| Type | Format | Example |
|------|--------|---------|
| Published | `@scope/name` | `@anthropic/memory` |
| Indexed | `gh:owner/repo/path` | `gh:facebook/react/scripts/errors` |

## Official Skills

| Skill | Description |
|-------|-------------|
| [@askill/agent](./skills/@askill/agent/SKILL.md) | Teaches agents how to use installed skills |
| [@askill/developer](./skills/@askill/developer/SKILL.md) | Teaches agents how to develop skills |

## Project Structure

```
askill/
├── docs/                    # Documentation
│   ├── introduction.md
│   ├── getting-started.md
│   ├── skill-spec.md
│   ├── slug-system.md
│   ├── publishing.md
│   └── cli-reference.md
├── skills/                  # Official skills
│   └── @askill/
│       ├── agent/
│       └── developer/
├── cli/                     # CLI source (askill command)
└── dashboard/               # Web dashboard (askill.sh)
```

## Links

- Website: https://askill.sh
- Documentation: https://askill.sh/docs
- npm: `@askill/cli`

## License

MIT
