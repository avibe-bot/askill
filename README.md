# askill

> The package manager for AI agent skills.

[![npm version](https://img.shields.io/npm/v/@askill/cli.svg)](https://www.npmjs.com/package/@askill/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

askill is a universal package manager for AI agent skills. It enables agents to discover, install, and use skills across Claude Code, Cursor, Windsurf, and 40+ other AI coding assistants.

## Quick Start

```bash
# Install
npm install -g @askill/cli

# Install a skill from GitHub
askill add gh:owner/repo@skill-name

# Search for skills
askill find code review

# List installed skills
askill list
```

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Skills](#skills)
- [For Developers](#for-developers)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Installation

### npm (recommended)

```bash
npm install -g @askill/cli
```

### npx (no install)

```bash
npx @askill/cli add @anthropic/memory
```

### Verify

```bash
askill --version
```

## Usage

### Install a Skill

```bash
# From GitHub (short format)
askill add gh:facebook/react@extract-errors

# From GitHub (path format)
askill add gh:facebook/react/scripts/error-codes

# Non-interactive (for CI/agents)
askill add gh:owner/repo@skill -y
```

### Search Skills

```bash
askill find memory
askill find --tag git
```

### List Installed Skills

```bash
askill list
askill list -g  # global only
```

### Run Skill Commands (Planned)

Skills can define commands. When implemented, run them with:

```bash
askill run <skill>:<command> [args]

# Example
askill run @anthropic/memory:save --key preferences --value "dark mode"
askill run @anthropic/memory:recall --key preferences
```

### Remove a Skill

```bash
askill remove @anthropic/memory
```

## Documentation

Complete documentation is available in the [`docs/`](./docs/) directory:

| Document | Description |
|----------|-------------|
| [Introduction](./docs/introduction.md) | What is askill and why it exists |
| [Getting Started](./docs/getting-started.md) | Quick start guide with examples |
| [SKILL.md Specification](./docs/skill-spec.md) | Complete protocol for writing skills |
| [Slug System](./docs/slug-system.md) | How skill identification works (`@scope/name` vs `gh:`) |
| [Publishing Guide](./docs/publishing.md) | How to publish your own skills |
| [CLI Reference](./docs/cli-reference.md) | Complete command documentation |
| [API Specification](./docs/api-spec.md) | REST API for askill.sh |

### For AI Agents

If you're an AI agent trying to understand askill:

1. **To use installed skills**: Read [`skills/@askill/agent/SKILL.md`](./skills/@askill/agent/SKILL.md)
2. **To develop skills**: Read [`skills/@askill/developer/SKILL.md`](./skills/@askill/developer/SKILL.md)
3. **To understand the protocol**: Read [`docs/skill-spec.md`](./docs/skill-spec.md)

## Skills

### Slug System

Skills are identified by slugs:

| Type | Format | Example |
|------|--------|---------|
| Published | `@scope/name` | `@anthropic/memory` |
| Indexed | `gh:owner/repo/path` | `gh:facebook/react/scripts/errors` |

Published skills are hosted on [askill.sh](https://askill.sh). Indexed skills are automatically discovered from GitHub.

### Official Skills

| Skill | Description | Path |
|-------|-------------|------|
| `@askill/agent` | Teaches agents how to use installed skills | [`skills/@askill/agent/`](./skills/@askill/agent/SKILL.md) |
| `@askill/developer` | Teaches agents how to develop skills | [`skills/@askill/developer/`](./skills/@askill/developer/SKILL.md) |

### SKILL.md Format

Skills are defined by a `SKILL.md` file:

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
dependencies:
  - @dependency/one@^1.0.0
commands:
  build:
    run: npm run build
    description: Build the project
---

# My Skill

Instructions for the agent...
```

See [SKILL.md Specification](./docs/skill-spec.md) for complete details.

## For Developers

### Creating a Skill

1. Create a `SKILL.md` file with frontmatter and instructions
2. Test locally: `askill add ./my-skill`
3. Validate: `askill validate SKILL.md` (Planned)
4. Publish: `askill login && askill publish` (Planned)

See [Publishing Guide](./docs/publishing.md) for details.

### Building the CLI

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.mjs --help
```

## Project Structure

```
askill/
├── src/                    # CLI source code
│   ├── cli.ts              # Main entry point
│   ├── api.ts              # API client
│   ├── installer.ts        # Skill installation
│   ├── config.ts           # User preferences
│   ├── updater.ts          # Self-update
│   └── constants.ts        # Config and agent definitions
├── docs/                   # Documentation
│   ├── introduction.md     # Overview
│   ├── getting-started.md  # Quick start
│   ├── skill-spec.md       # SKILL.md protocol
│   ├── slug-system.md      # Slug identification
│   ├── publishing.md       # Publishing guide
│   ├── cli-reference.md    # CLI commands
│   └── api-spec.md         # REST API spec
├── skills/                 # Official skills
│   └── @askill/
│       ├── agent/          # For using skills
│       └── developer/      # For creating skills
├── package.json
├── tsconfig.json
└── README.md
```

## Related Projects

| Project | Description | Repository |
|---------|-------------|------------|
| askill (this repo) | CLI and documentation | [avibe-bot/askill](https://github.com/avibe-bot/askill) |
| askill-registry | Web platform and API | [avibe-bot/askill-registry](https://github.com/avibe-bot/askill-registry) |

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

### Development Setup

```bash
git clone https://github.com/avibe-bot/askill.git
cd askill
npm install
npm run build
```

### Running Tests

```bash
npm test
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Website**: [askill.sh](https://askill.sh) | **npm**: [@askill/cli](https://www.npmjs.com/package/@askill/cli)
