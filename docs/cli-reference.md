# CLI Reference

Complete reference for the askill command-line interface.

## Installation

```bash
# Install globally
npm install -g @askill/cli

# Or use without installing
npx @askill/cli <command>
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `askill install` | Install a skill |
| `askill remove` | Remove a skill |
| `askill list` | List installed skills |
| `askill search` | Search for skills |
| `askill info` | Show skill details |
| `askill run` | Run a skill command |
| `askill update` | Update skills |
| `askill login` | Authenticate with GitHub |
| `askill publish` | Publish a skill |
| `askill validate` | Validate a SKILL.md |

---

## askill install

Install a skill from the registry or GitHub.

### Usage

```bash
askill install <slug> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `slug` | Skill identifier (e.g., `@scope/name` or `gh:owner/repo/path`) |

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install globally (user-level) |
| `-a, --agent <agents...>` | Install to specific agents only |
| `-y, --yes` | Skip confirmation prompts |
| `--copy` | Copy files instead of symlink |

### Examples

```bash
# Install a published skill
askill install @anthropic/memory

# Install from GitHub
askill install gh:facebook/react/scripts/error-codes

# Install with specific version
askill install @anthropic/memory@^1.0.0

# Install globally
askill install @anthropic/memory -g

# Install to specific agents
askill install @anthropic/memory --agent claude-code cursor

# Non-interactive install
askill install @anthropic/memory -y
```

---

## askill remove

Remove an installed skill.

### Usage

```bash
askill remove <slug> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Remove from global installation |
| `-y, --yes` | Skip confirmation |

### Examples

```bash
# Remove a skill
askill remove @anthropic/memory

# Remove global skill
askill remove @anthropic/memory -g
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
| `--json` | Output as JSON |

### Examples

```bash
# List all installed skills
askill list

# List global skills
askill list -g

# Output as JSON
askill list --json
```

### Output

```
Installed skills:

  @anthropic/memory (v1.2.0)
    Agents: Claude Code, Cursor
    Location: ~/.askill/skills/@anthropic/memory

  gh:facebook/react/scripts/error-codes
    Agents: Claude Code
    Location: ~/.askill/skills/gh/facebook/react/scripts/error-codes
```

---

## askill search

Search for skills on askill.sh.

### Usage

```bash
askill search [query] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--tag <tag>` | Filter by tag |
| `--limit <n>` | Number of results (default: 20) |
| `--json` | Output as JSON |

### Examples

```bash
# Browse popular skills
askill search

# Search by keyword
askill search memory

# Filter by tag
askill search --tag git

# Combine filters
askill search code review --tag quality
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
askill info @anthropic/memory
```

### Output

```
@anthropic/memory

  Persistent memory management for AI agents

  Author:       anthropic
  Version:      1.2.0
  License:      MIT
  Stars:        1,234
  Downloads:    45,678
  Tags:         memory, context, persistence
  Repository:   https://github.com/anthropic/skills

  Dependencies:
    @askill/storage@^1.0.0

  Commands:
    save     - Save a key-value pair
    recall   - Recall a saved value
    forget   - Delete a saved value
    list     - List all saved keys

  Install:
    askill install @anthropic/memory
```

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

## askill update

Update installed skills.

### Usage

```bash
askill update [slug] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Update global skills |
| `--all` | Update all skills |

### Examples

```bash
# Update a specific skill
askill update @anthropic/memory

# Update all skills
askill update --all

# Update global skills
askill update --all -g
```

---

## askill login

Authenticate with GitHub for publishing.

### Usage

```bash
askill login
```

### Process

1. Opens your browser to GitHub OAuth
2. Authorizes askill to read your identity
3. Stores credentials locally

### Examples

```bash
askill login
```

---

## askill logout

Remove stored credentials.

### Usage

```bash
askill logout
```

---

## askill publish

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

## askill token

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
| `--verbose` | Verbose output |
| `--no-color` | Disable colored output |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ASKILL_TOKEN` | Authentication token (for CI) |
| `ASKILL_HOME` | Override askill home directory |
| `ASKILL_REGISTRY` | Override registry URL |
| `NO_COLOR` | Disable colored output |

---

## Configuration File

askill stores configuration in `~/.askill/config.json`:

```json
{
  "registry": "https://askill.sh/api/v1",
  "defaultAgents": ["claude-code", "cursor"],
  "globalInstall": false
}
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Skill not found |
| 4 | Authentication required |
| 5 | Network error |

---

## Next Steps

- [Getting Started](./getting-started.md) - Quick start guide
- [Publishing Guide](./publishing.md) - Publish your skill
- [SKILL.md Specification](./skill-spec.md) - File format reference
