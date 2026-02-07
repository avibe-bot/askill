# Publishing Guide

How to publish your skill to askill.sh.

## Overview

Publishing makes your skill available to everyone via a short, memorable slug like `@yourname/skillname`.

## Prerequisites

1. A GitHub account
2. A valid SKILL.md file
3. askill CLI installed

## Quick Start

```bash
# 1. Login with GitHub
askill login

# 2. Navigate to your skill directory
cd my-skill/

# 3. Validate your skill
askill validate SKILL.md

# 4. Publish
askill publish
```

## Step-by-Step Guide

### 1. Create Your Skill

Create a directory with a SKILL.md file:

```
my-awesome-skill/
├── SKILL.md
└── scripts/
    └── main.py
```

Minimal SKILL.md:

```markdown
---
name: awesome-tool
description: An awesome tool for awesome things
version: 1.0.0
---

# Awesome Tool

Instructions for using this skill...
```

### 2. Login to askill

```bash
askill login
```

Login uses an API token from your account page. Run `askill login`, then paste the token from `https://askill.sh/account`.

```
◆ askill login

  To get your token, visit: https://askill.sh/account
  Token: ask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

  ✓ Logged in as @johndoe
  
  You can now publish skills under the @johndoe scope.
```

### 3. Validate Your Skill

Before publishing, validate your SKILL.md:

```bash
askill validate SKILL.md
```

```
◆ askill validate

  Checking SKILL.md...

  ✓ Frontmatter is valid
  ✓ Name: awesome-tool
  ✓ Description: An awesome tool for awesome things
  ✓ Version: 1.0.0
  ✓ No dependency issues
  
  Ready to publish!
```

### 4. Publish

```bash
askill publish
```

```
◆ askill publish

  Publishing skill...

  ✓ Published @johndoe/awesome-tool@1.0.0
  
  Published! Install with:
    askill add @johndoe/awesome-tool
  
  View at: https://askill.sh/@johndoe/awesome-tool
```

## Publishing Updates

To publish a new version:

1. Update the `version` field in SKILL.md
2. Run `askill publish`

```yaml
---
name: awesome-tool
version: 1.1.0  # Bumped from 1.0.0
---
```

```bash
askill publish
```

```
◆ askill publish

  Current published version: 1.0.0
  New version: 1.1.0
  
  ? Publish @johndoe/awesome-tool@1.1.0? (Y/n) y
  
  ✓ Published @johndoe/awesome-tool@1.1.0
```

## What Gets Published

When you run `askill publish`, registry stores SKILL content and metadata from frontmatter.

| File/Directory | Required | Description |
|----------------|----------|-------------|
| `SKILL.md` | Yes | The skill definition and metadata source |

For `--github` publish, registry fetches the target `SKILL.md` from the provided URL.

## Version Management

### Semantic Versioning

We follow [semver](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `1.0.0` → `1.0.1` (patch: bug fixes)
- `1.0.0` → `1.1.0` (minor: new features, backward compatible)
- `1.0.0` → `2.0.0` (major: breaking changes)

### Version Constraints

Users can install with version constraints:

```bash
askill add @johndoe/awesome-tool@^1.0.0  # Any 1.x.x
askill add @johndoe/awesome-tool@~1.0.0  # Any 1.0.x
askill add @johndoe/awesome-tool@1.0.0   # Exactly 1.0.0
```

### Pre-release Versions

```yaml
version: 2.0.0-beta.1
```

Pre-release versions are not installed by default:

```bash
askill add @johndoe/awesome-tool          # Gets latest stable
askill add @johndoe/awesome-tool@beta     # Gets latest beta
askill add @johndoe/awesome-tool@2.0.0-beta.1  # Exact pre-release
```

## Submit vs Publish

- `askill submit <github-url>`: community indexing entry, no auth required.
- `askill publish`: author-owned release under `@author/skill-name`, requires login token.

## Publishing via CI/CD

### GitHub Actions

```yaml
# .github/workflows/publish.yml
name: Publish Skill

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install askill
        run: |
          curl -fsSL https://askill.sh | sh
          echo "$HOME/.local/bin" >> $GITHUB_PATH
        
      - name: Publish
        run: askill publish
        env:
          ASKILL_TOKEN: ${{ secrets.ASKILL_TOKEN }}
```

### Getting a Token

```bash
askill token create --name "GitHub Actions"
```

Add the token to your repository's secrets as `ASKILL_TOKEN`.

## Troubleshooting

### "Name already taken"

Someone else has published a skill with that name under your scope. Choose a different name.

### "Invalid scope"

You can only publish under:
- Your GitHub username
- GitHub organizations you have write access to

### "Version already exists"

You cannot republish the same version. Bump the version number.

### "Validation failed"

Run `askill validate SKILL.md` to see detailed errors.

## Best Practices

1. **Start with 0.x.x** - Use `0.1.0` while developing, `1.0.0` when stable
2. **Write good descriptions** - This is what users see in search
3. **Include a README** - Displayed on your skill's page
4. **Test before publishing** - Use `askill validate`
5. **Use meaningful tags** - Helps discoverability
6. **Document prerequisites** - What does the user need?

## Next Steps

- [SKILL.md Specification](./skill-spec.md) - Complete file format
- [Slug System](./slug-system.md) - How naming works
- [CLI Reference](./cli-reference.md) - All commands
