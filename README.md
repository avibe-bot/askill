# askill

> The package manager for AI agent skills.

[![npm version](https://img.shields.io/npm/v/askill-cli.svg)](https://www.npmjs.com/package/askill-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<details>
<summary><strong>🤖 For AI Agents (click to expand)</strong></summary>

You are an AI agent helping a user with askill - a package manager for AI agent skills.

**Quick Commands:**
```bash
# Install a published skill (@author/skill-name)
askill add @johndoe/awesome-tool -y

# Install a skill
askill add owner/repo@skill-name -y

# Install all skills from a repo
askill add owner/repo --all -y

# List installed skills
askill list

# Search for skills
askill find <query>

# Submit a GitHub skill URL for indexing
askill submit https://github.com/owner/repo

# Login and publish your own skill
askill login --token ask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
askill publish

# Run a skill command
askill run skill-name:command
```

**Key Behaviors:**
- Use `-y` flag to skip confirmation prompts
- Use `-a <agent>` to specify target agent (claude-code, cursor, opencode, etc.)
- Skills are installed to `.agents/skills/` and symlinked to agent directories
- Check `~/.agents/.skill-lock.json` for installed skill metadata

**For Skill Development:**
- Read [`docs/skill-spec.md`](./docs/skill-spec.md) for SKILL.md format
- Use `askill init` to create a new skill template
- Use `askill validate` to check SKILL.md syntax

**Installed Skills:**
After installation, read the skill's `SKILL.md` file for usage instructions. Skills are located at:
- Project: `.agents/skills/<skill-name>/SKILL.md`
- Global: `~/.agents/skills/<skill-name>/SKILL.md`

</details>

---

askill is a universal package manager for AI agent skills. It enables agents to discover, install, and use skills across Claude Code, Codex, OpenCode, OpenClaw, Cursor, and 40+ other AI coding assistants.

Every skill on [askill.sh](https://askill.sh) is automatically reviewed by AI across 5 strict dimensions - Safety, Clarity, Reusability, Completeness, and Actionability - so risky or malicious skills are filtered out, and truly excellent skills rise to the top of the rankings.

## Quick Start

```bash
# Install
curl -fsSL https://askill.sh | sh

# Install a published skill
askill add @johndoe/awesome-tool

# Install a skill
askill add owner/repo@skill-name

# Search for skills
askill find code review

# List installed skills
askill list
```

## Installation

### One-line install (recommended)

```bash
curl -fsSL https://askill.sh | sh
```

### npm

```bash
npm install -g askill-cli
```

### npx (no install)

```bash
npx askill-cli add owner/repo@skill-name
```

### Verify

```bash
askill --version
```

## Usage

### Install a Skill

```bash
# From GitHub
askill add facebook/react@extract-errors

# Browse and select from a repo
askill add anthropics/courses

# Install all skills from a repo
askill add owner/repo --all

# Non-interactive (for CI/agents)
askill add owner/repo@skill -y
```

### Search & Discover

```bash
askill find memory
askill find code review
```

### Manage Skills

```bash
# List installed
askill list
askill list -g  # global only

# Check for updates
askill check

# Update skills
askill update

# Remove
askill remove skill-name

# Update CLI itself
askill upgrade
```

### Run Skill Commands

Skills can define executable commands:

```bash
askill run skill-name:command [args]

# Example
askill run memory:save --key name --value "John"
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Quick start guide |
| [CLI Reference](./docs/cli-reference.md) | Complete command documentation |
| [SKILL.md Specification](./docs/skill-spec.md) | How to write skills |
| [Publishing Guide](./docs/publishing.md) | Publish your own skills |

## Creating Skills

1. Create a `SKILL.md` file:

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
---

# My Skill

Instructions for the agent...
```

2. Test locally: `askill add ./my-skill`
3. Validate: `askill validate`
4. Submit for indexing: `askill submit https://github.com/<owner>/<repo>`
5. Publish under your author scope: `askill login` then `askill publish`

See [Publishing Guide](./docs/publishing.md) for details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Website**: [askill.sh](https://askill.sh) | **npm**: [askill-cli](https://www.npmjs.com/package/askill-cli) | **GitHub**: [avibe-bot/askill](https://github.com/avibe-bot/askill)
