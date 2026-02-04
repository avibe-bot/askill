# Getting Started with askill

Get up and running with askill in 5 minutes.

## Installation

### Using npm (recommended)

```bash
npm install -g @askill/cli
```

### Using npx (no install)

```bash
npx @askill/cli add @anthropic/memory
```

### Verify Installation

```bash
askill --version
```

## Your First Skill

### 1. Search for Skills

```bash
# Browse popular skills
askill find

# Search by keyword
askill find memory

# Search by tag
askill find --tag git
```

### 2. View Skill Details

```bash
askill info @anthropic/memory
```

Output:
```
@anthropic/memory

  Persistent memory management for AI agents

  Author:      anthropic
  Version:     1.2.0
  Stars:       1,234
  Tags:        memory, context, persistence

  Install:     askill add @anthropic/memory
```

### 3. Install a Skill

```bash
askill add @anthropic/memory
```

The CLI will:
1. Download the skill
2. Detect installed agents (Claude Code, Cursor, etc.)
3. Ask which agents to configure
4. Install and configure automatically

```
◆ askill add

  Installing @anthropic/memory...

  Found 2 agent(s):
  ✓ Claude Code
  ✓ Cursor

  ? Install to which agents?
  › [x] Claude Code
    [x] Cursor

  ✓ Installed to 2 agent(s)

  Done!
```

### 4. Use the Skill

Now your agent knows about the skill! Just ask:

> "Use the memory skill to remember that I prefer TypeScript"

The agent will read the skill's instructions and act accordingly.

## Installing from GitHub

You can also install skills directly from GitHub repositories:

```bash
# Install from a specific path in a repo
askill add gh:facebook/react/scripts/error-codes

# The gh: prefix indicates an indexed (non-published) skill
```

### Running Skill Commands (Planned)

Some skills provide commands. When implemented, run them with:

```bash
askill run <skill>:<command> [args]

# Examples
askill run @anthropic/memory:save --key preferences --value "likes TypeScript"
askill run @anthropic/memory:recall --key preferences
```

## Managing Skills

### List Installed Skills

```bash
askill list

# Output:
# Installed skills:
#   @anthropic/memory (v1.2.0) - Claude Code, Cursor
#   gh:facebook/react/scripts/error-codes - Claude Code
```

### Update Skills (Planned)

```bash
# Update a specific skill
askill update @anthropic/memory

# Update all skills
askill update
```

### Remove a Skill

```bash
askill remove @anthropic/memory
```

## Configuration

### Global vs Project Skills

```bash
# Install globally (available everywhere)
askill add -g @anthropic/memory

# Install for current project only (default)
askill add @anthropic/memory
```

### Specify Agents

```bash
# Install only for specific agents
askill add @anthropic/memory --agent claude-code cursor
```

## Next Steps

- [SKILL.md Specification](./skill-spec.md) - Create your own skill
- [Publishing Guide](./publishing.md) - Share your skill
- [CLI Reference](./cli-reference.md) - All available commands
