import { basename, isAbsolute, join, normalize, resolve } from 'path';
import { homedir } from 'os';
import type { InstalledSkill } from './installer.ts';
import { sanitizeName } from './installer.ts';
import type { AgentType } from './constants.ts';

export interface RemoveTargetResolution {
  requested: string;
  skillName: string;
  matchedBy: 'name' | 'path';
  scope: 'project' | 'global';
  path: string;
  agents: AgentType[];
}

export function isPathLikeRemoveTarget(input: string): boolean {
  return input.startsWith('/')
    || input.startsWith('~')
    || input.startsWith('./')
    || input.startsWith('../')
    || input.includes('/')
    || input.includes('\\');
}

function normalizeInputPath(input: string, cwd: string): string {
  const expanded = input.startsWith('~')
    ? join(homedir(), input.slice(1).replace(/^[/\\]/, ''))
    : input;

  const absolute = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
  return normalize(absolute);
}

export function resolveRemoveTarget(
  requestedTarget: string,
  installedSkills: InstalledSkill[],
  cwd: string
): RemoveTargetResolution | null {
  const directByName = installedSkills.find((skill) => skill.name === requestedTarget);
  if (directByName) {
    return {
      requested: requestedTarget,
      skillName: directByName.name,
      matchedBy: 'name',
      scope: directByName.scope,
      path: directByName.path,
      agents: directByName.agents,
    };
  }

  const sanitizedTarget = sanitizeName(requestedTarget);
  const bySanitizedName = installedSkills.find((skill) => skill.name === sanitizedTarget);
  if (bySanitizedName) {
    return {
      requested: requestedTarget,
      skillName: bySanitizedName.name,
      matchedBy: 'name',
      scope: bySanitizedName.scope,
      path: bySanitizedName.path,
      agents: bySanitizedName.agents,
    };
  }

  const normalizedTargetPath = normalizeInputPath(requestedTarget, cwd);
  const byPath = installedSkills.find((skill) => normalize(skill.path) === normalizedTargetPath);
  if (byPath) {
    return {
      requested: requestedTarget,
      skillName: byPath.name,
      matchedBy: 'path',
      scope: byPath.scope,
      path: byPath.path,
      agents: byPath.agents,
    };
  }

  const inputBaseName = basename(normalizedTargetPath);
  const sanitizedBaseName = sanitizeName(inputBaseName);
  const byBaseName = installedSkills.find((skill) => skill.name === inputBaseName || skill.name === sanitizedBaseName);
  if (byBaseName) {
    return {
      requested: requestedTarget,
      skillName: byBaseName.name,
      matchedBy: 'path',
      scope: byBaseName.scope,
      path: byBaseName.path,
      agents: byBaseName.agents,
    };
  }

  return null;
}
