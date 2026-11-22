import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api } from './api.ts';

test('submit allows a slow indexer but still has a finite deadline', async (t) => {
  const timeout = t.mock.method(AbortSignal, 'timeout');
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ skills: [] }));
  await api.submit('https://github.com/example/skills');
  assert.equal(request.mock.callCount(), 1);
  const [, options] = request.mock.calls[0].arguments;
  assert.ok(options);
  assert.equal(options.method, 'POST');
  assert.ok('timeout' in options && options.timeout === false, 'Bun must not terminate an idle request before our deadline');
  assert.equal(timeout.mock.callCount(), 1);
  assert.equal(timeout.mock.calls[0].arguments[0], 4 * 60_000);
  assert.equal(options.signal, timeout.mock.calls[0].result);
});

// Exercise the actual CLI failure path with a fake token, stubbed fetch, and an isolated home directory.
for (const [command, scenario, respond, expected] of [
  ['login', 'null 401', 'return Response.json(null, { status: 401 })', /Invalid token[\s\S]*HTTP 401/i],
  ['login', 'structured 401', "return Response.json({ error: { message: 'Token expired' } }, { status: 401 })", /Invalid token[\s\S]*Token expired/i],
  ['login', '503', 'return new Response(null, { status: 503 })', /HTTP 503/i],
  ['login', 'timeout', "throw new DOMException('deadline exceeded', 'TimeoutError')", /timed out/i],
  ['submit', 'connect timeout', "throw new TypeError('fetch failed', { cause: Object.assign(new Error(), { code: 'UND_ERR_CONNECT_TIMEOUT' }) })", /timed out connecting/i],
  ['submit', 'headers timeout', "throw new TypeError('fetch failed', { cause: Object.assign(new Error(), { code: 'UND_ERR_HEADERS_TIMEOUT' }) })", /check the registry before retrying/i],
  ['submit', 'deadline', "throw new DOMException('deadline exceeded', 'TimeoutError')", /check the registry before retrying/i],
] as const) {
  test(`${command}: ${scenario}`, () => {
    const home = mkdtempSync(join(tmpdir(), 'askill-cli-'));
    try {
      const endpoint = command === 'login' ? '/auth/me' : '/submit';
      const args = command === 'login' ? ['--token', 'test-only-token'] : ['https://github.com/example/skills'];
      const mock = `globalThis.fetch = async url => { if (!url.endsWith('${endpoint}')) return Response.json({ minimum: '0.1.0', latest: '0.1.0' }); ${respond}; }`;
      const result = spawnSync(process.execPath, [...process.execArgv, '--import', `data:text/javascript,${encodeURIComponent(mock)}`, 'src/cli.ts', command, ...args], {
        env: { ...process.env, HOME: home, USERPROFILE: home, ASKILL_API_BASE_URL: 'http://127.0.0.1:1', NO_COLOR: '1' },
        encoding: 'utf8', timeout: 10_000,
      });
      const output = result.stdout + result.stderr;
      assert.equal(result.status, 1, output);
      assert.match(output, expected);
      if (scenario === 'connect timeout') assert.doesNotMatch(output, /may still process|check the registry/i);
      if (!scenario.includes('401')) assert.doesNotMatch(output, /invalid token/i);
      assert.doesNotMatch(output, /test-only-token/);
      assert.equal(existsSync(join(home, '.askill', 'credentials.json')), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
}
