# Slug System

How skills are identified and resolved in askill.

## Overview

Every skill has a unique identifier called a **slug**. The slug determines how users install the skill and how the system locates it.

## Slug Types

askill supports two types of slugs:

| Type | Format | Example | Source |
|------|--------|---------|--------|
| **Published** | `@scope/name` | `@anthropic/memory` | askill.sh registry |
| **Indexed** | `gh:owner/repo@name` | `gh:facebook/react@extract-errors` | GitHub (auto-indexed) |
| **Indexed** (full path) | `gh:owner/repo/path` | `gh:facebook/react/scripts/errors` | GitHub (auto-indexed) |

## Published Skills (`@scope/name`)

Published skills are explicitly uploaded to the askill.sh registry by their authors.

### Format

```
@scope/name
@scope/name@version
```

Examples:
```
@anthropic/memory
@anthropic/memory@1.2.0
@anthropic/memory@^1.0.0
@vercel/ai-tools
@mycompany/internal-skill
```

### Scope

The scope (the part after `@` and before `/`) is your namespace:

- **Personal scope**: Your GitHub username (e.g., `@johndoe/my-skill`)
- **Organization scope**: Your GitHub org name (e.g., `@anthropic/memory`)

Scopes are automatically linked to your GitHub identity when you first publish.

### Benefits of Publishing

| Aspect | Published | Indexed |
|--------|-----------|---------|
| Slug length | Short (`@scope/name`) | Long (`gh:owner/repo/path`) |
| Discoverability | Listed on askill.sh | Must know the path |
| Version management | Full semver support | Git-based only |
| Stats | Downloads, stars | GitHub stars only |

## Indexed Skills (`gh:owner/repo@name` or `gh:owner/repo/path`)

Indexed skills are automatically discovered from public GitHub repositories that contain SKILL.md files.

### Formats

There are two formats for indexed skills:

**Short format** (`gh:owner/repo@name`) - Used when the skill name is unique within the repository:
```
gh:facebook/react@extract-errors
gh:vercel/next.js@font-optimizer
gh:anthropic/claude-tools@memory
```

**Full path format** (`gh:owner/repo/path`) - Used when name conflicts exist or for precision:
```
gh:facebook/react/scripts/error-codes
gh:vercel/next.js/packages/next/build
gh:anthropic/claude-tools/memory/v2
```

### Which Format to Use?

| Situation | Format | Example |
|-----------|--------|---------|
| Skill name is unique in repo | `gh:owner/repo@name` | `gh:facebook/react@extract-errors` |
| Multiple skills with same name | `gh:owner/repo/path` | `gh:facebook/react/scripts/extract-errors` |
| Want explicit path | `gh:owner/repo/path` | `gh:myorg/repo/skills/memory` |

The askill.sh website automatically shows the shortest valid format for each skill.

### Legacy Format

For backward compatibility, the `gh:` prefix is optional:
```
facebook/react@extract-errors      # Same as gh:facebook/react@extract-errors
facebook/react/scripts/errors      # Same as gh:facebook/react/scripts/errors
```

However, we recommend always using the `gh:` prefix to clearly indicate these are indexed (not published) skills.

### How Indexing Works

1. askill crawls public GitHub repositories
2. Finds files named `SKILL.md`
3. Parses and indexes them
4. Makes them available via `gh:` prefix

### Limitations

- No version pinning (always latest from default branch)
- Author cannot claim ownership
- Cannot override with published version

## Resolution Rules

When you run `askill install <slug>`:

```
1. If starts with @     → Look up in registry (published skill)
2. If starts with gh:   → Look up in GitHub index
3. If contains / or @   → Treat as indexed (legacy, assumes gh:)
4. Otherwise            → Error (ambiguous)
```

### Version Resolution

```bash
# Published skills support semver
askill install @anthropic/memory@^1.0.0    # Latest 1.x.x
askill install @anthropic/memory@~1.2.0    # Latest 1.2.x
askill install @anthropic/memory@1.2.3     # Exact version

# Indexed skills - both formats work the same
askill install gh:owner/repo@skill-name    # Default branch, short format
askill install gh:owner/repo/path          # Default branch, full path
```

Note: For indexed skills, the `@` in `gh:owner/repo@name` is part of the skill identifier format, not a version specifier. Version pinning for indexed skills is not yet supported.

## Migrating from Indexed to Published

If you maintain a skill that's currently indexed (people install via `gh:`), you can publish it to claim the canonical slug:

```bash
# Currently installed as:
askill install gh:myname/my-repo/skills/cool-skill

# After publishing:
askill install @myname/cool-skill
```

The indexed version remains available, but you can now:
- Use a shorter, cleaner slug
- Manage versions properly
- Track download statistics
- Appear in search results

## Slug Validation Rules

### Scope Rules

- Lowercase letters, numbers, hyphens
- Must match your GitHub username or org
- 2-39 characters (GitHub limit)

### Name Rules

- Lowercase letters, numbers, hyphens
- Must start with a letter
- 2-50 characters
- No consecutive hyphens
- Cannot be a reserved word (`install`, `remove`, `list`, etc.)

### Valid Examples

```
@anthropic/memory
@my-company/tool-v2
@user123/a
```

### Invalid Examples

```
@Anthropic/Memory      # No uppercase
@my_company/tool       # No underscores
@a/b                   # Scope too short
@anthropic/-memory     # Cannot start with hyphen
@anthropic/install     # Reserved word
```

## Storage Structure

Skills are stored based on their slug type:

```
~/.askill/
└── skills/
    ├── @anthropic/              # Published skills
    │   ├── memory/
    │   │   └── SKILL.md
    │   └── tools/
    │       └── SKILL.md
    └── gh/                      # Indexed skills
        └── facebook/
            └── react/
                └── scripts/
                    └── error-codes/
                        └── SKILL.md
```

## URL Patterns

### askill.sh URLs

```
https://askill.sh/@anthropic/memory           # Skill page
https://askill.sh/@anthropic/memory/versions  # Version history
https://askill.sh/@anthropic                  # Scope page (all skills)
```

### API URLs

```
GET /api/v1/skills/@anthropic/memory
GET /api/v1/skills/facebook/react@extract-errors
GET /api/v1/skills/facebook/react/scripts/errors
```

Note: The API accepts both short and full path formats for indexed skills.

## Best Practices

1. **Publish your skills** - Short slugs are easier to remember and type
2. **Use meaningful names** - `@scope/code-reviewer` not `@scope/cr`
3. **Match repo names** - If your repo is `memory-skill`, name it `@scope/memory`
4. **Avoid version in name** - Use `@scope/tool` not `@scope/tool-v2`

## Next Steps

- [Publishing Guide](./publishing.md) - How to publish a skill
- [SKILL.md Specification](./skill-spec.md) - Skill file format
- [CLI Reference](./cli-reference.md) - All CLI commands
