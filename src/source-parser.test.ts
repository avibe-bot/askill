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

test('parseSource: col: prefix parses shared collection source', () => {
  const parsed = parseSource('col:cyh/dev-tools--clx123abc');
  assert.equal(parsed.type, 'collection');
  assert.equal(parsed.collectionOwner, 'cyh');
  assert.equal(parsed.collectionHandle, 'dev-tools--clx123abc');
});

test('parseSource: askill collection URL parses as collection source', () => {
  const parsed = parseSource('https://askill.sh/c/cyh/dev-tools--clx123abc');
  assert.equal(parsed.type, 'collection');
  assert.equal(parsed.collectionOwner, 'cyh');
  assert.equal(parsed.collectionHandle, 'dev-tools--clx123abc');
});

test('parseSource: askill collection URL allows trailing slash and query', () => {
  const parsed = parseSource('https://askill.sh/c/cyh/dev-tools--clx123abc/?ref=share');
  assert.equal(parsed.type, 'collection');
  assert.equal(parsed.collectionOwner, 'cyh');
  assert.equal(parsed.collectionHandle, 'dev-tools--clx123abc');
});

test('parseSource: invalid collection source with nested path falls back from collection parser', () => {
  const parsed = parseSource('col:cyh/dev/tools');
  assert.notEqual(parsed.type, 'collection');
});
