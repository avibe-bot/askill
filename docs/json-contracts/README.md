# askill CLI JSON Schemas

Machine-readable schemas for `askill --json` output.

## Files

- `askill-cli-json.schema.json`: top-level union schema for `add`, `find`, `list`, `info`, `check`, `update`, `remove`, and generic error payloads
- `add.response.schema.json`: `askill add ... --json` success payload
- `find.response.schema.json`: `askill find ... --json` success payload
- `list.response.schema.json`: `askill list ... --json` success payload
- `info.response.schema.json`: `askill info ... --json` success payload
- `check.response.schema.json`: `askill check ... --json` success payload
- `update.response.schema.json`: `askill update ... --json` success payload
- `remove.response.schema.json`: `askill remove ... --json` success payload
- `error.response.schema.json`: generic error payload (`ok: false`)

## Validation examples

Install a validator (example uses `ajv-cli`):

```bash
npm i -D ajv-cli
```

Validate a response against command schema:

```bash
askill list --json > list-output.json
npx ajv validate -s docs/json-contracts/list.response.schema.json -d list-output.json
```

Validate against the union schema:

```bash
askill find memory --json > find-output.json
npx ajv validate -s docs/json-contracts/askill-cli-json.schema.json -d find-output.json
```

## Notes

- Schemas are designed for forward compatibility and may allow additional fields.
- For business logic, route by `error.code` (when `ok: false`).
