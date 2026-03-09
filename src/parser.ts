// Parser module - parses SKILL.md frontmatter
// Extracts metadata including dependencies

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  author?: string | { name?: string; github?: string; url?: string };
  tags?: string[];
  dependencies?: string[];
  commands?: Record<string, { run: string; description: string }>;
  repository?: { type?: string; url?: string; directory?: string };
  license?: string;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  content: string;
}

/**
 * Parse SKILL.md content and extract frontmatter
 */
export function parseSkillMd(content: string): ParsedSkill {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      content: content.trim(),
    };
  }

  const yamlContent = match[1];
  const markdownContent = content.slice(match[0].length).trim();

  const frontmatter = parseYaml(yamlContent);

  return {
    frontmatter,
    content: markdownContent,
  };
}

/**
 * Simple YAML parser for frontmatter
 * Handles the subset of YAML used in SKILL.md files
 */
function parseYaml(yaml: string): SkillFrontmatter {
  const result: SkillFrontmatter = {};
  const lines = yaml.split('\n');

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  let currentObject: Record<string, string> | null = null;
  let inCommandsBlock = false;
  let currentCommand: string | null = null;
  let commandsResult: Record<string, { run: string; description: string }> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check indentation level
    const indent = line.search(/\S/);

    // Top-level key
    if (indent === 0 && trimmed.includes(':')) {
      // Save previous array/object
      if (currentKey && currentArray) {
        (result as any)[currentKey] = currentArray;
        currentArray = null;
      }
      if (currentKey && currentObject) {
        (result as any)[currentKey] = currentObject;
        currentObject = null;
      }
      if (inCommandsBlock) {
        result.commands = commandsResult;
        inCommandsBlock = false;
      }

      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      currentKey = key;

      if (key === 'commands') {
        inCommandsBlock = true;
        commandsResult = {};
        continue;
      }

      if (value) {
        // Inline value
        (result as any)[key] = parseValue(value);
        currentKey = null;
      }
      // else: value on next lines (array or object)
      continue;
    }

    // Handle commands block specially
    if (inCommandsBlock) {
      if (indent === 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
        const colonIndex = trimmed.indexOf(':');
        const cmdName = trimmed.slice(0, colonIndex).trim();
        const cmdValue = trimmed.slice(colonIndex + 1).trim();
        
        if (!cmdValue) {
          // New command definition
          currentCommand = cmdName;
          commandsResult[cmdName] = { run: '', description: '' };
        }
        continue;
      }

      if (indent === 4 && currentCommand && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const propKey = trimmed.slice(0, colonIndex).trim();
        const propValue = trimmed.slice(colonIndex + 1).trim();
        
        if (propKey === 'run' || propKey === 'description') {
          commandsResult[currentCommand][propKey] = parseValue(propValue);
        }
        continue;
      }
      continue;
    }

    // Array item
    if (trimmed.startsWith('-')) {
      if (!currentArray) currentArray = [];
      const itemValue = trimmed.slice(1).trim();
      currentArray.push(parseValue(itemValue));
      continue;
    }

    // Nested object property (for author, repository)
    if (indent > 0 && currentKey && trimmed.includes(':')) {
      if (!currentObject) currentObject = {};
      const colonIndex = trimmed.indexOf(':');
      const propKey = trimmed.slice(0, colonIndex).trim();
      const propValue = trimmed.slice(colonIndex + 1).trim();
      currentObject[propKey] = parseValue(propValue);
      continue;
    }
  }

  // Save final array/object
  if (currentKey && currentArray) {
    (result as any)[currentKey] = currentArray;
  }
  if (currentKey && currentObject) {
    (result as any)[currentKey] = currentObject;
  }
  if (inCommandsBlock) {
    result.commands = commandsResult;
  }

  return result;
}

/**
 * Parse a YAML value (handle quotes, etc.)
 */
function parseValue(value: string): string {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Extract dependencies from SKILL.md content
 */
export function extractDependencies(content: string): string[] {
  const { frontmatter } = parseSkillMd(content);
  const rawDependencies = (frontmatter as { dependencies?: unknown }).dependencies;

  if (Array.isArray(rawDependencies)) {
    return rawDependencies
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
  }

  if (typeof rawDependencies === 'string') {
    const trimmed = rawDependencies.trim();
    if (!trimmed) return [];

    let candidate = trimmed;
    if (candidate.startsWith('[') && candidate.endsWith(']')) {
      candidate = candidate.slice(1, -1).trim();
    }

    if (!candidate) return [];

    return candidate
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
      .filter((value) => value.length > 0);
  }

  return [];
}

/**
 * Parse a dependency string into its components
 * 
 * Formats:
 * - "@scope/name@^1.0.0" -> { type: 'published', scope: 'scope', name: 'name', version: '^1.0.0' }
 * - "@scope/name" -> { type: 'published', scope: 'scope', name: 'name', version: undefined }
 * - "gh:owner/repo@skill" -> { type: 'github', owner: 'owner', repo: 'repo', skill: 'skill' }
 * - "gh:owner/repo/path" -> { type: 'github', owner: 'owner', repo: 'repo', path: 'path' }
 */
export interface ParsedDependency {
  type: 'published' | 'github';
  raw: string;
  // For published
  scope?: string;
  name?: string;
  version?: string;
  // For github
  owner?: string;
  repo?: string;
  skill?: string;
  path?: string;
}

export function parseDependency(dep: string): ParsedDependency {
  // GitHub format
  if (dep.startsWith('gh:')) {
    const rest = dep.slice(3);
    
    // Check for @ format: owner/repo@skill
    if (rest.includes('@')) {
      const [repoPath, skillName] = rest.split('@');
      const [owner, repo] = repoPath.split('/');
      return {
        type: 'github',
        raw: dep,
        owner,
        repo,
        skill: skillName,
      };
    }
    
    // Path format: owner/repo/path...
    const parts = rest.split('/');
    if (parts.length >= 3) {
      return {
        type: 'github',
        raw: dep,
        owner: parts[0],
        repo: parts[1],
        path: parts.slice(2).join('/'),
      };
    }
    
    // Just owner/repo
    return {
      type: 'github',
      raw: dep,
      owner: parts[0],
      repo: parts[1],
    };
  }
  
  // Published format: @scope/name@version
  if (dep.startsWith('@')) {
    // Find the version separator (last @ after scope)
    const withoutPrefix = dep.slice(1);
    const slashIndex = withoutPrefix.indexOf('/');
    
    if (slashIndex === -1) {
      // Invalid format, return as-is
      return { type: 'published', raw: dep };
    }
    
    const scope = withoutPrefix.slice(0, slashIndex);
    const rest = withoutPrefix.slice(slashIndex + 1);
    
    // Check for version
    const atIndex = rest.indexOf('@');
    if (atIndex !== -1) {
      const name = rest.slice(0, atIndex);
      const version = rest.slice(atIndex + 1);
      return { type: 'published', raw: dep, scope, name, version };
    }
    
    return { type: 'published', raw: dep, scope, name: rest };
  }
  
  // Unknown format
  return { type: 'published', raw: dep };
}

/**
 * Convert a parsed dependency back to a slug for installation
 */
export function dependencyToSlug(dep: ParsedDependency): string {
  if (dep.type === 'github') {
    if (dep.skill) {
      return `gh:${dep.owner}/${dep.repo}@${dep.skill}`;
    }
    if (dep.path) {
      return `gh:${dep.owner}/${dep.repo}/${dep.path}`;
    }
    return `gh:${dep.owner}/${dep.repo}`;
  }
  
  // Published - return without version for now (version resolution not implemented)
  if (dep.scope && dep.name) {
    return `@${dep.scope}/${dep.name}`;
  }
  
  return dep.raw;
}
