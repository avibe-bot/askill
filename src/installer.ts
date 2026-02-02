// Installer module - handles skill installation to agent directories

import { mkdir, writeFile, symlink, lstat, rm, readlink, access, readdir } from 'fs/promises';
import { join, dirname, relative, resolve, sep, normalize, basename } from 'path';
import { homedir, platform } from 'os';
import { agents, AGENTS_DIR, SKILLS_SUBDIR, type AgentType } from './constants.ts';

export type InstallMode = 'symlink' | 'copy';

export interface InstallResult {
  success: boolean;
  path: string;
  canonicalPath?: string;
  mode: InstallMode;
  symlinkFailed?: boolean;
  error?: string;
}

/**
 * Sanitize skill name for safe filesystem usage
 */
export function sanitizeName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '');

  return sanitized.substring(0, 255) || 'unnamed-skill';
}

/**
 * Validate path is within base directory (prevent traversal)
 */
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase;
}

/**
 * Get canonical skills directory path
 */
export function getCanonicalSkillsDir(global: boolean, cwd?: string): string {
  const baseDir = global ? homedir() : cwd || process.cwd();
  return join(baseDir, AGENTS_DIR, SKILLS_SUBDIR);
}

/**
 * Create symlink with cross-platform support
 */
async function createSymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    const resolvedTarget = resolve(target);
    const resolvedLinkPath = resolve(linkPath);

    if (resolvedTarget === resolvedLinkPath) {
      return true;
    }

    // Check if link already exists
    try {
      const stats = await lstat(linkPath);
      if (stats.isSymbolicLink()) {
        const existingTarget = await readlink(linkPath);
        const resolvedExisting = resolve(dirname(linkPath), existingTarget);
        if (resolvedExisting === resolvedTarget) {
          return true;
        }
        await rm(linkPath);
      } else {
        await rm(linkPath, { recursive: true });
      }
    } catch (err: any) {
      if (err.code === 'ELOOP') {
        await rm(linkPath, { force: true }).catch(() => {});
      }
    }

    const linkDir = dirname(linkPath);
    await mkdir(linkDir, { recursive: true });

    const relativePath = relative(linkDir, target);
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;

    await symlink(relativePath, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean and create directory
 */
async function cleanAndCreateDirectory(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  await mkdir(path, { recursive: true });
}

/**
 * Install skill content to agent directory
 */
export async function installSkill(
  skillName: string,
  content: string,
  agentType: AgentType,
  options: {
    global?: boolean;
    cwd?: string;
    mode?: InstallMode;
  } = {}
): Promise<InstallResult> {
  const agent = agents[agentType];
  if (!agent) {
    return {
      success: false,
      path: '',
      mode: options.mode ?? 'symlink',
      error: `Unknown agent: ${agentType}`,
    };
  }

  const isGlobal = options.global ?? false;
  const cwd = options.cwd || process.cwd();
  const installMode = options.mode ?? 'symlink';

  // Check if agent supports global installation
  if (isGlobal && !agent.globalSkillsDir) {
    return {
      success: false,
      path: '',
      mode: installMode,
      error: `${agent.displayName} does not support global skill installation`,
    };
  }

  const sanitized = sanitizeName(skillName);

  // Canonical location: .agents/skills/<skill-name>
  const canonicalBase = getCanonicalSkillsDir(isGlobal, cwd);
  const canonicalDir = join(canonicalBase, sanitized);

  // Agent-specific location
  const agentBase = isGlobal ? agent.globalSkillsDir! : join(cwd, agent.skillsDir);
  const agentDir = join(agentBase, sanitized);

  // Validate paths
  if (!isPathSafe(canonicalBase, canonicalDir) || !isPathSafe(agentBase, agentDir)) {
    return {
      success: false,
      path: agentDir,
      mode: installMode,
      error: 'Invalid skill name: potential path traversal detected',
    };
  }

  try {
    if (installMode === 'copy') {
      // Copy mode: write directly to agent location
      await cleanAndCreateDirectory(agentDir);
      await writeFile(join(agentDir, 'SKILL.md'), content, 'utf-8');

      return {
        success: true,
        path: agentDir,
        mode: 'copy',
      };
    }

    // Symlink mode: write to canonical location and symlink
    await cleanAndCreateDirectory(canonicalDir);
    await writeFile(join(canonicalDir, 'SKILL.md'), content, 'utf-8');

    const symlinkCreated = await createSymlink(canonicalDir, agentDir);

    if (!symlinkCreated) {
      // Fallback to copy
      await cleanAndCreateDirectory(agentDir);
      await writeFile(join(agentDir, 'SKILL.md'), content, 'utf-8');

      return {
        success: true,
        path: agentDir,
        canonicalPath: canonicalDir,
        mode: 'symlink',
        symlinkFailed: true,
      };
    }

    return {
      success: true,
      path: agentDir,
      canonicalPath: canonicalDir,
      mode: 'symlink',
    };
  } catch (error) {
    return {
      success: false,
      path: agentDir,
      mode: installMode,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if skill is installed for an agent
 */
export async function isSkillInstalled(
  skillName: string,
  agentType: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): Promise<boolean> {
  const agent = agents[agentType];
  if (!agent) return false;

  const sanitized = sanitizeName(skillName);

  if (options.global && !agent.globalSkillsDir) {
    return false;
  }

  const targetBase = options.global
    ? agent.globalSkillsDir!
    : join(options.cwd || process.cwd(), agent.skillsDir);

  const skillDir = join(targetBase, sanitized);

  if (!isPathSafe(targetBase, skillDir)) {
    return false;
  }

  try {
    await access(skillDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which agents are installed on the system
 */
export async function detectInstalledAgents(): Promise<AgentType[]> {
  const results = await Promise.all(
    Object.entries(agents).map(async ([type, config]) => ({
      type: type as AgentType,
      installed: await config.detectInstalled(),
    }))
  );
  return results.filter((r) => r.installed).map((r) => r.type);
}

/**
 * List installed skills
 */
export interface InstalledSkill {
  name: string;
  path: string;
  scope: 'project' | 'global';
  agents: AgentType[];
}

export async function listInstalledSkills(
  options: {
    global?: boolean;
    cwd?: string;
  } = {}
): Promise<InstalledSkill[]> {
  const cwd = options.cwd || process.cwd();
  const installedSkills: InstalledSkill[] = [];
  const scopes: Array<{ global: boolean; path: string }> = [];

  if (options.global === undefined) {
    scopes.push({ global: false, path: getCanonicalSkillsDir(false, cwd) });
    scopes.push({ global: true, path: getCanonicalSkillsDir(true, cwd) });
  } else {
    scopes.push({ global: options.global, path: getCanonicalSkillsDir(options.global, cwd) });
  }

  const detectedAgents = await detectInstalledAgents();

  for (const scope of scopes) {
    try {
      const entries = await readdir(scope.path, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = join(scope.path, entry.name);

        // Check if SKILL.md exists
        try {
          await access(join(skillDir, 'SKILL.md'));
        } catch {
          continue;
        }

        // Find which agents have this skill
        const installedAgents: AgentType[] = [];
        for (const agentType of detectedAgents) {
          const agent = agents[agentType];
          if (scope.global && !agent.globalSkillsDir) continue;

          const agentBase = scope.global ? agent.globalSkillsDir! : join(cwd, agent.skillsDir);
          const agentSkillDir = join(agentBase, entry.name);

          try {
            await access(agentSkillDir);
            installedAgents.push(agentType);
          } catch {
            // Not installed for this agent
          }
        }

        installedSkills.push({
          name: entry.name,
          path: skillDir,
          scope: scope.global ? 'global' : 'project',
          agents: installedAgents,
        });
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return installedSkills;
}

/**
 * Remove installed skill
 */
export async function removeSkill(
  skillName: string,
  agentType: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const agent = agents[agentType];
  if (!agent) {
    return { success: false, error: `Unknown agent: ${agentType}` };
  }

  const sanitized = sanitizeName(skillName);
  const cwd = options.cwd || process.cwd();

  if (options.global && !agent.globalSkillsDir) {
    return { success: false, error: `${agent.displayName} does not support global skills` };
  }

  const agentBase = options.global ? agent.globalSkillsDir! : join(cwd, agent.skillsDir);
  const skillDir = join(agentBase, sanitized);

  if (!isPathSafe(agentBase, skillDir)) {
    return { success: false, error: 'Invalid skill name' };
  }

  try {
    await rm(skillDir, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
