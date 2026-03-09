import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectionFallbackRef, getCollectionInstallRefs } from './collection.ts';

test('collection: keeps primary ref first and adds metadata fallback', () => {
  const refs = getCollectionInstallRefs({
    installRef: '@avibe-bot/build-a-skill',
    repoOwner: 'avibe-bot',
    repoName: 'askill',
    filePath: 'skills/build-a-skill/SKILL.md',
  });

  assert.deepEqual(refs, [
    '@avibe-bot/build-a-skill',
    'gh:avibe-bot/askill/skills/build-a-skill',
  ]);
});

test('collection: falls back to skill filter when file path is unavailable', () => {
  const fallback = buildCollectionFallbackRef({
    installRef: '@owner/tool',
    repoOwner: 'owner',
    repoName: 'repo',
    skillName: 'tool',
  });

  assert.equal(fallback, 'gh:owner/repo@tool');
});

test('collection: uses repo root for root SKILL.md', () => {
  const fallback = buildCollectionFallbackRef({
    installRef: '@owner/root-skill',
    repoOwner: 'owner',
    repoName: 'repo',
    filePath: 'SKILL.md',
  });

  assert.equal(fallback, 'gh:owner/repo');
});
