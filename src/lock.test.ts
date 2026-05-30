import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  addSkillToLock,
  getAllLockedSkills,
  getSkillLockPath,
  saveLastSelectedAgents,
  type SkillLockEntry,
} from './lock.ts';

function makeEntry(source = 'local-source'): Omit<SkillLockEntry, 'installedAt' | 'updatedAt'> {
  return {
    source,
    sourceType: 'local',
    sourceUrl: source,
    skillFolderHash: '',
  };
}

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(join(tmpdir(), 'askill-lock-home-'));
  process.env.HOME = home;

  try {
    return await fn(home);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(home, { recursive: true, force: true });
  }
}

async function withTempProject<T>(fn: (project: string) => Promise<T>): Promise<T> {
  const project = await mkdtemp(join(tmpdir(), 'askill-lock-project-'));
  try {
    return await fn(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

test('lock path defaults to project scope', async () => {
  await withTempHome(async (home) => {
    await withTempProject(async (project) => {
      assert.equal(getSkillLockPath({ cwd: project }), join(project, '.agents/.skill-lock.json'));
      assert.equal(getSkillLockPath({ global: true }), join(home, '.agents/.skill-lock.json'));
    });
  });
});

test('project lock writes stay isolated from global lock', async () => {
  await withTempHome(async (home) => {
    await withTempProject(async (project) => {
      await addSkillToLock('project-skill', makeEntry(), { cwd: project });
      await saveLastSelectedAgents(['claude-code'], { cwd: project });

      const projectLock = await readJson(getSkillLockPath({ cwd: project }));
      assert.ok(projectLock.skills['project-skill']);
      assert.deepEqual(projectLock.lastSelectedAgents, ['claude-code']);

      const globalSkills = await getAllLockedSkills({ global: true });
      assert.deepEqual(globalSkills, {});
      assert.equal(getSkillLockPath({ global: true }), join(home, '.agents/.skill-lock.json'));
    });
  });
});

test('global lock writes stay isolated from project lock', async () => {
  await withTempHome(async () => {
    await withTempProject(async (project) => {
      await addSkillToLock('global-skill', makeEntry(), { global: true });

      const globalLock = await readJson(getSkillLockPath({ global: true }));
      assert.ok(globalLock.skills['global-skill']);

      const projectSkills = await getAllLockedSkills({ cwd: project });
      assert.deepEqual(projectSkills, {});
    });
  });
});

test('project lock migrates matching legacy global entries once', async () => {
  await withTempHome(async () => {
    await withTempProject(async (project) => {
      const projectSkillDir = join(project, '.agents/skills/legacy-project');
      await mkdir(projectSkillDir, { recursive: true });
      await writeFile(join(projectSkillDir, 'SKILL.md'), '# legacy project skill', 'utf-8');

      const globalLockPath = getSkillLockPath({ global: true });
      await mkdir(dirname(globalLockPath), { recursive: true });
      await writeFile(globalLockPath, JSON.stringify({
        version: 3,
        lastSelectedAgents: ['claude-code'],
        skills: {
          'legacy-project': {
            ...makeEntry('legacy-project-source'),
            installedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          'other-project': {
            ...makeEntry('other-project-source'),
            installedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }, null, 2), 'utf-8');

      const skills = await getAllLockedSkills({ cwd: project });
      assert.deepEqual(Object.keys(skills), ['legacy-project']);

      const projectLock = await readJson(getSkillLockPath({ cwd: project }));
      assert.ok(projectLock.skills['legacy-project']);
      assert.equal(projectLock.skills['other-project'], undefined);
      assert.deepEqual(projectLock.lastSelectedAgents, ['claude-code']);
    });
  });
});
