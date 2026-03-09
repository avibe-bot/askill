import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function loadConstants(env: NodeJS.ProcessEnv) {
  const result = spawnSync(
    'npx',
    [
      'tsx',
      '--eval',
      "import('./src/constants.ts').then((m) => console.log(JSON.stringify({ registry: m.REGISTRY_URL, api: m.API_BASE_URL })))",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim()) as { registry: string; api: string };
}

test('constants: defaults to askill.sh endpoints', () => {
  const values = loadConstants({
    ASKILL_REGISTRY_URL: '',
    ASKILL_API_BASE_URL: '',
  });

  assert.equal(values.registry, 'https://askill.sh');
  assert.equal(values.api, 'https://askill.sh/api/v1');
});

test('constants: allows overriding API and registry URLs', () => {
  const values = loadConstants({
    ASKILL_REGISTRY_URL: 'http://127.0.0.1:4010',
    ASKILL_API_BASE_URL: 'http://127.0.0.1:4010/custom-api',
  });

  assert.equal(values.registry, 'http://127.0.0.1:4010');
  assert.equal(values.api, 'http://127.0.0.1:4010/custom-api');
});
