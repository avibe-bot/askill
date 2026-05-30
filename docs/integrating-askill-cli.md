# Integrating askill CLI into Products

Use `askill` as a machine-readable skill management backend for web apps, desktop tools, local agents, or automation services.

This guide focuses on JSON mode so your product can call the CLI and consume stable structured output.

## Why this approach

- Works across environments where users already run `askill`
- Reuses askill's agent compatibility logic (40+ agents)
- Supports both project-level and global skill management
- Keeps your product thin: UI + orchestration, while `askill` does search/list/info/check/install/update/remove

## JSON mode contract

For supported commands, pass `--json` and parse stdout as JSON.

- Supported commands: `add`, `find`, `list`, `info`, `check`, `update`, `remove`
- Success payload shape:

```json
{
  "ok": true,
  "...": "command-specific fields"
}
```

- Error payload shape:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

- Exit code conventions:
  - `0`: success
  - non-zero: operation failed (still machine-readable in `--json` mode)

## JSON Schemas

Official schemas for product integrations are available in `docs/json-contracts/`:

- [Schema index](./json-contracts/README.md)
- [Union schema](./json-contracts/askill-cli-json.schema.json)
- [Add response schema](./json-contracts/add.response.schema.json)
- [Find response schema](./json-contracts/find.response.schema.json)
- [List response schema](./json-contracts/list.response.schema.json)
- [Info response schema](./json-contracts/info.response.schema.json)
- [Check response schema](./json-contracts/check.response.schema.json)
- [Update response schema](./json-contracts/update.response.schema.json)
- [Remove response schema](./json-contracts/remove.response.schema.json)
- [Error response schema](./json-contracts/error.response.schema.json)

Example validation with `ajv-cli`:

```bash
askill list --json > list-output.json
npx ajv validate -s docs/json-contracts/list.response.schema.json -d list-output.json
```

## Key management dimensions

### 1) Scope (project vs global)

- Project-level (default): skills installed under current workspace
- Global-level: add `-g` / `--global`
- List only project: `askill list -p --json`
- List only global: `askill list -g --json`

### 2) Agent targeting

- Install to specific agents: `-a <agents...>`
- Remove from specific agents: `-a <agents...>`
- List filtered by agent: `askill list -a opencode --json`

This lets your UI expose management by both scope and agent type.

## Core product workflows

### Search skills

```bash
askill find memory --json

# tag + pagination for dashboards
askill find --tag productivity --page 1 --limit 20 --json
```

Typical fields:

- `query`
- `filters.tag`
- `pagination.page` / `pagination.limit` / `pagination.total` / `pagination.totalPages`
- `count`
- `skills[]` with `name`, `description`, `owner`, `repo`, `tags`, `stars`, `aiScore`, `installSource`

### Inspect one skill

```bash
askill info gh:owner/repo@skill-name --json
```

Typical fields:

- `skill` registry metadata (`name`, `description`, `owner`, `repo`, `path`, `tags`, `stars`, `installSource`)
- `skill.frontmatter` parsed from raw `SKILL.md`
- `skill.commands` parsed from frontmatter
- `installed` local state with project/global installations when present

### List installed skills

```bash
# all scopes
askill list --json

# global only
askill list -g --json

# project + agent filter
askill list -p -a opencode --json
```

Typical fields:

- `filters.scope` (`all` | `project` | `global`)
- `filters.agents[]`
- `summary.global` / `summary.project`
- `skills[]` with `name`, `description`, `version`, `tags`, `scope`, `path`, `agents[]`, `source`, `installSource`, `installedAt`, `updatedAt`

### Preview install candidates (no write)

```bash
askill add ./skills --list --json
```

Typical fields:

- `action: "preview"`
- `source` metadata
- `skills[]` discovered from source

### Install skills

```bash
# project install to one agent
askill add owner/repo@skill-name -a opencode -y --json

# global install
askill add owner/repo@skill-name -g -a opencode -y --json

# install all discovered skills
askill add ./skills --all -a opencode -y --json
```

Typical fields:

- `action: "install"`
- `scope` (`project` | `global`)
- `selectedAgents[]`
- `requestedSkills[]`
- `summary` (`operations`, `successful`, `failed`, `skills`, `dependencies`)
- `results[]` (per skill + per agent)

### Check update status

```bash
# project lock file
askill check --json

# one global skill
askill check skill-name -g --json
```

Typical fields:

- `scope` (`project` | `global`)
- `requestedSkill`
- `summary` (`total`, `updateAvailable`, `upToDate`, `uncheckable`)
- `skills[]` with `status` (`update_available` | `up_to_date` | `uncheckable`), source metadata, hashes, and `reason`

### Update skills

```bash
# non-interactive in JSON mode
askill update --json

# update one global skill
askill update skill-name -g --json
```

Typical fields:

- `action: "update"`
- `targetAgents[]`
- `check.summary`
- `summary` (`checked`, `updateAvailable`, `updated`, `skipped`, `failed`)
- `results[]` with `status` (`updated` | `skipped` | `failed`), `checkStatus`, `reason`, `error`, source metadata, hashes, and agents

### Remove skills

```bash
# project scope remove
askill remove skill-name -a opencode --json

# global scope remove
askill remove skill-name -g -a opencode --json
```

Typical fields:

- `skill`
- `scope`
- `requestedAgents[]`
- `removedAgents[]`
- `skippedAgents[]`
- `failed[]`

## Error handling patterns

Treat `error.code` as stable routing for product logic.

Common examples:

- `INVALID_AGENTS`: invalid `-a` values
- `INVALID_OPTIONS`: invalid option combination (for example `list -g -p`)
- `MISSING_SKILL`: missing required skill argument in `remove`
- `SKILL_NOT_FOUND`: `info --json` target was not found in the registry
- `MULTIPLE_SKILLS_REQUIRE_SELECTION`: source has multiple skills but no `--all`/`--yes`
- `UNHANDLED_ERROR`: unexpected runtime failure

Recommended UI behavior:

- Show `error.message` to users
- Use `error.code` for deterministic actions/retry hints
- Log `error.details` for diagnostics

## Suggested backend architecture

For a web app, prefer a local/edge service wrapper around CLI execution:

1. UI sends intent (`search/list/install/remove` + scope + agents)
2. Backend maps intent to `askill ... --json`
3. Backend parses JSON stdout
4. Backend returns normalized API response to frontend

This avoids exposing shell execution to browsers and lets you enforce policy centrally.

## Security and reliability checklist

- Whitelist allowed commands and flags
- Sanitize/validate user input before shell execution
- Set execution timeouts per command
- Do not run as root in production unless required
- Capture stdout/stderr and exit codes for audit/debug
- Keep `askill` version pinned or controlled per deployment

## Minimal wrapper example (Node.js)

```js
import { spawn } from 'node:child_process';

export function runAskill(args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('askill', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      let data;
      try {
        data = JSON.parse(stdout || '{}');
      } catch {
        return reject(new Error(`Invalid JSON output: ${stdout || stderr}`));
      }

      resolve({ code, data, stderr });
    });
  });
}

// Example usage:
// runAskill(['list', '-p', '-a', 'opencode', '--json'], { cwd: '/path/to/project' })
```

## Product ideas enabled by this model

- Web skill dashboard (search/install/remove/list)
- Team policy portal (allowlist/denylist by agent + scope)
- IDE plugin panel for one-click skill management
- CI job to audit and reconcile required skills per repository

## Related docs

- [CLI Reference](./cli-reference.md)
- [Getting Started](./getting-started.md)
- [API Specification](./api-spec.md)
