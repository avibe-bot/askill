// Skill Lock File - tracks installed skills for update detection
// Compatible with Vercel Skills CLI lock file format
// Project location: <project>/.agents/.skill-lock.json
// Global location: ~/.agents/.skill-lock.json

import { access, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { sanitizeName } from './installer.ts';

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';
const LOCK_FILE = '.skill-lock.json';
const CURRENT_VERSION = 3; // Match Vercel Skills version for compatibility

export interface SkillLockOptions {
  /** Use the user-level lock file instead of the current project lock file. */
  global?: boolean;
  /** Project directory for project-scoped lock operations. Defaults to process.cwd(). */
  cwd?: string;
}

/**
 * Represents a single installed skill entry in the lock file.
 */
export interface SkillLockEntry {
  /** Normalized source identifier (e.g., "owner/repo") */
  source: string;
  /** The source type (e.g., "github", "local") */
  sourceType: 'github' | 'local' | 'gitlab' | string;
  /** The original URL used to install (for re-fetching updates) */
  sourceUrl: string;
  /** Subpath within the source repo, if applicable */
  skillPath?: string;
  /**
   * GitHub tree SHA for the entire skill folder.
   * Changes when ANY file in the skill folder changes.
   * Used for update detection.
   */
  skillFolderHash: string;
  /** ISO timestamp when the skill was first installed */
  installedAt: string;
  /** ISO timestamp when the skill was last updated */
  updatedAt: string;
}

/**
 * Tracks dismissed prompts (Vercel Skills compatibility).
 */
export interface DismissedPrompts {
  findSkillsPrompt?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * The structure of the skill lock file.
 */
export interface SkillLockFile {
  /** Schema version for migrations */
  version: number;
  /** Map of skill name to its lock entry */
  skills: Record<string, SkillLockEntry>;
  /** Last selected agents for installation */
  lastSelectedAgents?: string[];
  /** Tracks dismissed prompts (Vercel Skills compatibility) */
  dismissed?: DismissedPrompts;
  /** Preserve unknown fields for compatibility */
  [key: string]: unknown;
}

/**
 * Get the path to the scoped skill lock file.
 */
export function getSkillLockPath(options: SkillLockOptions = {}): string {
  const baseDir = options.global ? (process.env.HOME?.trim() || homedir()) : options.cwd || process.cwd();
  return join(baseDir, AGENTS_DIR, LOCK_FILE);
}

/**
 * Create an empty lock file structure.
 */
function createEmptyLockFile(): SkillLockFile {
  return {
    version: CURRENT_VERSION,
    skills: {},
  };
}

/**
 * Read the skill lock file.
 * Returns an empty lock file structure if the file doesn't exist.
 * Preserves unknown fields for compatibility with Vercel Skills.
 */
export async function readSkillLock(options: SkillLockOptions = {}): Promise<SkillLockFile> {
  const lockPath = getSkillLockPath(options);
  const result = await readSkillLockFile(lockPath);

  if (result.exists || options.global) {
    return result.lock;
  }

  const migrated = await migrateLegacyGlobalLockToProject(options.cwd || process.cwd());
  if (migrated) {
    await writeSkillLock(migrated, options);
    return migrated;
  }

  return result.lock;
}

async function readSkillLockFile(lockPath: string): Promise<{ lock: SkillLockFile; exists: boolean }> {
  try {
    const content = await readFile(lockPath, 'utf-8');
    const parsed = JSON.parse(content) as SkillLockFile;

    // Validate basic structure
    if (typeof parsed.version !== 'number' || !parsed.skills) {
      return { lock: createEmptyLockFile(), exists: true };
    }

    // If old version, wipe and start fresh (backwards incompatible)
    if (parsed.version < CURRENT_VERSION) {
      return { lock: createEmptyLockFile(), exists: true };
    }

    return { lock: parsed, exists: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { lock: createEmptyLockFile(), exists: code !== 'ENOENT' };
  }
}

async function migrateLegacyGlobalLockToProject(cwd: string): Promise<SkillLockFile | null> {
  const legacy = await readSkillLockFile(getSkillLockPath({ global: true }));
  if (!legacy.exists) return null;

  const migratedSkills: Record<string, SkillLockEntry> = {};

  for (const [skillName, entry] of Object.entries(legacy.lock.skills)) {
    const projectSkillPath = join(cwd, AGENTS_DIR, SKILLS_SUBDIR, sanitizeName(skillName), 'SKILL.md');
    try {
      await access(projectSkillPath);
      migratedSkills[skillName] = entry;
    } catch {
      // Legacy global locks may include other projects or real global installs.
    }
  }

  if (Object.keys(migratedSkills).length === 0) return null;

  return {
    ...legacy.lock,
    version: CURRENT_VERSION,
    skills: migratedSkills,
  };
}

/**
 * Write the skill lock file.
 * Creates the directory if it doesn't exist.
 */
export async function writeSkillLock(lock: SkillLockFile, options: SkillLockOptions = {}): Promise<void> {
  const lockPath = getSkillLockPath(options);

  // Ensure directory exists
  await mkdir(dirname(lockPath), { recursive: true });

  // Write with pretty formatting for human readability
  const content = JSON.stringify(lock, null, 2);
  await writeFile(lockPath, content, 'utf-8');
}

/**
 * Add or update a skill entry in the lock file.
 */
export async function addSkillToLock(
  skillName: string,
  entry: Omit<SkillLockEntry, 'installedAt' | 'updatedAt'>,
  options: SkillLockOptions = {}
): Promise<void> {
  const lock = await readSkillLock(options);
  const now = new Date().toISOString();

  const existingEntry = lock.skills[skillName];

  lock.skills[skillName] = {
    ...entry,
    installedAt: existingEntry?.installedAt ?? now,
    updatedAt: now,
  };

  await writeSkillLock(lock, options);
}

/**
 * Remove a skill from the lock file.
 */
export async function removeSkillFromLock(skillName: string, options: SkillLockOptions = {}): Promise<boolean> {
  const lock = await readSkillLock(options);

  if (!(skillName in lock.skills)) {
    return false;
  }

  delete lock.skills[skillName];
  await writeSkillLock(lock, options);
  return true;
}

/**
 * Get a skill entry from the lock file.
 */
export async function getSkillFromLock(skillName: string, options: SkillLockOptions = {}): Promise<SkillLockEntry | null> {
  const lock = await readSkillLock(options);
  return lock.skills[skillName] ?? null;
}

/**
 * Get all skills from the lock file.
 */
export async function getAllLockedSkills(options: SkillLockOptions = {}): Promise<Record<string, SkillLockEntry>> {
  const lock = await readSkillLock(options);
  return lock.skills;
}

/**
 * Get skills grouped by source for batch update operations.
 */
export async function getSkillsBySource(options: SkillLockOptions = {}): Promise<
  Map<string, { skills: string[]; entry: SkillLockEntry }>
> {
  const lock = await readSkillLock(options);
  const bySource = new Map<string, { skills: string[]; entry: SkillLockEntry }>();

  for (const [skillName, entry] of Object.entries(lock.skills)) {
    const existing = bySource.get(entry.source);
    if (existing) {
      existing.skills.push(skillName);
    } else {
      bySource.set(entry.source, { skills: [skillName], entry });
    }
  }

  return bySource;
}

/**
 * Get the last selected agents.
 */
export async function getLastSelectedAgents(options: SkillLockOptions = {}): Promise<string[] | undefined> {
  const lock = await readSkillLock(options);
  return lock.lastSelectedAgents;
}

/**
 * Save the selected agents to the lock file.
 */
export async function saveLastSelectedAgents(agents: string[], options: SkillLockOptions = {}): Promise<void> {
  const lock = await readSkillLock(options);
  lock.lastSelectedAgents = agents;
  await writeSkillLock(lock, options);
}

/**
 * Fetch the tree SHA (folder hash) for a skill folder using GitHub's Trees API.
 * This hash changes when ANY file in the skill folder changes.
 *
 * @param ownerRepo - GitHub owner/repo (e.g., "anthropics/courses")
 * @param skillPath - Path to skill folder (e.g., "skills/memory")
 * @returns The tree SHA for the skill folder, or empty string if not found
 */
export async function fetchSkillFolderHash(
  ownerRepo: string,
  skillPath: string
): Promise<string> {
  // Normalize path
  let folderPath = skillPath.replace(/\\/g, '/');

  // Remove SKILL.md suffix to get folder path
  if (folderPath.endsWith('/SKILL.md')) {
    folderPath = folderPath.slice(0, -9);
  } else if (folderPath.endsWith('SKILL.md')) {
    folderPath = folderPath.slice(0, -8);
  }

  // Remove trailing slash
  if (folderPath.endsWith('/')) {
    folderPath = folderPath.slice(0, -1);
  }

  const branches = ['main', 'master'];

  for (const branch of branches) {
    try {
      const url = `https://api.github.com/repos/${ownerRepo}/git/trees/${branch}?recursive=1`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'askill-cli',
        },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
        sha: string;
        tree: Array<{ path: string; type: string; sha: string }>;
      };

      // If folderPath is empty, this is a root-level skill - use the root tree SHA
      if (!folderPath) {
        return data.sha;
      }

      // Find the tree entry for the skill folder
      const folderEntry = data.tree.find(
        (entry) => entry.type === 'tree' && entry.path === folderPath
      );

      if (folderEntry) {
        return folderEntry.sha;
      }
    } catch {
      continue;
    }
  }

  return '';
}

/**
 * Compute a local folder hash for non-GitHub sources.
 * Uses a simple hash of file paths and modification times.
 */
export function computeLocalFolderHash(files: Array<{ path: string; mtime: number }>): string {
  const content = files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}:${f.mtime}`)
    .join('\n');

  // Simple hash - not cryptographic, just for change detection
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
