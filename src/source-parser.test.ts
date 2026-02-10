import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSource } from './source-parser.ts';

test('parseSource: registry slugs starting with @ are not treated as GitHub', () => {
  const parsed = parseSource('@avibe-bot/use-askill');
  assert.equal(parsed.type, 'registry');
  assert.equal(parsed.registrySlug, '@avibe-bot/use-askill');
  assert.equal(parsed.url, '@avibe-bot/use-askill');
});

test('parseSource: registry slugs can include version spec', () => {
  const parsed = parseSource('@anthropic/memory@^1.0.0');
  assert.equal(parsed.type, 'registry');
  assert.equal(parsed.url, '@anthropic/memory@^1.0.0');
});

test('parseSource: GitHub shorthand still works', () => {
  const parsed = parseSource('avibe-bot/use-askill');
  assert.equal(parsed.type, 'github');
  assert.equal(parsed.owner, 'avibe-bot');
  assert.equal(parsed.repo, 'use-askill');
  assert.equal(parsed.url, 'https://github.com/avibe-bot/use-askill.git');
});

test('parseSource: gh: prefix forces GitHub', () => {
  const parsed = parseSource('gh:avibe-bot/use-askill');
  assert.equal(parsed.type, 'github');
  assert.equal(parsed.owner, 'avibe-bot');
  assert.equal(parsed.repo, 'use-askill');
  assert.equal(parsed.url, 'https://github.com/avibe-bot/use-askill.git');
});
