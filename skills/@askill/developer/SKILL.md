---
name: developer
description: Learn how to create, test, and publish skills for the askill ecosystem
version: 1.0.0
author:
  name: askill
  github: askill
tags:
  - meta
  - development
  - official
---

# Skill Developer Guide

This skill teaches you how to create skills for the askill ecosystem.

## What is a Skill?

A skill is a package that extends an AI agent's capabilities. It consists of:

1. **SKILL.md** - Instructions and metadata (required)
2. **scripts/** - Executable commands (optional)
3. **assets/** - Additional resources (optional)

## Quick Start

### 1. Create Directory Structure

```
my-skill/
├── SKILL.md
└── scripts/
    └── main.py
```

### 2. Write SKILL.md

```markdown
---
name: my-skill
description: A brief description of what this skill does
version: 1.0.0
---

# My Skill

Instructions for the agent on how to use this skill...
```

### 3. Validate

```bash
askill validate SKILL.md
```

### 4. Test Locally

```bash
askill add ./my-skill --agent claude-code
```

### 5. Publish

```bash
askill login
askill publish
```

## SKILL.md Structure

### Frontmatter (YAML)

The frontmatter contains structured metadata:

```yaml
---
# Required
name: my-skill
description: What this skill does (max 200 chars)

# Optional
version: 1.0.0
author: your-github-username
tags:
  - tag1
  - tag2

skills:
  - @dependency/one@^1.0.0
  - @dependency/two@^2.0.0

commands:
  build:
    run: npm run build
    description: Build the project
  _setup:
    run: npm install
    description: Install dependencies

repository:
  type: git
  url: https://github.com/you/repo
license: MIT
---
```

### Markdown Body

The body contains instructions for the agent:

```markdown
# My Skill

## Overview
Brief description of what this skill does and when to use it.

## Prerequisites
- Tool 1 (`brew install tool1`)
- Tool 2 (usually pre-installed)

## Usage
Explain how to use this skill...

## Commands
Document each command...

## Examples
Provide concrete examples...

## Troubleshooting
Common issues and solutions...
```

## Field Reference

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Skill identifier | `code-reviewer` |
| `description` | Brief description | `Review code for bugs` |

### Optional Fields

| Field | Description | Example |
|-------|-------------|---------|
| `version` | Semver version | `1.2.0` |
| `author` | GitHub username | `anthropic` |
| `tags` | Discovery tags | `[git, automation]` |
| `skills` | Dependencies | `[@askill/git@^1.0.0]` |
| `commands` | Runnable commands | See below |
| `repository` | Source repo | `{url: "..."}` |
| `license` | SPDX identifier | `MIT` |

### Commands Format

```yaml
commands:
  command-name:
    run: shell command to execute
    description: What this command does
```

Special commands:
- `_setup` - Runs on first use to install dependencies
- Commands starting with `_` are internal/hidden

## Writing Good Instructions

### For Agents, Not Humans

Write as if explaining to a capable assistant:

❌ Bad:
```markdown
Run the script to do the thing.
```

✅ Good:
```markdown
To analyze the codebase:

1. First, ensure all dependencies are installed by running `askill run my-skill:_setup`
2. Run `askill run my-skill:analyze --path ./src`
3. The output will be a JSON report in `./analysis-report.json`

If the command fails with "module not found", the setup step was likely skipped.
```

### Be Specific About Prerequisites

❌ Bad:
```markdown
Requires Python.
```

✅ Good:
```markdown
## Prerequisites

- Python 3.10 or higher
  - Check with: `python3 --version`
  - Install: https://python.org or `brew install python@3.10`
- pip (usually included with Python)
  - Check with: `pip3 --version`
```

### Include Error Handling

```markdown
## Troubleshooting

### "ModuleNotFoundError: No module named 'requests'"

Run the setup command:
```bash
askill run my-skill:_setup
```

### "Permission denied"

Make the script executable:
```bash
chmod +x ~/.askill/skills/@scope/my-skill/scripts/main.py
```
```

## Adding Commands

### Simple Command

```yaml
commands:
  greet:
    run: echo "Hello, World!"
    description: Print a greeting
```

### Python Script

```yaml
commands:
  analyze:
    run: python scripts/analyze.py
    description: Analyze the codebase
```

Create `scripts/analyze.py`:
```python
#!/usr/bin/env python3
import sys
import json

def main():
    # Your logic here
    result = {"status": "success"}
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
```

### Node.js Script

```yaml
commands:
  process:
    run: node scripts/process.js
    description: Process input files
```

### With Setup

```yaml
commands:
  _setup:
    run: pip install -r requirements.txt
    description: Install Python dependencies
  
  analyze:
    run: python scripts/analyze.py
    description: Run analysis (runs _setup first if needed)
```

## Dependencies

### Depending on Other Skills

```yaml
skills:
  - @askill/git@^1.0.0      # Git operations
  - @askill/fs@^1.0.0        # File system utilities
```

Version syntax:
- `@scope/name@^1.0.0` - Any 1.x.x (recommended)
- `@scope/name@~1.0.0` - Any 1.0.x
- `@scope/name@1.0.0` - Exact version
- `@scope/name` - Latest version

### Referencing Dependencies

In your instructions:

```markdown
This skill uses @askill/git for repository operations. 
When you need to get the current branch, refer to the 
@askill/git skill's instructions.
```

## Testing

### Local Testing

```bash
# Install locally
askill add ./my-skill

# Test commands
askill run my-skill:command-name

# Check it appears
askill list
```

### Validation

```bash
askill validate SKILL.md
```

This checks:
- YAML syntax
- Required fields
- Version format
- Dependency resolution
- Command definitions

## Publishing

### First Time Setup

```bash
# Login with GitHub
askill login

# This links your GitHub username as your scope (@yourusername)
```

### Publish

```bash
cd my-skill/
askill publish
```

Your skill will be available at:
- Install: `askill add @yourusername/my-skill`
- Web: `https://askill.sh/@yourusername/my-skill`

### Updates

1. Update `version` in SKILL.md
2. Run `askill publish`

```yaml
version: 1.1.0  # Bumped from 1.0.0
```

### Organization Scope

If you're part of a GitHub organization:

```bash
askill publish --scope mycompany
```

## Best Practices

### 1. Start with 0.x.x

Use `0.1.0` while developing. Bump to `1.0.0` when stable.

### 2. Semantic Versioning

- Patch (1.0.0 → 1.0.1): Bug fixes
- Minor (1.0.0 → 1.1.0): New features, backward compatible
- Major (1.0.0 → 2.0.0): Breaking changes

### 3. Meaningful Names

✅ Good: `code-reviewer`, `git-workflow`, `test-runner`
❌ Bad: `my-tool`, `helper`, `utils`

### 4. Comprehensive Tags

```yaml
tags:
  - code-review
  - quality
  - linting
```

### 5. Document Everything

- What the skill does
- When to use it
- Prerequisites
- Each command
- Error handling

### 6. Handle Paths Correctly

Never hardcode paths like `~/.claude/skills/`. Use relative paths or let the user/agent determine the location.

❌ Bad:
```markdown
Run: python ~/.claude/skills/my-skill/scripts/main.py
```

✅ Good:
```markdown
Run: askill run my-skill:main
```

## Example: Complete Skill

```markdown
---
name: code-stats
description: Generate statistics about your codebase
version: 1.0.0
author: developer
tags:
  - code
  - statistics
  - analysis
commands:
  analyze:
    run: python scripts/analyze.py
    description: Analyze codebase and generate stats
  _setup:
    run: pip install -r requirements.txt
    description: Install Python dependencies
repository:
  type: git
  url: https://github.com/developer/code-stats
license: MIT
---

# Code Stats

Generate statistics about your codebase including line counts, 
language distribution, and complexity metrics.

## Prerequisites

- Python 3.10+
- Git (for repository analysis)

## Usage

To analyze the current directory:

```bash
askill run code-stats:analyze
```

To analyze a specific path:

```bash
askill run code-stats:analyze -- --path ./src
```

## Output

The command outputs JSON:

```json
{
  "total_files": 150,
  "total_lines": 12500,
  "languages": {
    "Python": 45,
    "JavaScript": 80,
    "Markdown": 25
  }
}
```

## Troubleshooting

### "No module named 'xxx'"

Run setup first:
```bash
askill run code-stats:_setup
```
```

## Summary

1. **Create** SKILL.md with frontmatter + instructions
2. **Add** scripts in `scripts/` directory
3. **Define** commands in frontmatter
4. **Test** with `askill validate` and local install
5. **Publish** with `askill publish`
6. **Update** by bumping version and republishing
