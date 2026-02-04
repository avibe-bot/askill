// Source parser - parses skill source identifiers into structured format
// Supports: GitHub shorthand, GitHub URLs, local paths, gh: prefix

import { isAbsolute, resolve } from 'path';

export interface ParsedSource {
  type: 'github' | 'local' | 'git';
  url: string;            // Clone URL or resolved local path
  owner?: string;         // GitHub owner
  repo?: string;          // GitHub repo
  ref?: string;           // Git branch/tag
  subpath?: string;       // Subpath within repo
  skillFilter?: string;   // @skill filter (owner/repo@skill)
  localPath?: string;     // Resolved local path
}

/**
 * Parse a source string into a structured format.
 * 
 * Supported formats:
 * - "owner/repo"                          → GitHub clone
 * - "owner/repo@skill-name"              → GitHub clone + filter
 * - "owner/repo/path/to/skill"           → GitHub clone + subpath
 * - "gh:owner/repo"                      → GitHub clone (explicit)
 * - "gh:owner/repo@skill-name"           → GitHub clone + filter
 * - "gh:owner/repo/path"                 → GitHub clone + subpath
 * - "https://github.com/owner/repo"      → GitHub clone from URL
 * - "https://github.com/owner/repo/tree/branch/path" → GitHub clone + ref + subpath
 * - "./local/path"                        → Local directory
 * - "/absolute/path"                      → Local directory
 */
export function parseSource(input: string): ParsedSource {
  // Local path: absolute, relative, or current directory
  if (isLocalPath(input)) {
    const resolvedPath = resolve(input);
    return {
      type: 'local',
      url: resolvedPath,
      localPath: resolvedPath,
    };
  }

  // Strip gh: prefix
  const normalized = input.startsWith('gh:') ? input.slice(3) : input;
  const hadGhPrefix = input.startsWith('gh:');

  // GitHub URL with path: https://github.com/owner/repo/tree/branch/path
  const githubTreeWithPathMatch = normalized.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      owner, repo, ref, subpath,
    };
  }

  // GitHub URL with branch: https://github.com/owner/repo/tree/branch
  const githubTreeMatch = normalized.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/);
  if (githubTreeMatch) {
    const [, owner, repo, ref] = githubTreeMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      owner, repo, ref,
    };
  }

  // GitHub URL: https://github.com/owner/repo
  const githubUrlMatch = normalized.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubUrlMatch) {
    const [, owner, repo] = githubUrlMatch;
    const cleanRepo = repo!.replace(/\.git$/, '');
    return {
      type: 'github',
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      owner, repo: cleanRepo,
    };
  }

  // @skill syntax: owner/repo@skill-name
  const atSkillMatch = normalized.match(/^([^/]+)\/([^/@]+)@(.+)$/);
  if (atSkillMatch && !normalized.includes(':')) {
    const [, owner, repo, skillFilter] = atSkillMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      owner, repo, skillFilter,
    };
  }

  // Shorthand: owner/repo or owner/repo/path
  const shorthandMatch = normalized.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (shorthandMatch && !normalized.includes(':') && !normalized.startsWith('.') && !normalized.startsWith('/')) {
    const [, owner, repo, subpath] = shorthandMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      owner, repo, subpath,
    };
  }

  // Fallback: treat as git URL
  return {
    type: 'git',
    url: normalized,
  };
}

function isLocalPath(input: string): boolean {
  return (
    isAbsolute(input) ||
    input.startsWith('./') ||
    input.startsWith('../') ||
    input === '.' ||
    input === '..' ||
    /^[a-zA-Z]:[/\\]/.test(input)
  );
}
