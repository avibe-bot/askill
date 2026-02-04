// Skill discovery - finds SKILL.md files in a cloned repository

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { parseSkillMd, type SkillFrontmatter } from './parser.ts';

export interface DiscoveredSkill {
  name: string;
  description: string;
  path: string;          // Absolute path to the skill directory
  rawContent: string;    // Raw SKILL.md content
  frontmatter: SkillFrontmatter;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__']);

/**
 * Check if a directory contains a SKILL.md file
 */
async function hasSkillMd(dir: string): Promise<boolean> {
  try {
    const skillPath = join(dir, 'SKILL.md');
    const stats = await stat(skillPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Parse a SKILL.md file and return a DiscoveredSkill
 */
async function parseSkillDir(dir: string): Promise<DiscoveredSkill | null> {
  try {
    const skillPath = join(dir, 'SKILL.md');
    const content = await readFile(skillPath, 'utf-8');
    const parsed = parseSkillMd(content);

    if (!parsed.frontmatter.name || !parsed.frontmatter.description) {
      return null;
    }

    return {
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      path: dir,
      rawContent: content,
      frontmatter: parsed.frontmatter,
    };
  } catch {
    return null;
  }
}

/**
 * Recursively find directories containing SKILL.md
 */
async function findSkillDirs(dir: string, depth = 0, maxDepth = 5): Promise<string[]> {
  if (depth > maxDepth) return [];

  try {
    const [hasSkill, entries] = await Promise.all([
      hasSkillMd(dir),
      readdir(dir, { withFileTypes: true }).catch(() => []),
    ]);

    const currentDir = hasSkill ? [dir] : [];

    const subDirResults = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
        .map((entry) => findSkillDirs(join(dir, entry.name), depth + 1, maxDepth))
    );

    return [...currentDir, ...subDirResults.flat()];
  } catch {
    return [];
  }
}

/**
 * Discover all skills in a directory (cloned repo or local path)
 * 
 * Search order:
 * 1. Root directory (if it has SKILL.md)
 * 2. Common skill locations (skills/, .claude/skills/, etc.)
 * 3. Recursive search as fallback
 */
export async function discoverSkills(
  basePath: string,
  subpath?: string,
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];
  const seenNames = new Set<string>();
  const searchPath = subpath ? join(basePath, subpath) : basePath;

  // If pointing directly at a skill, return just that
  if (await hasSkillMd(searchPath)) {
    const skill = await parseSkillDir(searchPath);
    if (skill) {
      return [skill];
    }
  }

  // Search common skill locations
  const prioritySearchDirs = [
    searchPath,
    join(searchPath, 'skills'),
    join(searchPath, 'skills/.curated'),
    join(searchPath, 'skills/.experimental'),
    join(searchPath, '.agents/skills'),
    join(searchPath, '.claude/skills'),
    join(searchPath, '.opencode/skills'),
    join(searchPath, '.cursor/skills'),
    join(searchPath, '.codex/skills'),
    join(searchPath, '.cline/skills'),
    join(searchPath, '.gemini/skills'),
    join(searchPath, '.windsurf/skills'),
    join(searchPath, '.roo/skills'),
    join(searchPath, '.github/skills'),
    join(searchPath, '.goose/skills'),
  ];

  for (const dir of prioritySearchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = join(dir, entry.name);
          if (await hasSkillMd(skillDir)) {
            const skill = await parseSkillDir(skillDir);
            if (skill && !seenNames.has(skill.name)) {
              skills.push(skill);
              seenNames.add(skill.name);
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Fallback: recursive search if nothing found
  if (skills.length === 0) {
    const allSkillDirs = await findSkillDirs(searchPath);

    for (const skillDir of allSkillDirs) {
      const skill = await parseSkillDir(skillDir);
      if (skill && !seenNames.has(skill.name)) {
        skills.push(skill);
        seenNames.add(skill.name);
      }
    }
  }

  return skills;
}

/**
 * Filter discovered skills by name (case-insensitive)
 */
export function filterSkills(skills: DiscoveredSkill[], names: string[]): DiscoveredSkill[] {
  const normalizedNames = names.map((n) => n.toLowerCase());
  return skills.filter((skill) => {
    const name = skill.name.toLowerCase();
    return normalizedNames.some((input) => input === name);
  });
}
