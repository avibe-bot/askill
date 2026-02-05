# askill Documentation

Complete documentation for askill - the Agent Skill Package Manager.

## Overview

askill is a package manager designed for AI agents. It provides a universal way to discover, install, and use skills across different AI coding assistants.

## Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Introduction](./introduction.md) | What is askill, why it exists, and core concepts |
| [Getting Started](./getting-started.md) | Installation and first steps |

### Core Concepts

| Document | Description |
|----------|-------------|
| [SKILL.md Specification](./skill-spec.md) | Complete protocol for writing skills |
| [Slug System](./slug-system.md) | How skill identification works |

### Guides

| Document | Description |
|----------|-------------|
| [Publishing Guide](./publishing.md) | How to publish skills to askill.sh |
| [CLI Reference](./cli-reference.md) | Complete command documentation |

### Technical Reference

| Document | Description |
|----------|-------------|
| [API Specification](./api-spec.md) | REST API for askill.sh |

## Quick Navigation

### For Users

1. Start with [Getting Started](./getting-started.md)
2. Learn about [Slug System](./slug-system.md) to understand how to reference skills
3. Use [CLI Reference](./cli-reference.md) for command help

### For Skill Developers

1. Read [Introduction](./introduction.md) for concepts
2. Study [SKILL.md Specification](./skill-spec.md) for the protocol
3. Follow [Publishing Guide](./publishing.md) to share your skill

### For AI Agents

1. Read [Introduction](./introduction.md) for understanding askill
2. Study [SKILL.md Specification](./skill-spec.md) for the skill format
3. Check official skills:
   - [`@askill/agent`](../skills/@askill/agent/SKILL.md) - How to use installed skills
   - [`@askill/developer`](../skills/@askill/developer/SKILL.md) - How to develop skills

## Key Concepts

### Skills

Skills are packages that extend an AI agent's capabilities. Each skill contains:

- **SKILL.md** - Instructions and metadata
- **scripts/** - Optional executable commands
- **assets/** - Optional additional resources

### Slugs

Skills are identified by slugs:

```
@scope/name           # Published skill (e.g., @anthropic/memory)
gh:owner/repo/path    # Indexed from GitHub (e.g., gh:facebook/react/scripts/errors)
```

### Commands

Skills can define executable commands:

```bash
askill run @skill/name:command --arg value
```

## Links

- **Repository**: [github.com/avibe-bot/askill](https://github.com/avibe-bot/askill)
- **Website**: [askill.sh](https://askill.sh)
- **npm**: [askill-cli](https://www.npmjs.com/package/askill-cli)
