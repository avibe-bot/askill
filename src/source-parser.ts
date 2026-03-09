// Source parser - parses skill source identifiers into structured format
// Supports: GitHub shorthand, GitHub URLs, local paths, gh: prefix

import { isAbsolute, resolve } from 'path';

export interface ParsedSource {
  type: 'github' | 'local' | 'git' | 'registry' | 'collection';
  url: string;            // Clone URL, resolved local path, or registry slug
  owner?: string;         // GitHub owner
  repo?: string;          // GitHub repo
  ref?: string;           // Git branch/tag
  subpath?: string;       // Subpath within repo
  skillFilter?: string;   // @skill filter (owner/repo@skill)
  localPath?: string;     // Resolved local path
  registrySlug?: string;  // Published slug (@author/slug[@version])
  collectionOwner?: string;
  collectionHandle?: string;
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
 * - "col:owner/collection-handle"         → Shared collection
 * - "https://askill.sh/c/owner/handle"    → Shared collection page URL
 */
export function parseSource(input: string): ParsedSource {
  const collection = parseCollectionSource(input);
  if (collection) {
    return collection;
  }

  // Published slug: @author/slug[@version]
  // Must be handled before GitHub shorthand parsing.
  if (isRegistrySlug(input)) {
    return {
      type: 'registry',
      url: input,
      registrySlug: input,
    };
  }

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

function isRegistrySlug(input: string): boolean {
  // Accept:
  // - @author/slug
  // - @author/slug@version (version can be semver or range like ^1.2.0)
  // Keep validation conservative: author/slug must be URL-safe and not contain spaces.
  // Version (if present) must not include '/'.
  if (!input.startsWith('@')) return false;
  if (input.startsWith('@/')) return false;
  if (input.includes(' ')) return false;

  // @author/slug or @author/slug@version
  const match = input.match(/^@([^/]+)\/([^@/]+)(?:@([^/]+))?$/);
  if (!match) return false;

  const [, author, slug] = match;
  if (!author || !slug) return false;

  // Very light validation: disallow leading/trailing hyphens/dots and empty segments.
  // Full validation belongs in publish/validate flows.
  const validSeg = (s: string) => /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(s);
  if (!validSeg(author)) return false;
  if (!validSeg(slug)) return false;

  return true;
}

function parseCollectionSource(input: string): ParsedSource | null {
  const prefixed = input.match(/^col:([^/\s]+)\/([^/\s?#]+)$/i);
  if (prefixed) {
    const [, owner, handle] = prefixed;
    return {
      type: 'collection',
      url: `https://askill.sh/c/${owner}/${handle}`,
      collectionOwner: owner,
      collectionHandle: handle,
    };
  }

  const urlMatch = input.match(/^https?:\/\/askill\.sh\/c\/([^/?#]+)\/([^/?#]+)\/?(?:\?[^#]*)?(?:#.*)?$/i);
  if (urlMatch) {
    const [, owner, handle] = urlMatch;
    return {
      type: 'collection',
      url: `https://askill.sh/c/${owner}/${handle}`,
      collectionOwner: owner,
      collectionHandle: handle,
    };
  }

  return null;
}
