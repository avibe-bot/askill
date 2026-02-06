# CLI Reference

Complete reference for the askill command-line interface.

## Installation

```bash
# One-line install (recommended)
curl -fsSL https://askill.sh | sh

# Or install via npm
npm install -g askill-cli

# Or use without installing
npx askill-cli <command>
```

## Commands Overview

| Command | Status | Description |
|---------|--------|-------------|
| `askill add` | Implemented | Install a skill |
| `askill remove` | Implemented | Remove a skill |
| `askill list` | Implemented | List installed skills |
| `askill find` | Implemented | Search for skills |
| `askill info` | Implemented | Show skill details |
| `askill update` | Implemented | Update installed skills |
| `askill check` | Implemented | Check installed skills for available updates |
| `askill upgrade` | Implemented | Update askill CLI to latest version |
| `askill run` | Implemented | Run a skill command |
| `askill login` | Planned | Authenticate with GitHub |
| `askill logout` | Planned | Remove stored credentials |
| `askill publish` | Planned | Publish a skill |
| `askill validate` | Implemented | Validate a SKILL.md |
| `askill token` | Planned | Manage authentication tokens |

---

## askill add

Install a skill from the registry or GitHub.

### Usage

```bash
askill add <slug> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `slug` | Skill identifier (e.g., `gh:owner/repo@name` or `gh:owner/repo/path`) |

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install globally (user-level, e.g., `~/.claude/skills/`) |
| `-a, --agent <agents...>` | Install to specific agents only |
| `-y, --yes` | Skip confirmation prompts (non-interactive mode) |
| `--copy` | Copy files instead of symlink |

### Examples

```bash
# Install from GitHub (short format)
askill add gh:facebook/react@extract-errors

# Install from GitHub (path format)
askill add gh:facebook/react/scripts/error-codes

# List skills in a repo and select
askill add gh:facebook/react

# Install globally
askill add gh:owner/repo@skill -g

# Install to specific agents
askill add gh:owner/repo@skill --agent claude-code cursor

# Non-interactive install (for CI/agents)
askill add gh:owner/repo@skill -y

# Non-interactive with specific agents
askill add gh:owner/repo@skill -a claude-code opencode -y
```

### Non-Interactive Mode

When using `-y` / `--yes`:
- Skips all confirmation prompts
- Uses preferred agents from config (if previously saved)
- Falls back to all detected agents if no preferences saved
- Combined with `-a` to specify exact agents

This is ideal for CI pipelines or when agents install skills programmatically.

---

## askill remove

Remove an installed skill.

### Usage

```bash
askill remove <name> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Remove from global installation |
| `-y, --yes` | Skip confirmation (Planned) |

### Examples

```bash
# Remove a skill (project-level)
askill remove extract-errors

# Remove global skill
askill remove extract-errors -g
```

---

## askill list

List installed skills.

### Usage

```bash
askill list [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | List global skills only |
| `--json` | Output as JSON (Planned) |

### Examples

```bash
# List all installed skills
askill list

# List global skills
askill list -g
```

### Output

```
Installed skills:

  extract-errors [project]
    Agents: Claude Code, OpenCode
    .agents/skills/extract-errors

  git-workflow [global]
    Agents: Claude Code
    ~/.agents/skills/git-workflow
```

---

## askill find

Search for skills on askill.sh.

### Usage

```bash
askill find [query] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--tag <tag>` | Filter by tag (Planned) |
| `--limit <n>` | Number of results (default: 20) (Planned) |
| `--json` | Output as JSON (Planned) |

### Examples

```bash
# Browse popular skills
askill find

# Search by keyword
askill find memory

# Search by multiple keywords
askill find code review

# Filter by tag (Planned)
askill find --tag git
```

---

## askill info

Display detailed information about a skill.

### Usage

```bash
askill info <slug>
```

### Examples

```bash
askill info gh:facebook/react@extract-errors
```

### Output

```
extract-errors

  Extract error codes from React codebase

  Owner:      facebook
  Repository: facebook/react
  Path:       scripts/error-codes
  Stars:      230,000

  Install:    askill add gh:facebook/react@extract-errors
```

---

## askill update

Update installed skills to their latest versions.

### Usage

```bash
askill update [skill] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `skill` | Optional skill name to update (updates all if omitted) |

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Update global skills |

### Examples

```bash
# Update all installed skills
askill update

# Update a specific skill
askill update extract-errors

# Update global skills
askill update -g
```

---

## askill check

Check installed skills for available updates.

### Usage

```bash
askill check [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Check global skills |

### Examples

```bash
# Check all installed skills
askill check

# Check global skills
askill check -g
```

---

## askill upgrade

Update the askill CLI itself to the latest version.

### Usage

```bash
askill upgrade
```

### How It Works

1. Checks for the latest version from askill.sh
2. Downloads the appropriate binary for your platform
3. Replaces the current binary in place

If installed via npm, it will prompt you to use `npm install -g askill-cli@latest` instead.

---

## askill run

Execute a command defined by a skill.

### Usage

```bash
askill run <skill>:<command> [args...]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `skill` | Skill slug |
| `command` | Command name (defined in SKILL.md) |
| `args` | Arguments passed to the command |

### Examples

```bash
# Run a command
askill run @anthropic/memory:save --key name --value "John"

# Run with positional args
askill run @myskill/tool:process file.txt

# Run setup command
askill run @anthropic/memory:_setup
```

### How It Works

1. Locates the skill's installation directory
2. Reads the command definition from SKILL.md
3. Executes the command in the skill's directory
4. Passes all arguments through

---

## askill login (Planned)

Authenticate with GitHub for publishing.

### Usage

```bash
askill login
```

### Process

1. Opens your browser to GitHub OAuth
2. Authorizes askill to read your identity
3. Stores credentials locally

---

## askill logout (Planned)

Remove stored credentials.

### Usage

```bash
askill logout
```

---

## askill publish (Planned)

Publish a skill to askill.sh.

### Usage

```bash
askill publish [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Publish under a specific scope |
| `--tag <tag>` | Publish with a dist-tag (e.g., beta) |
| `--dry-run` | Show what would be published |

### Examples

```bash
# Publish from current directory
askill publish

# Publish under organization scope
askill publish --scope mycompany

# Publish beta version
askill publish --tag beta

# Preview without publishing
askill publish --dry-run
```

---

## askill validate

Validate a SKILL.md file.

### Usage

```bash
askill validate [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | Path to SKILL.md (default: ./SKILL.md) |

### Examples

```bash
# Validate current directory
askill validate

# Validate specific file
askill validate ./my-skill/SKILL.md
```

### Output

```
◆ askill validate

  Checking SKILL.md...

  ✓ Frontmatter is valid YAML
  ✓ Required field: name
  ✓ Required field: description
  ✓ Version format: 1.0.0
  ✓ Dependencies resolvable
  ✓ Commands valid

  Ready to publish!
```

---

## askill token (Planned)

Manage authentication tokens.

### Usage

```bash
askill token <subcommand>
```

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new token |
| `list` | List active tokens |
| `revoke` | Revoke a token |

### Examples

```bash
# Create a token for CI
askill token create --name "GitHub Actions"

# List tokens
askill token list

# Revoke a token
askill token revoke <token-id>
```

---

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `-v, --version` | Show version |
| `--verbose` | Verbose output (Planned) |
| `--no-color` | Disable colored output (Planned) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `XDG_CONFIG_HOME` | Override config home (default: `~/.config`) |
| `CODEX_HOME` | Override Codex home (default: `~/.codex`) |
| `CLAUDE_CONFIG_DIR` | Override Claude config (default: `~/.claude`) |
| `ASKILL_TOKEN` | Authentication token for CI (Planned) |
| `ASKILL_REGISTRY` | Override registry URL (Planned) |
| `NO_COLOR` | Disable colored output (Planned) |

---

## Configuration File

askill stores user preferences in `~/.config/askill/config.json`:

```json
{
  "preferredAgents": ["claude-code", "opencode"],
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

The `preferredAgents` list is automatically updated when you complete an installation, remembering your agent selections for next time.

---

## Skills Installation Paths

Skills are installed to agent-specific directories:

### Project-Level (default)

| Agent | Path |
|-------|------|
| Claude Code | `.claude/skills/<skill-name>/` |
| OpenCode | `.opencode/skills/<skill-name>/` |
| Cursor | `.cursor/skills/<skill-name>/` |
| Windsurf | `.windsurf/skills/<skill-name>/` |
| Codex | `.codex/skills/<skill-name>/` |
| Canonical | `.agents/skills/<skill-name>/` |

### Global (`-g` flag)

| Agent | Path |
|-------|------|
| Claude Code | `~/.claude/skills/<skill-name>/` |
| OpenCode | `~/.config/opencode/skills/<skill-name>/` |
| Cursor | `~/.cursor/skills/<skill-name>/` |
| Windsurf | `~/.codeium/windsurf/skills/<skill-name>/` |
| Codex | `~/.codex/skills/<skill-name>/` |
| Canonical | `~/.agents/skills/<skill-name>/` |

By default, skills are written to the canonical location (`.agents/skills/`) and symlinked to each agent's directory for deduplication.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments (Planned) |
| 3 | Skill not found (Planned) |
| 4 | Authentication required (Planned) |
| 5 | Network error (Planned) |

---

## Next Steps

- [Getting Started](./getting-started.md) - Quick start guide
- [Publishing Guide](./publishing.md) - Publish your skill
- [SKILL.md Specification](./skill-spec.md) - File format reference
