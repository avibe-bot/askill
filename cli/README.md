# SPM - Skill Package Manager

The official CLI for [askill.sh](https://askill.sh) - Install AI agent skills in seconds.

## Quick Start

```bash
# Using npx (no installation required)
npx spm install extract-errors

# Or install globally
npm install -g spm
spm install extract-errors
```

## Features

- **One Command Install** - `spm install <skill>` fetches and installs skills from askill.sh
- **Multi-Agent Support** - Works with Claude Code, Cursor, Windsurf, OpenCode, Codex, and 30+ more agents
- **Global or Project** - Install skills globally (user-level) or per-project
- **Auto Updates** - CLI automatically checks for updates
- **Binary Distribution** - Available as standalone binary (no Node.js required)

## Commands

### Install a skill

```bash
spm install <skill-name>
spm install extract-errors

# Install globally
spm install extract-errors -g

# Install to specific agents
spm install extract-errors --agent claude-code cursor

# Skip prompts
spm install extract-errors -y
```

### Search for skills

```bash
spm search react
spm search "code review"
```

### List installed skills

```bash
spm list
spm list -g  # Global only
```

### Remove a skill

```bash
spm remove extract-errors
spm remove extract-errors -g
```

### Show skill info

```bash
spm info playwright-cli
```

### Update CLI

```bash
spm update
```

## Supported Agents

SPM automatically detects and installs to these agents:

| Agent | Project Path | Global Path |
|-------|--------------|-------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Codex | `.codex/skills/` | `~/.codex/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| Goose | `.goose/skills/` | `~/.config/goose/skills/` |
| And 30+ more... | | |

## Installation Options

### npx (Recommended)

No installation required. Always uses the latest version.

```bash
npx spm install extract-errors
```

### npm Global Install

```bash
npm install -g spm
spm install extract-errors
```

### Binary Download

Download standalone binaries from [Releases](https://github.com/askill/spm/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/askill/spm/releases/latest/download/spm-darwin-arm64 -o spm
chmod +x spm
./spm install extract-errors

# macOS (Intel)
curl -L https://github.com/askill/spm/releases/latest/download/spm-darwin-x64 -o spm

# Linux
curl -L https://github.com/askill/spm/releases/latest/download/spm-linux-x64 -o spm

# Windows
curl -L https://github.com/askill/spm/releases/latest/download/spm-win32-x64.exe -o spm.exe
```

## How It Works

1. **Fetch** - SPM fetches skill metadata from askill.sh API
2. **Download** - Downloads the SKILL.md content
3. **Install** - Creates the skill directory in your agent's skills folder
4. **Symlink** - By default, creates symlinks from a canonical location for easy updates

### Installation Structure

```
~/.agents/skills/           # Canonical location (single source of truth)
└── extract-errors/
    └── SKILL.md

~/.claude/skills/           # Claude Code (symlink)
└── extract-errors -> ~/.agents/skills/extract-errors

~/.cursor/skills/           # Cursor (symlink)
└── extract-errors -> ~/.agents/skills/extract-errors
```

## Configuration

SPM respects XDG base directory specification for global installations.

Environment variables:
- `XDG_CONFIG_HOME` - Config directory (default: `~/.config`)
- `CLAUDE_CONFIG_DIR` - Claude Code config directory
- `CODEX_HOME` - Codex config directory

## License

MIT
