# Publishing Guide

How publishing works in askill v2.

## Core Rule

Publishing is controlled by frontmatter `slug`.

- If `SKILL.md` contains a valid `slug`, it can be published.
- Canonical install identifier is always `@author/slug`.

## Required Frontmatter

```yaml
---
name: my-skill
slug: my-skill
version: 1.0.0
description: What this skill does
---
```

Rules for `slug`:

- lowercase letters, numbers, hyphens only
- regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- stable identifier for all versions

## Publish Paths

### 1) Local publish (author = logged-in user)

Use when publishing from local files.

```bash
askill login
askill publish
# or
askill publish ./path/to/skill
```

Requires:

- `askill login` token
- valid `name`, `slug`, `version`

### 2) GitHub URL publish (author = repo owner)

Use when publishing from GitHub `SKILL.md` URL.

```bash
askill publish --github https://github.com/owner/repo/blob/main/path/to/SKILL.md
```

Behavior:

- no login required
- author is derived from GitHub repo owner (user or org)
- resulting slug is `@owner/<frontmatter.slug>`

### 3) Submit-triggered publish (index first)

```bash
askill submit https://github.com/owner/repo
```

Indexer discovers skills; entries with valid `slug` can be auto-published by registry pipeline.

## Uniqueness and Conflicts

`@author/slug` is globally unique within that author namespace.

- same source may publish new versions
- different source cannot take same `@author/slug`

Conflict response:

- error code: `SLUG_CONFLICT`
- fix by changing frontmatter `slug` or using the original source binding

## Version Rules

- `version` must be valid semver
- new publish must be greater than current latest for same `@author/slug`
- duplicate version returns `VERSION_EXISTS`

## Install After Publish

```bash
askill add @author/slug
```

## Submit vs Publish

- `askill submit <github-url>`: request indexing/discovery
- `askill publish [path]`: publish local content (login required)
- `askill publish --github <blob-url>`: publish from GitHub source (author=repo owner)

## Troubleshooting

### Missing slug

- error: `MISSING_SLUG`
- add frontmatter `slug`

### Invalid slug

- error: invalid slug format
- use lowercase letters, numbers, hyphens only

### Version not incremented

- error: `VERSION_NOT_INCREMENTED`
- bump semver version

### Slug conflict

- error: `SLUG_CONFLICT`
- slug already bound to another source under same author

## CI Example

```yaml
name: Publish Skill

on:
  push:
    branches: [main]
    paths:
      - "skills/**/SKILL.md"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish from GitHub URL
        run: |
          npx askill-cli publish --github "https://github.com/${{ github.repository }}/blob/${{ github.ref_name }}/skills/my-skill/SKILL.md"
```
