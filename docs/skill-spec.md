# SKILL.md Specification

The complete reference for the SKILL.md protocol.

## Overview

A skill is defined by a single `SKILL.md` file that contains:

1. **YAML Frontmatter** - Structured metadata
2. **Markdown Body** - Instructions for the agent

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
---

# My Skill

Instructions for the agent go here...
```

## File Location

Skills can be organized in any directory structure, but the entry point must be named `SKILL.md`:

```
my-skill/
├── SKILL.md          # Required: Main skill file
├── scripts/          # Optional: Executable scripts
│   ├── build.py
│   └── deploy.sh
└── assets/           # Optional: Additional resources
    └── templates/
```

## Frontmatter Fields

### Required Fields

#### `name`

The skill's identifier. Used as part of the slug when published.

```yaml
name: memory-manager
```

Rules:
- Lowercase letters, numbers, hyphens only
- Must start with a letter
- 2-50 characters
- Must be unique within scope

#### `description`

A brief description (max 200 characters).

```yaml
description: Persistent memory management for AI agents
```

### Optional Fields

#### `version`

Semantic version string.

```yaml
version: 1.2.0
```

If omitted, defaults to `0.0.0` (unversioned).

#### `author`

The skill author. Can be a string or object.

```yaml
# Simple
author: anthropic

# Detailed
author:
  name: Anthropic
  github: anthropic
  url: https://anthropic.com
```

#### `tags`

Array of tags for discovery.

```yaml
tags:
  - memory
  - context
  - persistence
```

Rules:
- Lowercase
- Max 5 tags
- Each tag max 20 characters

#### `dependencies`

Dependencies on other skills.

```yaml
dependencies:
  - @anthropic/tools@^1.0.0
  - @askill/git@^2.0.0
  - gh:owner/repo/path
```

Version syntax (follows semver):
- `@scope/name@^1.0.0` - Compatible with 1.x.x
- `@scope/name@~1.0.0` - Compatible with 1.0.x
- `@scope/name@1.0.0` - Exact version
- `@scope/name` - Latest version

#### `commands`

Executable commands provided by this skill.

```yaml
commands:
  build:
    run: npm run build
    description: Build the project
  
  deploy:
    run: ./scripts/deploy.sh
    description: Deploy to production
    
  _setup:
    run: npm install
    description: Install dependencies
```

Command object fields:

| Field | Required | Description |
|-------|----------|-------------|
| `run` | Yes | Command to execute |
| `description` | Yes | What the command does |

Special commands:
- `_setup` - Run automatically on first use (with user permission)
- Commands starting with `_` are considered internal

#### `repository`

Source repository information.

```yaml
repository:
  type: git
  url: https://github.com/anthropic/skills
  directory: skills/memory
```

#### `license`

SPDX license identifier.

```yaml
license: MIT
```

## Complete Example

```yaml
---
name: code-reviewer
description: Automated code review with AI-powered analysis
version: 2.1.0
author:
  name: Anthropic
  github: anthropic
tags:
  - code-review
  - linting
  - quality
dependencies:
  - @askill/git@^1.0.0
  - @askill/diff@^1.0.0
commands:
  review:
    run: python scripts/review.py
    description: Review staged changes
  review-file:
    run: python scripts/review.py --file
    description: Review a specific file
  _setup:
    run: pip install -r requirements.txt
    description: Install Python dependencies
repository:
  type: git
  url: https://github.com/anthropic/skills
  directory: skills/code-reviewer
license: MIT
---

# Code Reviewer

An intelligent code review assistant that analyzes your code for bugs, 
security issues, and style problems.

## Prerequisites

- Python 3.10 or higher
- Git repository initialized

## Usage

### Review Staged Changes

Ask the agent:
> "Review my staged changes"

Or run directly:
```
askill run code-reviewer:review
```

### Review Specific File

```
askill run code-reviewer:review-file -- src/main.py
```

## What It Checks

1. **Bugs** - Potential runtime errors, null references
2. **Security** - SQL injection, XSS vulnerabilities
3. **Style** - Naming conventions, code organization
4. **Performance** - Inefficient algorithms, memory leaks

## Configuration

Create `.code-reviewer.yml` in your project root:

```yaml
ignore:
  - "*.test.js"
  - "vendor/"
severity: warning  # error, warning, info
```

## Dependencies

This skill uses:
- @askill/git - For accessing repository information
- @askill/diff - For parsing code changes
```

## Markdown Body Guidelines

The markdown body is what the agent reads to understand how to use the skill. Write it as if you're explaining to a capable assistant.

### Recommended Sections

1. **Overview** - What the skill does (1-2 paragraphs)
2. **Prerequisites** - What needs to be installed/configured
3. **Usage** - How to use the skill (with examples)
4. **Commands** - Document each command
5. **Configuration** - Optional settings

### Writing Style

**Do:**
- Use clear, direct language
- Provide concrete examples
- Explain the "why" not just the "how"
- Include error handling guidance

**Don't:**
- Use vague instructions
- Assume prior knowledge
- Skip edge cases
- Write for humans instead of agents

### Example: Good vs Bad

❌ Bad:
```markdown
Run the script to review code.
```

✅ Good:
```markdown
To review code changes:

1. Ensure you have staged changes (`git add`)
2. Run `askill run code-reviewer:review`
3. The output will list issues by severity

If no changes are staged, the command will exit with an error.
```

## Validation

Use the askill CLI to validate your skill:

```bash
askill validate ./my-skill/SKILL.md
```

This checks:
- Frontmatter syntax
- Required fields
- Command definitions
- Dependency format

## Next Steps

- [Publishing Guide](./publishing.md) - Publish your skill
- [Slug System](./slug-system.md) - Understand skill identification
- [CLI Reference](./cli-reference.md) - All CLI commands
