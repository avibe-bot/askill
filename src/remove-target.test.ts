import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { resolveRemoveTarget } from './remove-target.ts';
import type { InstalledSkill } from './installer.ts';

const cwd = '/tmp/askill-test';

function makeSkill(name: string, scope: 'project' | 'global' = 'project'): InstalledSkill {
  const base = scope === 'global' ? '/home/test/.agents/skills' : join(cwd, '.agents/skills');
  return {
    name,
    path: join(base, name),
    scope,
    agents: [],
  };
}

test('resolveRemoveTarget: resolves exact skill name', () => {
  const skills = [makeSkill('memory')];
  const resolved = resolveRemoveTarget('memory', skills, cwd);

  assert.ok(resolved);
  assert.equal(resolved.skillName, 'memory');
  assert.equal(resolved.matchedBy, 'name');
});

test('resolveRemoveTarget: resolves by canonical installed path', () => {
  const skills = [makeSkill('memory')];
  const resolved = resolveRemoveTarget(join(cwd, '.agents/skills/memory'), skills, cwd);

  assert.ok(resolved);
  assert.equal(resolved.skillName, 'memory');
  assert.equal(resolved.matchedBy, 'path');
});

test('resolveRemoveTarget: resolves by agent-style path basename', () => {
  const skills = [makeSkill('memory')];
  const resolved = resolveRemoveTarget(join(cwd, '.claude/skills/memory'), skills, cwd);

  assert.ok(resolved);
  assert.equal(resolved.skillName, 'memory');
  assert.equal(resolved.matchedBy, 'path');
});

test('resolveRemoveTarget: returns null when target not installed', () => {
  const skills = [makeSkill('memory')];
  const resolved = resolveRemoveTarget('unknown-skill', skills, cwd);

  assert.equal(resolved, null);
});
