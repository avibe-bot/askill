#!/usr/bin/env node

// askill - Agent Skill Package Manager
// Install AI agent skills from askill.sh

import { VERSION, REGISTRY_URL, RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED, GRAY, agents, AGENTS_DIR, SKILLS_SUBDIR, POPULAR_AGENTS, type AgentType } from './constants.ts';
import { api, APIError, type Skill, type RepoSkill } from './api.ts';
import { installSkill, installSkillFromDir, detectInstalledAgents, listInstalledSkills, removeSkill, removeCanonicalSkill, sanitizeName, type InstallMode } from './installer.ts';
import { getAvailableUpdate, selfUpdate } from './updater.ts';
import { getPreferredAgents, savePreferredAgents } from './config.ts';
import { loadCredentials, saveCredentials, clearCredentials, maskToken } from './credentials.ts';
import { extractDependencies, isValidDependencySpec, parseDependency, dependencyToSlug, parseSkillMd } from './parser.ts';
import { parseSource, type ParsedSource } from './source-parser.ts';
import { discoverSkills, filterSkills, type DiscoveredSkill } from './discover.ts';
import { getCollectionInstallRefs } from './collection.ts';
import { cloneRepo, cleanupTempDir, GitCloneError } from './git.ts';
import { addSkillToLock, removeSkillFromLock, fetchSkillFolderHash, saveLastSelectedAgents, getLastSelectedAgents, getAllLockedSkills } from './lock.ts';
import { resolveRemoveTarget, isPathLikeRemoveTarget } from './remove-target.ts';
import { join } from 'path';
import { homedir } from 'os';
import * as p from '@clack/prompts';
import pc from 'picocolors';

// ============================================
// Logo and Banner
// ============================================

const LOGO = `
 █████╗ ███████╗██╗  ██╗██╗██╗     ██╗     
██╔══██╗██╔════╝██║ ██╔╝██║██║     ██║     
███████║███████╗█████╔╝ ██║██║     ██║     
██╔══██║╚════██║██╔═██╗ ██║██║     ██║     
██║  ██║███████║██║  ██╗██║███████╗███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝
`.trim();

function showLogo(): void {
  const lines = LOGO.split('\n');
  const grays = ['\x1b[38;5;250m', '\x1b[38;5;248m', '\x1b[38;5;245m', '\x1b[38;5;243m', '\x1b[38;5;240m', '\x1b[38;5;238m'];
  console.log();
  lines.forEach((line, i) => {
    console.log(`${grays[i] || grays[grays.length - 1]}${line}${RESET}`);
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(`${DIM}The Agent Skill Package Manager${RESET}`);
  console.log();
  console.log(`  ${DIM}$${RESET} askill add ${DIM}<skill>${RESET}       ${DIM}Install a skill${RESET}`);
  console.log(`  ${DIM}$${RESET} askill find ${DIM}[query]${RESET}      ${DIM}Search for skills${RESET}`);
  console.log(`  ${DIM}$${RESET} askill list${RESET}              ${DIM}List installed skills${RESET}`);
  console.log(`  ${DIM}$${RESET} askill remove ${DIM}<skill>${RESET}   ${DIM}Remove a skill${RESET}`);
  console.log(`  ${DIM}$${RESET} askill init${RESET}              ${DIM}Create a new skill${RESET}`);
  console.log(`  ${DIM}$${RESET} askill submit ${DIM}<url>${RESET}   ${DIM}Submit GitHub skill URL${RESET}`);
  console.log(`  ${DIM}$${RESET} askill login${RESET}             ${DIM}Login with API token${RESET}`);
  console.log(`  ${DIM}$${RESET} askill publish${RESET}           ${DIM}Publish to @author/slug (run with --help)${RESET}`);
  console.log(`  ${DIM}$${RESET} askill run ${DIM}<skill:cmd>${RESET}  ${DIM}Run a skill command${RESET}`);
  console.log();
  console.log(`${DIM}Browse skills at${RESET} ${CYAN}https://askill.sh${RESET}`);
  console.log();
}

function showHelp(): void {
  console.log(`
${BOLD}Usage:${RESET} askill <command> [options]

${BOLD}Commands:${RESET}
  add, install, i <skill>  Install a skill from askill.sh
  remove, rm <skill>       Remove an installed skill
  list, ls                 List installed skills
  find, search, s [query]  Search for skills
  info <skill>             Show skill details
  init [dir]               Create a new SKILL.md template
  validate [path]          Validate a SKILL.md file
  check                    Check installed skills for updates
  update [skill]           Update installed skills
  submit <github-url>      Submit GitHub URL for indexing
  login [--token <token>]  Login with API token
  logout                   Clear saved API token
  whoami                   Show current authenticated user
  publish [path]           Publish local SKILL.md (login required)
  publish --github <url>   Publish GitHub SKILL.md (author=repo owner)
  run <skill:cmd>          Run a skill command
  upgrade                  Update askill CLI to latest version

${BOLD}Skill Source Formats:${RESET}
  @author/skill-name                    Published skill from askill registry
  col:owner/collection-handle           Shared skill collection
  https://askill.sh/c/owner/handle      Shared collection URL
  owner/repo                          All skills from a GitHub repo
  owner/repo@skill-name               Specific skill by name
  owner/repo/path/to/skill            Specific skill by path
  https://github.com/owner/repo       Full GitHub URL
  ./local/path                        Local directory
  gh:owner/repo@skill-name            Explicit GitHub prefix (optional)

${BOLD}Install Options:${RESET}
  (default)             Install to current project: .agents/skills/
  -g, --global          Install globally (user-level)
  -a, --agent <agents>  Install to specific agents
  -y, --yes             Skip confirmation prompts
  --copy                Copy files instead of symlink
  -l, --list            Preview skills in a repo without installing
  --all                 Install all discovered skills (skip selection)

${BOLD}Run Options:${RESET}
  askill run <skill>:<command>      Run a skill's command

${BOLD}Search Options:${RESET}
  --full-desc             Show full skill descriptions in find/search
  --json                  Output machine-readable JSON

${BOLD}Options:${RESET}
  --help, -h            Show this help message
  --version, -v         Show version number

${BOLD}Per-command Help:${RESET}
  askill <command> --help
  askill help <command>

${BOLD}For Agents:${RESET}
  Official usage guide: ${CYAN}https://github.com/avibe-bot/askill/tree/main/skills/discover-a-skill${RESET}

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} askill add anthropic/courses@prompt-eng
  ${DIM}$${RESET} askill add anthropic/courses
  ${DIM}$${RESET} askill add col:acme/dev-tools -y
  ${DIM}$${RESET} askill add ./my-skills/custom-skill
  ${DIM}$${RESET} askill find memory
  ${DIM}$${RESET} askill find memory --full-desc
  ${DIM}$${RESET} askill list -g
  ${DIM}$${RESET} askill info gh:anthropic/courses@prompt-eng

${DIM}Browse more at${RESET} ${CYAN}https://askill.sh${RESET}
`);
}

interface SpinnerLike {
  start: (message: string) => void;
  stop: (message?: string) => void;
  message: (message: string) => void;
}

interface JsonErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function createSpinner(plain: boolean): SpinnerLike {
  if (!plain) {
    return p.spinner() as SpinnerLike;
  }

  return {
    start: () => {},
    stop: () => {},
    message: () => {},
  };
}

function toAgentOutput(agent: AgentType): { id: AgentType; name: string } {
  return {
    id: agent,
    name: agents[agent]?.displayName || agent,
  };
}

function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function printJsonError(code: string, message: string, details?: unknown): never {
  const payload: JsonErrorPayload = {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
  printJson(payload);
  process.exit(1);
}

function parseAgentOptionValues(args: string[], startIndex: number): { values: string[]; nextIndex: number } {
  const values: string[] = [];
  let currentIndex = startIndex;

  while (currentIndex < args.length && !args[currentIndex].startsWith('-')) {
    values.push(args[currentIndex]);
    currentIndex += 1;
  }

  return {
    values,
    nextIndex: currentIndex - 1,
  };
}

function resolveValidatedAgents(agentValues: string[] | undefined): { targetAgents: AgentType[]; invalidAgents: string[] } {
  const validAgents = Object.keys(agents) as AgentType[];

  if (!agentValues || agentValues.length === 0) {
    return {
      targetAgents: [],
      invalidAgents: [],
    };
  }

  const invalidAgents = agentValues.filter((agent) => !validAgents.includes(agent as AgentType));
  if (invalidAgents.length > 0) {
    return {
      targetAgents: [],
      invalidAgents,
    };
  }

  return {
    targetAgents: agentValues as AgentType[],
    invalidAgents: [],
  };
}

function normalizeCommand(command: string): string {
  switch (command) {
    case 'install':
    case 'i':
      return 'add';
    case 'search':
    case 's':
      return 'find';
    case 'ls':
      return 'list';
    case 'rm':
    case 'uninstall':
      return 'remove';
    case 'show':
      return 'info';
    default:
      return command;
  }
}

function showCommandHelp(commandInput: string): boolean {
  const command = normalizeCommand(commandInput);

  const helps: Record<string, string> = {
    add: `${BOLD}askill add${RESET}\n\nUsage:\n  askill add <source> [options]\n\nDescription:\n  Install skills from published slugs, GitHub, local directories, or shared collections.\n\nSources:\n  @author/skill-name\n  col:owner/collection-handle\n  https://askill.sh/c/owner/handle\n  gh:owner/repo@skill-name\n  gh:owner/repo/path/to/skill\n  owner/repo\n  ./local/path\n\nScope:\n  default: current project (.agents/skills/)\n  -g, --global: user-level install\n\nOptions:\n  -g, --global            Install globally\n  -a, --agent <agents...> Install to specific agents\n  -y, --yes               Skip confirmation prompts\n  --copy                  Copy files instead of symlink\n  -l, --list              Preview discovered skills only\n  --all                   Install all discovered skills\n  --json                  Output machine-readable JSON\n\nExamples:\n  askill add @johndoe/awesome-tool -y\n  askill add col:acme/dev-tools -y\n  askill add gh:facebook/react@extract-errors\n  askill add owner/repo --all -a claude-code opencode -y\n\nGuide:\n  https://github.com/avibe-bot/askill/tree/main/skills/discover-a-skill`,

    remove: `${BOLD}askill remove${RESET}\n\nUsage:\n  askill remove <skill-or-path> [options]\n\nDescription:\n  Remove an installed skill by name or installed path.\n\nOptions:\n  -g, --global            Remove global installation\n  -a, --agent <agents...> Remove only from specific agents\n  --json                  Output machine-readable JSON\n\nExamples:\n  askill remove memory\n  askill remove .agents/skills/memory\n  askill remove memory -g\n  askill remove memory -a opencode codex --json`,

    list: `${BOLD}askill list${RESET}\n\nUsage:\n  askill list [options]\n\nDescription:\n  List installed skills and where they are available.\n\nOptions:\n  -g, --global            Show global skills only\n  -p, --project           Show project skills only\n  -a, --agent <agents...> Filter by agent(s)\n  --json                  Output machine-readable JSON\n\nExamples:\n  askill list\n  askill list -g\n  askill list -p -a opencode --json`,

    find: `${BOLD}askill find${RESET}\n\nUsage:\n  askill find [query] [options]\n\nDescription:\n  Search indexed and published skills on askill.sh.\n\nOptions:\n  --full-desc             Show full descriptions\n  --json                  Output machine-readable JSON\n\nExamples:\n  askill find memory\n  askill find code review --full-desc\n  askill find memory --json`,

    info: `${BOLD}askill info${RESET}\n\nUsage:\n  askill info <slug>\n\nDescription:\n  Show detailed metadata and installation info for one skill.\n\nExamples:\n  askill info @johndoe/awesome-tool\n  askill info gh:facebook/react@extract-errors`,

    check: `${BOLD}askill check${RESET}\n\nUsage:\n  askill check [skill]\n\nDescription:\n  Check installed skills for available updates without installing.\n\nExamples:\n  askill check\n  askill check memory`,

    update: `${BOLD}askill update${RESET}\n\nUsage:\n  askill update [skill]\n\nDescription:\n  Update one installed skill or all installed skills.\n\nExamples:\n  askill update\n  askill update memory`,

    run: `${BOLD}askill run${RESET}\n\nUsage:\n  askill run <skill>:<command> [args...]\n\nDescription:\n  Run a command declared in a skill's SKILL.md frontmatter.\n\nExamples:\n  askill run @anthropic/memory:save --key name --value \"Alice\"\n  askill run my-skill:_setup`,

    validate: `${BOLD}askill validate${RESET}\n\nUsage:\n  askill validate [path]\n\nDescription:\n  Validate SKILL.md frontmatter and command structure.\n\nExamples:\n  askill validate\n  askill validate ./my-skill/SKILL.md`,

    init: `${BOLD}askill init${RESET}\n\nUsage:\n  askill init [dir] [options]\n\nDescription:\n  Generate a new SKILL.md template interactively or non-interactively.\n\nOptions:\n  -y, --yes               Use defaults without prompts\n\nExamples:\n  askill init\n  askill init ./my-skill -y`,

    submit: `${BOLD}askill submit${RESET}\n\nUsage:\n  askill submit <github-url>\n\nDescription:\n  Submit a GitHub repository or SKILL.md URL for indexing on askill.sh.\n\nExamples:\n  askill submit https://github.com/owner/repo\n  askill submit https://github.com/owner/repo/blob/main/skills/foo/SKILL.md`,

    login: `${BOLD}askill login${RESET}\n\nUsage:\n  askill login [--token <ask_xxx>]\n\nDescription:\n  Save and verify an askill API token for publishing.\n\nExamples:\n  askill login\n  askill login --token ask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,

    logout: `${BOLD}askill logout${RESET}\n\nUsage:\n  askill logout\n\nDescription:\n  Clear saved local credentials.`,

    whoami: `${BOLD}askill whoami${RESET}\n\nUsage:\n  askill whoami\n\nDescription:\n  Show current authenticated account and masked token.`,

    publish: `${BOLD}askill publish${RESET}\n\nUsage:\n  askill publish <path>\n  askill publish .\n  askill publish --github <blob-url-to-SKILL.md>\n\nDescription:\n  Publish a skill to canonical slug @author/slug.\n\nRules:\n  - SKILL.md must include valid frontmatter fields: name, slug, version\n  - Local publish requires askill login token (author is your GitHub user)\n  - --github publish uses repository owner as author and does not require login\n\nExamples:\n  askill publish .\n  askill publish ./skills/my-skill\n  askill publish --github https://github.com/owner/repo/blob/main/skills/my-skill/SKILL.md`,

    upgrade: `${BOLD}askill upgrade${RESET}\n\nUsage:\n  askill upgrade\n\nDescription:\n  Self-update askill CLI to the latest available version.`,

    help: `${BOLD}askill help${RESET}\n\nUsage:\n  askill help\n  askill help <command>\n\nDescription:\n  Show global help or detailed help for a specific command.`,
  };

  const text = helps[command];
  if (!text) return false;

  console.log();
  console.log(text);
  console.log();
  return true;
}

async function maybeAutoUpgradeOnStartup(commandInput: string): Promise<void> {
  const command = normalizeCommand(commandInput);
  const skipCommands = new Set(['upgrade', 'help', 'version', '--version', '-v', '--help', '-h']);

  if (skipCommands.has(command)) return;

  const available = await getAvailableUpdate(false).catch(() => null);
  if (!available) return;

  console.log(`${DIM}Auto-updating askill: ${available.current} -> ${available.latest}${RESET}`);
  await selfUpdate();
}

// ============================================
// Install Command
// ============================================

interface InstallOptions {
  global?: boolean;
  agent?: string[];
  yes?: boolean;
  copy?: boolean;
  list?: boolean;
  all?: boolean;
  json?: boolean;
}

function parseInstallOptions(args: string[]): { skillName: string; options: InstallOptions } {
  const options: InstallOptions = {};
  let skillName = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-g' || arg === '--global') {
      options.global = true;
    } else if (arg === '-y' || arg === '--yes') {
      options.yes = true;
    } else if (arg === '--copy') {
      options.copy = true;
    } else if (arg === '-l' || arg === '--list') {
      options.list = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '-a' || arg === '--agent') {
      const parsed = parseAgentOptionValues(args, i + 1);
      options.agent = parsed.values;
      i = parsed.nextIndex;
    } else if (!arg.startsWith('-')) {
      skillName = arg;
    }
  }

  return { skillName, options };
}

/**
 * Resolve skills via Git Clone (primary) or askill.sh API (fallback).
 * Returns discovered skills from a cloned repo, or falls back to API.
 */
async function resolveSkills(
  source: string,
  spinner: SpinnerLike,
  options: InstallOptions,
): Promise<{
  skills: DiscoveredSkill[];
  parsed: ParsedSource;  // Source metadata for lock file
  tempDir?: string;  // Must be cleaned up after install
}> {
  const parsed = parseSource(source);

  // Shared collection: resolve all included skills via askill API
  if (parsed.type === 'collection') {
    const collectionOwner = parsed.collectionOwner || '';
    const collectionHandle = parsed.collectionHandle || '';

    spinner.start(`Fetching collection ${collectionOwner}/${collectionHandle}...`);
    const collection = await api.getCollection(collectionOwner, collectionHandle);
    spinner.stop(`Collection ${collectionOwner}/${collectionHandle}: ${collection.skills.length} skill(s)`);
    spinner.start(`Resolving skills...`);

    const resolvedSkills: DiscoveredSkill[] = [];
    const skippedRefs: string[] = [];
    const nestedSpinner = createSpinner(true);
    for (const item of collection.skills) {
      const refsToTry = getCollectionInstallRefs(item);
      let resolved = false;

      for (const ref of refsToTry) {
        try {
          spinner.message(`Resolving ${ref}...`);
          const result = await resolveSkills(ref, nestedSpinner, { ...options, json: true });
          if (result.skills.length === 0) {
            if (result.tempDir) {
              await cleanupTempDir(result.tempDir).catch(() => {});
            }
            continue;
          }
          // Clean up any tempDir immediately; we only need rawContent for collection skills
          if (result.tempDir) {
            await cleanupTempDir(result.tempDir).catch(() => {});
          }
          for (const skill of result.skills) {
            // Clear path so installer uses rawContent (tempDir is already cleaned up)
            skill.path = '';
            // Preserve source hint from per-skill resolution
            if (!skill.sourceHint) {
              skill.sourceHint = toSkillSourceHint(ref);
            }
            resolvedSkills.push(skill);
          }
          resolved = true;
          break;
        } catch {
          // Try next candidate install ref.
        }
      }

      if (!resolved) {
        skippedRefs.push(item.installRef);
      }
    }

    if (collection.skills.length > 0 && resolvedSkills.length === 0) {
      throw new Error(`Collection ${collectionOwner}/${collectionHandle} does not contain any installable skills`);
    }

    spinner.stop(`Found ${resolvedSkills.length}/${collection.skills.length} skill(s) in collection`);
    if (skippedRefs.length > 0 && !options.json) {
      p.log.warning(`Skipped ${skippedRefs.length} collection entr${skippedRefs.length === 1 ? 'y' : 'ies'} that could not be resolved`);
      for (const skippedRef of skippedRefs.slice(0, 5)) {
        console.log(`  ${pc.dim('·')} ${skippedRef}`);
      }
      if (skippedRefs.length > 5) {
        console.log(`  ${pc.dim(`...and ${skippedRefs.length - 5} more`)}`);
      }
    }
    return { skills: resolvedSkills, parsed };
  }

  // Published slug: resolve via registry API
  if (parsed.type === 'registry') {
    const slug = parsed.registrySlug || source;
    spinner.start(`Fetching ${slug} from askill.sh...`);
    const skill = await api.getSkill(slug);
    const content = await api.getSkillRaw(slug);
    const parsedContent = parseSkillMd(content);

    const name = parsedContent.frontmatter.name || skill.name || 'unknown';
    const description = parsedContent.frontmatter.description || skill.description || '';

    spinner.stop(`Found: ${pc.cyan(name)}`);

    return {
      skills: [{
        name,
        description,
        path: '',
        rawContent: content,
        frontmatter: parsedContent.frontmatter,
      }],
      parsed,
    };
  }

  // Local path: discover directly
  if (parsed.type === 'local') {
    spinner.start(`Scanning ${source}...`);
    const skills = await discoverSkills(parsed.localPath!);
    spinner.stop(`Found ${skills.length} skill(s) in ${pc.cyan(source)}`);
    return { skills, parsed };
  }

  // Git-based source: try clone first
  if (parsed.type === 'github' || parsed.type === 'git') {
    spinner.start(`Cloning ${parsed.owner ? `${parsed.owner}/${parsed.repo}` : parsed.url}...`);

    try {
      const tempDir = await cloneRepo(parsed.url, parsed.ref, parsed.subpath);
      spinner.stop('Repository cloned');

      spinner.start('Discovering skills...');
      let skills = await discoverSkills(tempDir, parsed.subpath);

      // If @skill filter, apply it
      if (parsed.skillFilter) {
        skills = filterSkills(skills, [parsed.skillFilter]);
      }

      spinner.stop(`Found ${skills.length} skill(s)`);
      return { skills, parsed, tempDir };
    } catch (error) {
      // Clone failed - try API fallback for GitHub sources
      if (parsed.type === 'github' && parsed.owner && parsed.repo) {
        const errorMsg = error instanceof GitCloneError ? error.message : 'Clone failed';
        spinner.stop(pc.yellow(`Git clone failed, trying askill.sh...`));

        try {
          return await resolveSkillsViaApi(parsed, spinner, options);
        } catch (apiError) {
          // Both failed
          if (options.json) {
            const apiErrorMessage = apiError instanceof Error ? apiError.message : 'Failed';
            throw new Error(`Could not resolve skill (clone: ${errorMsg}; api: ${apiErrorMessage})`);
          }

          spinner.stop(pc.red('Failed'));
          p.log.error(`Git clone: ${errorMsg}`);
          p.log.error(`API fallback: ${apiError instanceof Error ? apiError.message : 'Failed'}`);
          p.outro(pc.red('Could not resolve skill'));
          process.exit(1);
        }
      }

      // Non-GitHub source, no fallback
      if (options.json) {
        const errorMessage = error instanceof Error ? error.message : 'Clone failed';
        throw new Error(`Could not clone repository: ${errorMessage}`);
      }

      spinner.stop(pc.red('Clone failed'));
      if (error instanceof GitCloneError) {
        p.log.error(error.message);
      }
      p.outro(pc.red('Could not clone repository'));
      process.exit(1);
    }
  }

  // Should not reach here
  return { skills: [], parsed };
}

/**
 * Fallback: resolve skills via askill.sh API (only SKILL.md content, no scripts/)
 */
async function resolveSkillsViaApi(
  parsed: ParsedSource,
  spinner: SpinnerLike,
  options: InstallOptions,
): Promise<{ skills: DiscoveredSkill[]; parsed: ParsedSource }> {
  const { owner, repo, skillFilter, subpath } = parsed;

  if (skillFilter) {
    // owner/repo@skill
    const slug = `${owner}/${repo}@${skillFilter}`;
    spinner.start(`Fetching ${slug} from askill.sh...`);
    const skill = await api.getSkill(slug);
    const content = await api.getSkillRaw(slug);
    spinner.stop(`Found: ${pc.cyan(skill.name)}`);

    return {
      skills: [{
        name: skill.name || 'unknown',
        description: skill.description || '',
        path: '',  // No local path (API-only)
        rawContent: content,
        frontmatter: { name: skill.name || undefined, description: skill.description || undefined },
      }],
      parsed,
    };
  }

  if (subpath) {
    // owner/repo/path
    const slug = `${owner}/${repo}/${subpath}`;
    spinner.start(`Fetching ${slug} from askill.sh...`);
    const skill = await api.getSkill(slug);
    const skillSlug = skill.owner && skill.repo && skill.name
      ? `${skill.owner}/${skill.repo}@${skill.name}`
      : String(skill.id);
    const content = await api.getSkillRaw(skillSlug);
    spinner.stop(`Found: ${pc.cyan(skill.name)}`);

    return {
      skills: [{
        name: skill.name || 'unknown',
        description: skill.description || '',
        path: '',
        rawContent: content,
        frontmatter: { name: skill.name || undefined, description: skill.description || undefined },
      }],
      parsed,
    };
  }

  // owner/repo - list all
  spinner.start(`Fetching skills from ${owner}/${repo} on askill.sh...`);
  const repoData = await api.getRepoSkills(owner!, repo!);
  spinner.stop(`Found ${repoData.skills.length} skill(s)`);

  const results: DiscoveredSkill[] = [];
  for (const s of repoData.skills) {
    const slug = `${owner}/${repo}@${s.name}`;
    try {
      const content = await api.getSkillRaw(slug);
      results.push({
        name: s.name || 'unknown',
        description: s.description || '',
        path: '',
        rawContent: content,
        frontmatter: { name: s.name || undefined, description: s.description || undefined },
      });
    } catch {
      // Skip skills we can't fetch
    }
  }

  return { skills: results, parsed };
}

function toLockSource(sourceParsed: ParsedSource, fallback: string): string {
  if (sourceParsed.type === 'collection' && sourceParsed.collectionOwner && sourceParsed.collectionHandle) {
    return `col:${sourceParsed.collectionOwner}/${sourceParsed.collectionHandle}`;
  }

  if (sourceParsed.owner && sourceParsed.repo) {
    return `${sourceParsed.owner}/${sourceParsed.repo}`;
  }

  return sourceParsed.localPath || sourceParsed.url || fallback;
}

function toSkillSourceHint(input: string): DiscoveredSkill['sourceHint'] | undefined {
  const parsed = parseSource(input);
  const sourceType = parsed.type === 'local' ? 'local' : parsed.type;

  if (parsed.type === 'collection') {
    return {
      source: `col:${parsed.collectionOwner}/${parsed.collectionHandle}`,
      sourceType,
      sourceUrl: parsed.url,
    };
  }

  if (parsed.owner && parsed.repo) {
    return {
      source: `${parsed.owner}/${parsed.repo}`,
      sourceType,
      sourceUrl: parsed.url,
      owner: parsed.owner,
      repo: parsed.repo,
      skillPath: parsed.subpath,
    };
  }

  return {
    source: parsed.localPath || parsed.url || input,
    sourceType,
    sourceUrl: parsed.url,
    skillPath: parsed.subpath,
  };
}

async function runInstallJson(skillName: string, options: InstallOptions): Promise<void> {
  if (!skillName) {
    printJsonError('MISSING_SKILL', 'Missing skill identifier');
  }

  const spinner = createSpinner(true);
  const { skills: discoveredSkills, parsed: sourceParsed, tempDir } = await resolveSkills(skillName, spinner, options);

  const cleanup = async () => {
    if (tempDir) await cleanupTempDir(tempDir).catch(() => {});
  };

  try {
    if (discoveredSkills.length === 0) {
      printJson({
        ok: true,
        action: options.list ? 'preview' : 'install',
        source: {
          input: skillName,
          type: sourceParsed.type,
          owner: sourceParsed.owner || null,
          repo: sourceParsed.repo || null,
          ref: sourceParsed.ref || null,
          subpath: sourceParsed.subpath || null,
          skillFilter: sourceParsed.skillFilter || null,
          collectionOwner: sourceParsed.collectionOwner || null,
          collectionHandle: sourceParsed.collectionHandle || null,
          url: sourceParsed.url || null,
        },
        skills: [],
      });
      return;
    }

    if (options.list) {
      printJson({
        ok: true,
        action: 'preview',
        source: {
          input: skillName,
          type: sourceParsed.type,
          owner: sourceParsed.owner || null,
          repo: sourceParsed.repo || null,
          ref: sourceParsed.ref || null,
          subpath: sourceParsed.subpath || null,
          skillFilter: sourceParsed.skillFilter || null,
          collectionOwner: sourceParsed.collectionOwner || null,
          collectionHandle: sourceParsed.collectionHandle || null,
          url: sourceParsed.url || null,
        },
        count: discoveredSkills.length,
        skills: discoveredSkills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          path: skill.path || null,
          frontmatter: skill.frontmatter,
        })),
      });
      return;
    }

    let skillsToInstall: DiscoveredSkill[];
    if (discoveredSkills.length === 1 || options.yes || options.all || sourceParsed.type === 'collection') {
      skillsToInstall = discoveredSkills;
    } else {
      printJson({
        ok: false,
        error: {
          code: 'MULTIPLE_SKILLS_REQUIRE_SELECTION',
          message: 'Multiple skills discovered. Use --all, --yes, or a specific source like owner/repo@skill-name',
        },
      });
      process.exitCode = 1;
      return;
    }

    const { targetAgents: specifiedAgents, invalidAgents } = resolveValidatedAgents(options.agent);
    if (invalidAgents.length > 0) {
      printJson({
        ok: false,
        error: {
          code: 'INVALID_AGENTS',
          message: 'Invalid agents provided',
          details: { invalidAgents },
        },
      });
      process.exitCode = 1;
      return;
    }

    let targetAgents: AgentType[];
    const validAgents = Object.keys(agents) as AgentType[];

    if (specifiedAgents.length > 0) {
      targetAgents = specifiedAgents;
    } else {
      const installedAgents = await detectInstalledAgents();
      const preferredAgents = (await getLastSelectedAgents()) || (await getPreferredAgents());

      if (installedAgents.length === 0) {
        targetAgents = validAgents.slice(0, 5) as AgentType[];
      } else if (installedAgents.length === 1) {
        targetAgents = installedAgents;
      } else {
        const popularInstalledAgents = POPULAR_AGENTS.filter((agent) => installedAgents.includes(agent));
        const effectiveAgents = preferredAgents
          ? preferredAgents.filter((agent) => installedAgents.includes(agent))
          : [];

        targetAgents = effectiveAgents.length > 0
          ? effectiveAgents
          : (popularInstalledAgents.length > 0 ? popularInstalledAgents : installedAgents);
      }
    }

    if (targetAgents.length === 0) {
      printJson({
        ok: false,
        error: {
          code: 'NO_TARGET_AGENTS',
          message: 'No target agents available for installation',
        },
      });
      process.exitCode = 1;
      return;
    }

    const installGlobally = options.global ?? false;
    const installMode: InstallMode = options.copy ? 'copy' : 'symlink';

    const allResults: Array<{ skill: string; agent: AgentType; success: boolean; error?: string; isDependency?: boolean }> = [];
    const installedNames = new Set<string>();
    const invalidDependencies: Array<{ skill: string; dependency: string }> = [];
    const invalidDependencyKeys = new Set<string>();

    const normalizeDepKey = (value: string) => value.replace(/^gh:/, '').toLowerCase();
    const toApiSlug = (value: string) => value.replace(/^gh:/, '');

    async function installOneSkill(skill: DiscoveredSkill, isDependency: boolean): Promise<void> {
      for (const agent of targetAgents) {
        let result: { success: boolean; error?: string };

        if (skill.path) {
          result = await installSkillFromDir(skill.name, skill.path, agent, {
            global: installGlobally,
            mode: installMode,
          });
        } else {
          result = await installSkill(skill.name, skill.rawContent, agent, {
            global: installGlobally,
            mode: installMode,
          });
        }

        allResults.push({
          skill: skill.name,
          agent,
          success: result.success,
          error: result.error,
          isDependency,
        });
      }
    }

    async function installDependencies(skill: DiscoveredSkill): Promise<void> {
      const dependencies = extractDependencies(skill.rawContent);
      if (dependencies.length === 0) return;

      for (const dep of dependencies) {
        const normalizedDependency = dep.trim();
        if (!isValidDependencySpec(normalizedDependency)) {
          const invalidKey = `${skill.name}\u0000${normalizedDependency}`;
          if (!invalidDependencyKeys.has(invalidKey)) {
            invalidDependencyKeys.add(invalidKey);
            invalidDependencies.push({ skill: skill.name, dependency: normalizedDependency });
          }
          continue;
        }

        const parsedDependency = parseDependency(normalizedDependency);
        const dependencySlug = dependencyToSlug(parsedDependency);
        const dependencyKey = normalizeDepKey(dependencySlug);

        if (installedNames.has(dependencyKey)) continue;
        installedNames.add(dependencyKey);

        try {
          const apiSlug = toApiSlug(dependencySlug);
          const depSkill = await api.getSkill(apiSlug);
          const depContent = await api.getSkillRaw(apiSlug);
          const parsedContent = parseSkillMd(depContent);
          const resolvedName = depSkill.name
            || parsedContent.frontmatter.name
            || parsedDependency.skill || parsedDependency.name || normalizedDependency;
          const resolvedDescription = depSkill.description
            || parsedContent.frontmatter.description || '';

          const discoveredDependency: DiscoveredSkill = {
            name: resolvedName,
            description: resolvedDescription,
            path: '',
            rawContent: depContent,
            frontmatter: parsedContent.frontmatter,
          };

          installedNames.add(normalizeDepKey(resolvedName));

          await installDependencies(discoveredDependency);
          await installOneSkill(discoveredDependency, true);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to resolve dependency';
          for (const agent of targetAgents) {
            allResults.push({
              skill: `${normalizedDependency} (dependency of ${skill.name})`,
              agent,
              success: false,
              error: errorMessage,
              isDependency: true,
            });
          }
        }
      }
    }

    for (const skill of skillsToInstall) {
      const key = normalizeDepKey(skill.name);
      if (installedNames.has(key)) continue;
      installedNames.add(key);

      await installDependencies(skill);
      await installOneSkill(skill, false);
    }

    const successful = allResults.filter((result) => result.success);
    const failed = allResults.filter((result) => !result.success);

    if (successful.length > 0) {
      await saveLastSelectedAgents(targetAgents);

      const installedSkillNames = new Set(successful.map((result) => result.skill));
      for (const installedSkillName of installedSkillNames) {
        const discoveredSkill = skillsToInstall.find((skill) => skill.name === installedSkillName);

        const effectiveSource = discoveredSkill?.sourceHint;
        const source = effectiveSource?.source || toLockSource(sourceParsed, skillName);
        const sourceType = effectiveSource?.sourceType || (sourceParsed.type === 'local' ? 'local' : sourceParsed.type);
        const sourceUrl = effectiveSource?.sourceUrl || sourceParsed.url;

        let skillPath = '';
        if (effectiveSource?.skillPath) {
          skillPath = effectiveSource.skillPath;
        } else if (discoveredSkill?.path && tempDir) {
          const relative = discoveredSkill.path.replace(tempDir, '').replace(/^\//, '');
          if (relative) skillPath = relative;
        } else if (sourceParsed.subpath) {
          skillPath = sourceParsed.subpath;
        }

        let skillFolderHash = '';
        const hashOwner = effectiveSource?.owner || sourceParsed.owner;
        const hashRepo = effectiveSource?.repo || sourceParsed.repo;
        if (sourceType === 'github' && hashOwner && hashRepo) {
          try {
            skillFolderHash = await fetchSkillFolderHash(
              `${hashOwner}/${hashRepo}`,
              skillPath
            );
          } catch {
            // Non-critical
          }
        }

        await addSkillToLock(installedSkillName, {
          source,
          sourceType,
          sourceUrl,
          skillPath: skillPath || undefined,
          skillFolderHash,
        }).catch(() => {
          // Non-critical
        });
      }
    }

    const mainSkills = successful.filter((result) => !result.isDependency);
    const dependencySkills = successful.filter((result) => result.isDependency);

    printJson({
      ok: failed.length === 0,
      action: 'install',
      source: {
        input: skillName,
        type: sourceParsed.type,
        owner: sourceParsed.owner || null,
        repo: sourceParsed.repo || null,
        ref: sourceParsed.ref || null,
        subpath: sourceParsed.subpath || null,
        skillFilter: sourceParsed.skillFilter || null,
        collectionOwner: sourceParsed.collectionOwner || null,
        collectionHandle: sourceParsed.collectionHandle || null,
        url: sourceParsed.url || null,
      },
      scope: installGlobally ? 'global' : 'project',
      mode: installMode,
      selectedAgents: targetAgents.map(toAgentOutput),
      requestedSkills: skillsToInstall.map((skill) => ({
        name: skill.name,
        description: skill.description,
      })),
      summary: {
        operations: allResults.length,
        successful: successful.length,
        failed: failed.length,
        skills: new Set(mainSkills.map((result) => result.skill)).size,
        dependencies: new Set(dependencySkills.map((result) => result.skill)).size,
        skippedInvalidDependencies: invalidDependencies.length,
      },
      skippedDependencies: invalidDependencies.map((item) => ({
        skill: item.skill,
        dependency: item.dependency,
      })),
      results: allResults.map((result) => ({
        skill: result.skill,
        agent: toAgentOutput(result.agent),
        scope: installGlobally ? 'global' : 'project',
        success: result.success,
        error: result.error || null,
        isDependency: Boolean(result.isDependency),
      })),
    });
  } finally {
    await cleanup();
  }
}

async function runInstall(args: string[]): Promise<void> {
  const { skillName, options } = parseInstallOptions(args);
  if (options.json) {
    await runInstallJson(skillName, options);
    return;
  }

  const plainMode = Boolean(options.yes) || !process.stdout.isTTY;

  if (!skillName) {
    console.log(`${RED}Error: Missing skill identifier${RESET}`);
    console.log(`Usage: askill add <source>`);
    console.log(`\nFormats supported:`);
    console.log(`  askill add @author/skill-name                 ${DIM}# published skill${RESET}`);
    console.log(`  askill add owner/repo                         ${DIM}# all skills from repo${RESET}`);
    console.log(`  askill add owner/repo@skill-name              ${DIM}# specific skill${RESET}`);
    console.log(`  askill add owner/repo/path/to/skill           ${DIM}# skill by path${RESET}`);
    console.log(`  askill add col:owner/collection-handle        ${DIM}# shared collection${RESET}`);
    console.log(`  askill add https://github.com/owner/repo      ${DIM}# full GitHub URL${RESET}`);
    console.log(`  askill add https://askill.sh/c/owner/handle   ${DIM}# shared collection URL${RESET}`);
    console.log(`  askill add ./local/path                       ${DIM}# local directory${RESET}`);
    process.exit(1);
  }

  if (!plainMode) {
    console.log();
    p.intro(pc.bgCyan(pc.black(' askill install ')));
  }

  const spinner = createSpinner(plainMode);

  // Step 1: Resolve skills (clone or API)
  const { skills: discoveredSkills, parsed: sourceParsed, tempDir } = await resolveSkills(skillName, spinner, options);

  // Ensure tempDir is always cleaned up, even on cancel/error/process.exit
  const cleanup = async () => {
    if (tempDir) await cleanupTempDir(tempDir).catch(() => {});
  };

  try {

  if (discoveredSkills.length === 0) {
    p.log.warning('No skills found');
    if (plainMode) {
      console.log(`Browse skills at ${pc.cyan('https://askill.sh')}`);
    } else {
      p.outro(`Browse skills at ${pc.cyan('https://askill.sh')}`);
    }
    return;
  }

  // --list mode: just show discovered skills and exit
  if (options.list) {
    console.log();
    p.log.info(`Found ${discoveredSkills.length} skill(s) in ${pc.cyan(skillName)}:`);
    console.log();
    for (const skill of discoveredSkills) {
      console.log(`  ${pc.cyan(skill.name)}`);
      if (skill.description) {
        console.log(`  ${pc.dim(skill.description.slice(0, 80))}${skill.description.length > 80 ? '...' : ''}`);
      }
      if (skill.path) {
        console.log(`  ${pc.dim('path:')} ${skill.path.replace(tempDir || '', '').replace(/^\//, '')}`);
      }
      console.log();
    }
    if (plainMode) {
      console.log(`Install with: ${pc.cyan(sourceParsed.type === 'collection' ? `askill add ${skillName} -y` : `askill add ${skillName} --all`)}`);
    } else {
      p.outro(`Install with: ${pc.cyan(sourceParsed.type === 'collection' ? `askill add ${skillName} -y` : `askill add ${skillName} --all`)}`);
    }
    return;
  }

  // Step 2: Let user select skills (if multiple)
  let skillsToInstall: DiscoveredSkill[];

  if (discoveredSkills.length === 1 || options.yes || options.all || sourceParsed.type === 'collection') {
    skillsToInstall = discoveredSkills;
    if (discoveredSkills.length === 1) {
      p.log.info(`Installing: ${pc.cyan(discoveredSkills[0].name)}`);
    } else {
      p.log.info(`Installing ${discoveredSkills.length} skill(s)`);
    }
  } else {
    const selected = await p.multiselect({
      message: 'Select skills to install',
      options: discoveredSkills.map((s) => ({
        value: s,
        label: s.name,
        hint: s.description.slice(0, 60) + (s.description.length > 60 ? '...' : ''),
      })),
    });

    if (p.isCancel(selected)) {
      p.cancel('Installation cancelled');
      return;
    }

    skillsToInstall = selected as DiscoveredSkill[];
  }

  // Detect agents
  let targetAgents: AgentType[];
  const validAgents = Object.keys(agents) as AgentType[];

  if (options.agent && options.agent.length > 0) {
    const invalidAgents = options.agent.filter((a) => !validAgents.includes(a as AgentType));
    if (invalidAgents.length > 0) {
      p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
      p.log.info(`Valid agents: ${validAgents.slice(0, 10).join(', ')}...`);
      return;
    }
    targetAgents = options.agent as AgentType[];
  } else {
    let installedAgents: AgentType[];
    if (plainMode) {
      spinner.start('Detecting installed agents...');
      installedAgents = await detectInstalledAgents();
      spinner.stop(`Found ${installedAgents.length} agent(s)`);
    } else {
      installedAgents = await detectInstalledAgents();
      p.log.info(`Found ${installedAgents.length} agent(s)`);
    }
    const preferredAgents = (await getLastSelectedAgents()) || (await getPreferredAgents());

    if (installedAgents.length === 0) {
      if (options.yes) {
        targetAgents = validAgents.slice(0, 5) as AgentType[]; // Default to first 5 agents
        p.log.info('Installing to default agents');
      } else {
        const selected = await p.multiselect({
          message: 'Select agents to install to',
          options: validAgents.slice(0, 15).map((a) => ({
            value: a,
            label: agents[a].displayName,
          })),
        });

        if (p.isCancel(selected)) {
          p.cancel('Installation cancelled');
          return;
        }

        targetAgents = selected as AgentType[];
      }
    } else if (installedAgents.length === 1) {
      targetAgents = installedAgents;
      p.log.info(`Installing to: ${targetAgents.map((a) => pc.cyan(agents[a].displayName)).join(', ')}`);
    } else if (options.yes) {
      // Non-interactive mode: use preferred agents if available,
      // otherwise use hot agents intersected with installed agents,
      // and finally fall back to all installed agents.
      const popularInstalledAgents = POPULAR_AGENTS.filter((a) => installedAgents.includes(a));
      const effectiveAgents = preferredAgents
        ? preferredAgents.filter((a) => installedAgents.includes(a))
        : [];
      targetAgents = effectiveAgents.length > 0
        ? effectiveAgents
        : (popularInstalledAgents.length > 0 ? popularInstalledAgents : installedAgents);
      p.log.info(`Installing to: ${targetAgents.map((a) => pc.cyan(agents[a].displayName)).join(', ')}`);
    } else {
      // Use preferred agents as initial selection if available,
      // filtered to only include currently installed agents
      const initialSelection = preferredAgents
        ? preferredAgents.filter((a) => installedAgents.includes(a))
        : POPULAR_AGENTS.filter((a) => installedAgents.includes(a));

      const selected = await p.multiselect({
        message: 'Select agents to install to',
        options: installedAgents.map((a) => ({
          value: a,
          label: agents[a].displayName,
        })),
        initialValues: initialSelection,
      });

      if (p.isCancel(selected)) {
        p.cancel('Installation cancelled');
        return;
      }

      targetAgents = selected as AgentType[];
    }
  }

  // Select scope (global vs project)
  let installGlobally = options.global ?? false;

  if (options.global === undefined && !options.yes) {
    const scope = await p.select({
      message: 'Installation scope',
      options: [
        { value: false, label: 'Project', hint: 'Install in current directory' },
        { value: true, label: 'Global', hint: 'Install in home directory (all projects)' },
      ],
    });

    if (p.isCancel(scope)) {
      p.cancel('Installation cancelled');
      return;
    }

    installGlobally = scope as boolean;
  }

  const installMode: InstallMode = options.copy ? 'copy' : 'symlink';

  // Confirm installation
  if (!options.yes) {
    const skillNames = skillsToInstall.map((s) => s.name).join(', ');
    const confirmed = await p.confirm({
      message: `Install ${pc.cyan(skillNames)} to ${targetAgents.length} agent(s)?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Installation cancelled');
      return;
    }
  }

  // Install each skill
  spinner.start('Installing...');

  const allResults: Array<{ skill: string; agent: string; success: boolean; error?: string; isDependency?: boolean }> = [];
  const installedNames = new Set<string>(); // Track installed skills to avoid duplicates (normalized keys)
  const invalidDependencies: Array<{ skill: string; dependency: string }> = [];
  const invalidDependencyKeys = new Set<string>();

  // Normalize a dependency key for dedup: strip gh: prefix, lowercase
  const normalizeDepKey = (s: string) => s.replace(/^gh:/, '').toLowerCase();

  // Strip gh: prefix for API calls (API expects owner/repo@name, not gh:owner/repo@name)
  const toApiSlug = (s: string) => s.replace(/^gh:/, '');

  // Helper: install a single DiscoveredSkill to all target agents
  async function installOneSkill(
    skill: DiscoveredSkill,
    isDependency: boolean,
  ): Promise<void> {
    spinner.message(`Installing ${skill.name}...`);
    for (const agent of targetAgents) {
      let result: { success: boolean; error?: string };

      if (skill.path) {
        // Clone-based: copy entire skill directory (includes scripts/, assets/, etc.)
        result = await installSkillFromDir(skill.name, skill.path, agent, {
          global: installGlobally,
          mode: installMode,
        });
      } else {
        // API fallback: only SKILL.md content available
        result = await installSkill(skill.name, skill.rawContent, agent, {
          global: installGlobally,
          mode: installMode,
        });
      }

      allResults.push({ skill: skill.name, agent, ...result, isDependency });
    }
  }

  // Helper: resolve and install dependencies for a skill recursively
  async function installDependencies(skill: DiscoveredSkill): Promise<void> {
    const dependencies = extractDependencies(skill.rawContent);
    if (dependencies.length === 0) return;

    spinner.message(`Resolving dependencies for ${skill.name}...`);

    for (const dep of dependencies) {
      const normalizedDependency = dep.trim();
      if (!isValidDependencySpec(normalizedDependency)) {
        const invalidKey = `${skill.name}\u0000${normalizedDependency}`;
        if (!invalidDependencyKeys.has(invalidKey)) {
          invalidDependencyKeys.add(invalidKey);
          invalidDependencies.push({ skill: skill.name, dependency: normalizedDependency });
        }
        continue;
      }

      const parsed = parseDependency(normalizedDependency);
      const depSlug = dependencyToSlug(parsed);
      const depKey = normalizeDepKey(depSlug);

      if (installedNames.has(depKey)) continue;
      installedNames.add(depKey);  // Mark visited immediately to prevent cycles

      try {
        // Strip gh: prefix for API calls
        const apiSlug = toApiSlug(depSlug);
        const depSkill = await api.getSkill(apiSlug);
        const depContent = await api.getSkillRaw(apiSlug);

        // Parse the actual frontmatter for consistent metadata
        const parsedContent = parseSkillMd(depContent);
        const name = depSkill.name
          || parsedContent.frontmatter.name
          || parsed.skill || parsed.name || normalizedDependency;
        const description = depSkill.description
          || parsedContent.frontmatter.description || '';

        const depDiscovered: DiscoveredSkill = {
          name,
          description,
          path: '',  // API-only, no local path
          rawContent: depContent,
          frontmatter: parsedContent.frontmatter,
        };

        // Also register by resolved name to avoid duplicates
        installedNames.add(normalizeDepKey(name));

        // Recursively install sub-dependencies
        await installDependencies(depDiscovered);

        // Install the dependency itself
        await installOneSkill(depDiscovered, true);
      } catch (error) {
        // Log dependency resolution failure with error details
        const errorMsg = error instanceof Error ? error.message : 'Failed to resolve dependency';
        for (const agent of targetAgents) {
          allResults.push({
            skill: `${normalizedDependency} (dependency of ${skill.name})`,
            agent,
            success: false,
            error: errorMsg,
            isDependency: true,
          });
        }
      }
    }
  }

  // Install all requested skills with their dependencies
  for (const skill of skillsToInstall) {
    const key = normalizeDepKey(skill.name);
    if (installedNames.has(key)) continue;
    installedNames.add(key);

    // Install dependencies first
    await installDependencies(skill);

    // Install the skill itself
    await installOneSkill(skill, false);
  }

  spinner.stop('Installation complete');

  // Show results
  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);

  if (successful.length > 0) {
    // Save selected agents as preferred for next time
    await saveLastSelectedAgents(targetAgents);

    // Write lock entries for all successfully installed skills
    const installedSkillNames = new Set(successful.map((r) => r.skill));
    for (const skillName of installedSkillNames) {
      // Find the DiscoveredSkill for this name (from main install or dependency)
      const discoveredSkill = skillsToInstall.find((s) => s.name === skillName);

      // Determine source info from parsed source
      const effectiveSource = discoveredSkill?.sourceHint;
      const source = effectiveSource?.source || toLockSource(sourceParsed, skillName);
      const sourceType = effectiveSource?.sourceType || (sourceParsed.type === 'local' ? 'local' : sourceParsed.type);
      const sourceUrl = effectiveSource?.sourceUrl || sourceParsed.url;

      // Determine skillPath: subpath within the repo
      let skillPath = '';
      if (effectiveSource?.skillPath) {
        skillPath = effectiveSource.skillPath;
      } else if (discoveredSkill?.path && tempDir) {
        // Relative path within cloned repo
        const relative = discoveredSkill.path.replace(tempDir, '').replace(/^\//, '');
        if (relative) skillPath = relative;
      } else if (sourceParsed.subpath) {
        skillPath = sourceParsed.subpath;
      } else if (sourceParsed.skillFilter) {
        skillPath = '';  // @skill filter, path not meaningful
      }

      // Fetch folder hash for GitHub sources (non-blocking, don't fail install)
      let skillFolderHash = '';
      const hashOwner = effectiveSource?.owner || sourceParsed.owner;
      const hashRepo = effectiveSource?.repo || sourceParsed.repo;
      if (sourceType === 'github' && hashOwner && hashRepo) {
        try {
          skillFolderHash = await fetchSkillFolderHash(
            `${hashOwner}/${hashRepo}`,
            skillPath
          );
        } catch {
          // Non-critical: hash will be empty, update check won't work for this skill
        }
      }

      await addSkillToLock(skillName, {
        source,
        sourceType,
        sourceUrl,
        skillPath: skillPath || undefined,
        skillFolderHash,
      }).catch(() => {
        // Non-critical: lock file write failure shouldn't fail install
      });
    }

    console.log();
    const mainSkills = successful.filter((r) => !r.isDependency);
    const depSkills = successful.filter((r) => r.isDependency);
    const skillCount = new Set(mainSkills.map((r) => r.skill)).size;
    const depCount = new Set(depSkills.map((r) => r.skill)).size;
    const agentCount = new Set(successful.map((r) => r.agent)).size;
    
    let message = `Installed ${skillCount} skill(s)`;
    if (depCount > 0) {
      message += ` + ${depCount} dependenc${depCount === 1 ? 'y' : 'ies'}`;
    }
    message += ` to ${agentCount} agent(s)`;
    p.log.success(pc.green(message));

    // Group by skill
    const bySkill = successful.reduce((acc, r) => {
      if (!acc[r.skill]) acc[r.skill] = { agents: [], isDependency: r.isDependency };
      acc[r.skill].agents.push(r.agent);
      return acc;
    }, {} as Record<string, { agents: string[]; isDependency?: boolean }>);

    for (const [skill, info] of Object.entries(bySkill)) {
      const prefix = info.isDependency ? pc.dim('  (dep) ') : '  ';
      console.log(`${prefix}${pc.green('✓')} ${skill}`);
      for (const agent of info.agents) {
        const agentName = agents[agent as AgentType]?.displayName || agent;
        console.log(`    ${pc.dim('→')} ${agentName}`);
      }
    }
  }

  if (failed.length > 0) {
    console.log();
    p.log.error(pc.red(`Failed for ${failed.length} installation(s)`));
    for (const r of failed) {
      const agentName = agents[r.agent as AgentType]?.displayName || r.agent;
      console.log(`  ${pc.red('✗')} ${r.skill} → ${agentName}: ${pc.dim(r.error || 'Unknown error')}`);
    }
  }

  if (invalidDependencies.length > 0) {
    console.log();
    p.log.warning(`Skipped ${invalidDependencies.length} invalid dependenc${invalidDependencies.length === 1 ? 'y declaration' : 'y declarations'}`);
    for (const item of invalidDependencies.slice(0, 5)) {
      console.log(`  ${pc.yellow('!')} ${item.dependency} ${pc.dim(`(declared by ${item.skill})`)}`);
    }
    if (invalidDependencies.length > 5) {
      console.log(`  ${pc.dim(`...and ${invalidDependencies.length - 5} more`)}`);
    }
  }

  console.log();
  if (plainMode) {
    console.log(pc.green('Done!'));
  } else {
    p.outro(pc.green('Done!'));
  }

  } finally {
    // Always clean up temp directory from git clone
    await cleanup();
  }
}

// ============================================
// Search Command
// ============================================

const SEARCH_DESCRIPTION_MAX_LENGTH = 500;

interface SearchOptions {
  fullDesc: boolean;
  query: string;
  json: boolean;
}

interface AIScoreDimension {
  key: string;
  label: string;
  score: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function formatScore(score: number | null): string {
  if (score === null) {
    return pc.dim('N/A');
  }
  return pc.green(Number.isInteger(score) ? String(score) : score.toFixed(1));
}

function toScoreLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getScoreMeta(skill: Skill): Record<string, unknown> | null {
  const withScoreMeta = skill as Skill & { llmScoreMeta?: unknown };
  return parseJsonObject(withScoreMeta.llmScoreMeta);
}

function getTotalAIScore(skill: Skill): number | null {
  const aiScore = toNumber((skill as Skill & { aiScore?: unknown }).aiScore);
  if (aiScore !== null) {
    return aiScore;
  }

  const directScore = toNumber((skill as Skill & { llmScore?: unknown }).llmScore);
  if (directScore !== null) {
    return directScore;
  }

  const meta = getScoreMeta(skill);
  if (!meta) {
    return null;
  }

  return toNumber(meta.score) ?? toNumber(meta.score_raw) ?? toNumber(meta.final_rank);
}

function getAIScoreDimensions(skill: Skill): AIScoreDimension[] {
  const directBreakdown = parseJsonObject((skill as Skill & { aiBreakdown?: unknown }).aiBreakdown);
  if (directBreakdown) {
    const parsedDirect = Object.entries(directBreakdown)
      .map(([key, value]) => {
        const score = toNumber(value);
        if (score === null) {
          return null;
        }
        return {
          key,
          label: toScoreLabel(key),
          score,
        };
      })
      .filter((item): item is AIScoreDimension => item !== null);

    if (parsedDirect.length > 0) {
      const preferredOrder = ['completeness', 'actionability', 'reusability', 'safety', 'clarity', 'internal_only'];
      return parsedDirect.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.key);
        const indexB = preferredOrder.indexOf(b.key);
        const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return a.label.localeCompare(b.label);
      });
    }
  }

  const meta = getScoreMeta(skill);
  if (!meta) {
    return [];
  }

  const dimensions = parseJsonObject(meta.dimensions);
  if (!dimensions) {
    return [];
  }

  const preferredOrder = ['completeness', 'actionability', 'reusability', 'safety', 'clarity', 'internal_only'];

  const parsed = Object.entries(dimensions)
    .map(([key, value]) => {
      const nested = parseJsonObject(value);
      const score = nested ? toNumber(nested.score) : toNumber(value);
      if (score === null) {
        return null;
      }
      return {
        key,
        label: toScoreLabel(key),
        score,
      };
    })
    .filter((item): item is AIScoreDimension => item !== null);

  return parsed.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a.key);
    const indexB = preferredOrder.indexOf(b.key);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.label.localeCompare(b.label);
  });
}

function normalizeInfoTarget(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withoutGh = trimmed.replace(/^gh:/i, '');

  const askillSkillUrl = withoutGh.match(/^https?:\/\/askill\.sh\/skills\/(.+)$/i);
  if (askillSkillUrl && askillSkillUrl[1]) {
    return askillSkillUrl[1];
  }

  return withoutGh;
}

function parseSearchOptions(args: string[]): SearchOptions {
  const fullDesc = args.includes('--full-desc');
  const json = args.includes('--json');
  const query = args.filter((arg) => arg !== '--full-desc' && arg !== '--json').join(' ');

  return {
    fullDesc,
    query,
    json,
  };
}

async function runSearch(args: string[]): Promise<void> {
  const { fullDesc, query, json } = parseSearchOptions(args);

  if (!json) {
    console.log();
    p.intro(pc.bgCyan(pc.black(' askill search ')));
  }

  const spinner = createSpinner(json);
  spinner.start(query ? `Searching for "${query}"...` : 'Loading skills...');

  try {
    const response = query
      ? await api.search(query, 20)
      : await api.listSkills({ limit: 20 });

    const skills = response.data || [];
    spinner.stop(`Found ${skills.length} result(s)`);

    const normalized = skills.map((skill) => {
      const displayName = skill.name || 'unknown';
      const owner = skill.owner || 'unknown';
      const installSource = skill.owner && skill.repo
        ? `gh:${skill.owner}/${skill.repo}@${displayName}`
        : `gh:${displayName}`;

      return {
        id: skill.id,
        name: displayName,
        description: skill.description || '',
        owner,
        repo: skill.repo || null,
        tags: skill.tags || [],
        stars: skill.stars ?? null,
        aiScore: getTotalAIScore(skill),
        aiBreakdown: getAIScoreDimensions(skill).map((dimension) => ({
          key: dimension.key,
          label: dimension.label,
          score: dimension.score,
        })),
        updatedAt: skill.updatedAt || null,
        installSource,
        url: skill.id ? `${REGISTRY_URL}/skills/${skill.id}` : null,
      };
    });

    if (json) {
      printJson({
        ok: true,
        query,
        count: normalized.length,
        skills: normalized,
      });
      return;
    }

    if (skills.length === 0) {
      p.log.info('No skills found');
      p.outro(`Browse all skills at ${pc.cyan('https://askill.sh')}`);
      return;
    }

    console.log();
    for (const skill of skills) {
      const displayName = skill.name || 'unknown';
      const owner = skill.owner || 'unknown';
      const description = skill.description || '';
      const aiScore = getTotalAIScore(skill);

      console.log(`  ${pc.cyan(displayName)} ${pc.dim(`by ${owner}`)}`);
      console.log(`  ${pc.dim('AI score:')} ${formatScore(aiScore)}`);
      if (description) {
        if (fullDesc) {
          console.log(`  ${pc.dim(description)}`);
        } else {
          console.log(`  ${pc.dim(description.slice(0, SEARCH_DESCRIPTION_MAX_LENGTH))}${description.length > SEARCH_DESCRIPTION_MAX_LENGTH ? '...' : ''}`);
        }
      }
      // Build install command - use gh: prefix
      const installCmd = skill.owner && skill.repo
        ? `gh:${skill.owner}/${skill.repo}@${displayName}`
        : `gh:${displayName}`;
      console.log(`  ${pc.dim('askill add')} ${installCmd}`);
      // Show web link for sharing
      if (skill.id) {
        console.log(`  ${pc.dim(REGISTRY_URL + '/skills/' + skill.id)}`);
      }
      console.log();
    }

    p.outro(`Browse more at ${pc.cyan('https://askill.sh')}`);
  } catch (error) {
    spinner.stop('Search failed');
    if (json) {
      printJsonError('SEARCH_FAILED', error instanceof Error ? error.message : 'Search failed');
    }

    if (error instanceof Error) {
      console.log(pc.red(error.message));
    }
    process.exit(1);
  }
}

// ============================================
// List Command
// ============================================

interface ListOptions {
  global: boolean;
  project: boolean;
  agents: string[];
  json: boolean;
}

function parseListOptions(args: string[]): ListOptions {
  const options: ListOptions = {
    global: false,
    project: false,
    agents: [],
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '-g' || arg === '--global') {
      options.global = true;
      continue;
    }

    if (arg === '-p' || arg === '--project') {
      options.project = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '-a' || arg === '--agent') {
      const parsed = parseAgentOptionValues(args, index + 1);
      options.agents = parsed.values;
      index = parsed.nextIndex;
      continue;
    }
  }

  return options;
}

async function runList(args: string[]): Promise<void> {
  const options = parseListOptions(args);

  if (options.global && options.project) {
    if (options.json) {
      printJsonError('INVALID_OPTIONS', 'Cannot use --global and --project together');
    }
    console.log(`${RED}Error: Cannot use --global and --project together${RESET}`);
    process.exit(1);
  }

  const { targetAgents, invalidAgents } = resolveValidatedAgents(options.agents);
  if (invalidAgents.length > 0) {
    if (options.json) {
      printJsonError('INVALID_AGENTS', 'Invalid agents provided', { invalidAgents });
    }
    p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
    return;
  }

  const scopeFilter = options.global ? true : options.project ? false : undefined;

  if (!options.json) {
    console.log();
    p.intro(pc.bgCyan(pc.black(' askill list ')));
  }

  const spinner = createSpinner(options.json);
  spinner.start('Loading installed skills...');

  const skills = await listInstalledSkills({ global: scopeFilter });

  const filteredSkills = targetAgents.length > 0
    ? skills
        .map((skill) => ({
          ...skill,
          agents: skill.agents.filter((agent) => targetAgents.includes(agent)),
        }))
        .filter((skill) => skill.agents.length > 0)
    : skills;

  spinner.stop(`Found ${filteredSkills.length} skill(s)`);

  if (options.json) {
    const payload = {
      ok: true,
      filters: {
        scope: scopeFilter === undefined ? 'all' : scopeFilter ? 'global' : 'project',
        agents: targetAgents.map(toAgentOutput),
      },
      count: filteredSkills.length,
      summary: {
        global: filteredSkills.filter((skill) => skill.scope === 'global').length,
        project: filteredSkills.filter((skill) => skill.scope === 'project').length,
      },
      skills: filteredSkills.map((skill) => ({
        name: skill.name,
        scope: skill.scope,
        path: skill.path,
        agents: skill.agents.map(toAgentOutput),
      })),
    };

    printJson(payload);
    return;
  }

  if (filteredSkills.length === 0) {
    p.log.info('No skills installed');
    p.outro(`Install skills with ${pc.cyan('askill add <skill>')}`);
    return;
  }

  console.log();
  for (const skill of filteredSkills) {
    const scope = skill.scope === 'global' ? pc.yellow('[global]') : pc.dim('[project]');
    const agentList = skill.agents.map((a) => agents[a]?.displayName || a).join(', ');

    console.log(`  ${pc.cyan(skill.name)} ${scope}`);
    console.log(`  ${pc.dim('Agents:')} ${agentList || pc.dim('none')}`);
    console.log(`  ${pc.dim(skill.path)}`);
    console.log();
  }

  p.outro('');
}

// ============================================
// Remove Command
// ============================================

interface RemoveOptions {
  global: boolean;
  agents: string[];
  json: boolean;
  skillName: string;
}

function parseRemoveOptions(args: string[]): RemoveOptions {
  const options: RemoveOptions = {
    global: false,
    agents: [],
    json: false,
    skillName: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '-g' || arg === '--global') {
      options.global = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '-a' || arg === '--agent') {
      const parsed = parseAgentOptionValues(args, index + 1);
      options.agents = parsed.values;
      index = parsed.nextIndex;
      continue;
    }

    if (!arg.startsWith('-') && !options.skillName) {
      options.skillName = arg;
    }
  }

  return options;
}

async function runRemove(args: string[]): Promise<void> {
  const options = parseRemoveOptions(args);
  const { skillName } = options;
  const isGlobal = options.global;
  const isPathLikeTarget = isPathLikeRemoveTarget(skillName);

  if (!skillName) {
    if (options.json) {
      printJsonError('MISSING_SKILL', 'Missing skill name');
    }
    console.log(`${RED}Error: Missing skill name${RESET}`);
    console.log(`Usage: askill remove <skill-or-path>`);
    process.exit(1);
  }

  const { targetAgents: scopedAgents, invalidAgents } = resolveValidatedAgents(options.agents);
  if (invalidAgents.length > 0) {
    if (options.json) {
      printJsonError('INVALID_AGENTS', 'Invalid agents provided', { invalidAgents });
    }
    p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
    return;
  }

  if (!options.json) {
    console.log();
    p.intro(pc.bgCyan(pc.black(' askill remove ')));
  }

  const spinner = createSpinner(options.json);
  spinner.start('Loading installed skills...');

  const installedSkillsScope = isGlobal ? true : isPathLikeTarget ? undefined : false;
  const installedSkills = await listInstalledSkills({ global: installedSkillsScope });
  const resolvedTarget = resolveRemoveTarget(skillName, installedSkills, process.cwd());

  let globalScopeHint = '';
  if (!resolvedTarget && !isGlobal && !isPathLikeTarget) {
    const globalInstalledSkills = await listInstalledSkills({ global: true });
    const matchedGlobalTarget = resolveRemoveTarget(skillName, globalInstalledSkills, process.cwd());
    if (matchedGlobalTarget) {
      globalScopeHint = `Skill "${skillName}" is installed globally. Use --global (-g) to remove it.`;
    }
  }

  if (!resolvedTarget) {
    spinner.stop('No matching skill found');

    const notFoundMessage = `Skill "${skillName}" not found`;
    const combinedMessage = globalScopeHint
      ? `${notFoundMessage}. ${globalScopeHint}`
      : notFoundMessage;

    if (options.json) {
      printJson({
        ok: false,
        skill: skillName,
        scope: isGlobal ? 'global' : 'project',
        requestedAgents: scopedAgents.map(toAgentOutput),
        removedAgents: [],
        skippedAgents: scopedAgents.map(toAgentOutput),
        failed: [{ agent: 'unknown', error: combinedMessage }],
        message: combinedMessage,
        hint: globalScopeHint || undefined,
      });
      process.exit(1);
    }

    p.log.info(notFoundMessage);
    if (globalScopeHint) {
      p.log.info(globalScopeHint);
    }
    p.outro('');
    process.exit(1);
  }

  const resolvedSkillName = resolvedTarget.skillName;
  const effectiveGlobalScope = isGlobal || (isPathLikeTarget && resolvedTarget.scope === 'global');

  const installedAgents = scopedAgents.length > 0
    ? scopedAgents
    : await detectInstalledAgents();

  spinner.stop(`Found ${installedAgents.length} agent(s)`);

  // Find which agents have this skill
  const agentsWithSkill = resolvedTarget.agents.filter((agent) => installedAgents.includes(agent));

  if (agentsWithSkill.length === 0) {
    if (resolvedTarget.agents.length === 0) {
      const orphanRemoval = await removeCanonicalSkill(resolvedSkillName, { global: effectiveGlobalScope });

      if (orphanRemoval.success) {
        await removeSkillFromLock(resolvedSkillName).catch(() => {
          // Non-critical: lock cleanup failure shouldn't fail removal
        });

        if (options.json) {
          printJson({
            ok: true,
            skill: resolvedSkillName,
            scope: effectiveGlobalScope ? 'global' : 'project',
            requestedAgents: installedAgents.map(toAgentOutput),
            removedAgents: [],
            skippedAgents: installedAgents.map(toAgentOutput),
            failed: [],
            message: `Removed orphan skill directory \"${resolvedSkillName}\"`,
          });
          return;
        }

        p.outro(pc.green(`Removed orphan skill directory ${resolvedSkillName}`));
        return;
      }

      if (options.json) {
        printJson({
          ok: false,
          skill: resolvedSkillName,
          scope: effectiveGlobalScope ? 'global' : 'project',
          requestedAgents: installedAgents.map(toAgentOutput),
          removedAgents: [],
          skippedAgents: installedAgents.map(toAgentOutput),
          failed: [{ agent: 'unknown', error: orphanRemoval.error || 'Failed to remove orphan directory' }],
          message: `Failed to remove orphan skill directory \"${resolvedSkillName}\"`,
        });
        process.exit(1);
      }

      p.log.error(`Failed to remove orphan skill directory "${resolvedSkillName}"`);
      if (orphanRemoval.error) {
        console.log(`  ${pc.dim(orphanRemoval.error)}`);
      }
      p.outro('');
      process.exit(1);
    }

    if (options.json) {
      const notFoundForRequestedAgentsMessage = `Skill "${resolvedSkillName}" not found for requested agents`;
      printJson({
        ok: false,
        skill: resolvedSkillName,
        scope: effectiveGlobalScope ? 'global' : 'project',
        requestedAgents: installedAgents.map(toAgentOutput),
        removedAgents: [],
        skippedAgents: installedAgents.map(toAgentOutput),
        failed: installedAgents.map((agent) => ({
          agent: toAgentOutput(agent),
          error: notFoundForRequestedAgentsMessage,
        })),
        message: notFoundForRequestedAgentsMessage,
      });
      process.exit(1);
    }

    p.log.info(`Skill "${resolvedSkillName}" not found for requested agents`);
    p.outro('');
    process.exit(1);
  }

  // Confirm removal
  if (!options.json) {
    const confirmed = await p.confirm({
      message: `Remove ${pc.cyan(resolvedSkillName)} from ${agentsWithSkill.length} agent(s)?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Removal cancelled');
      process.exit(0);
    }
  }

  spinner.start('Removing...');

  const removedAgents: AgentType[] = [];
  const failedRemovals: Array<{ agent: AgentType; error: string }> = [];

  for (const agent of agentsWithSkill) {
    const result = await removeSkill(resolvedSkillName, agent, { global: effectiveGlobalScope });
    if (result.success) {
      removedAgents.push(agent);
    } else {
      failedRemovals.push({
        agent,
        error: result.error || 'Unknown error',
      });
    }
  }

  // Remove from lock file
  if (removedAgents.length > 0) {
    await removeSkillFromLock(resolvedSkillName).catch(() => {
      // Non-critical: lock file cleanup failure shouldn't fail removal
    });
  }

  spinner.stop('Removed');

  if (options.json) {
    const skippedAgents = installedAgents.filter((agent) => !agentsWithSkill.includes(agent));
    printJson({
      ok: failedRemovals.length === 0,
      skill: resolvedSkillName,
      scope: effectiveGlobalScope ? 'global' : 'project',
      requestedAgents: installedAgents.map(toAgentOutput),
      removedAgents: removedAgents.map(toAgentOutput),
      skippedAgents: skippedAgents.map(toAgentOutput),
      failed: failedRemovals.map((entry) => ({
        agent: toAgentOutput(entry.agent),
        error: entry.error,
      })),
    });

    if (failedRemovals.length > 0) {
      process.exit(1);
    }

    return;
  }

  if (failedRemovals.length > 0) {
    p.log.error(`Failed to remove from ${failedRemovals.length} agent(s)`);
    for (const failed of failedRemovals) {
      const agentName = agents[failed.agent]?.displayName || failed.agent;
      console.log(`  ${pc.red('✗')} ${agentName}: ${pc.dim(failed.error)}`);
    }
    p.outro(pc.yellow(`Removed ${resolvedSkillName} from ${removedAgents.length} agent(s), with errors`));
    process.exit(1);
  }

  p.outro(pc.green(`Removed ${resolvedSkillName} from ${removedAgents.length} agent(s)`));
}

// ============================================
// Info Command
// ============================================

async function runInfo(args: string[]): Promise<void> {
  const inputTarget = args[0];

  if (!inputTarget) {
    console.log(`${RED}Error: Missing skill name${RESET}`);
    console.log(`Usage: askill info <skill-name>`);
    process.exit(1);
  }

  const skillName = normalizeInfoTarget(inputTarget);

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill info ')));

  const spinner = p.spinner();
  spinner.start(`Fetching ${skillName}...`);

  try {
    const skill = await api.getSkill(skillName);
    spinner.stop('');

    const displayName = skill.name || 'unknown';
    const version = (() => {
      try {
        if (!skill.rawContent) return '';
        const parsed = parseSkillMd(skill.rawContent);
        return typeof parsed.frontmatter.version === 'string'
          ? parsed.frontmatter.version.trim()
          : '';
      } catch {
        return '';
      }
    })();
    const owner = skill.owner || 'unknown';
    const repo = skill.repo || '';

    console.log();
    console.log(`  ${pc.bold(displayName)}`);
    if (skill.description) {
      console.log(`  ${pc.dim(skill.description)}`);
    }
    console.log();
    console.log(`  ${pc.dim('Owner:')}      ${owner}`);
    if (version) {
      console.log(`  ${pc.dim('Version:')}    ${version}`);
    }
    if (repo) {
      console.log(`  ${pc.dim('Repository:')} ${owner}/${repo}`);
    }
    if (skill.stars !== null && skill.stars !== undefined) {
      console.log(`  ${pc.dim('Stars:')}      ${skill.stars.toLocaleString()}`);
    }
    const aiScore = getTotalAIScore(skill);
    console.log(`  ${pc.dim('AI score:')}   ${formatScore(aiScore)}`);
    const aiDimensions = getAIScoreDimensions(skill);
    if (aiDimensions.length > 0) {
      console.log(`  ${pc.dim('AI breakdown:')}`);
      for (const dimension of aiDimensions) {
        console.log(`    ${pc.dim(`${dimension.label}:`)} ${formatScore(dimension.score)}`);
      }
    }
    if (skill.tags && skill.tags.length > 0) {
      console.log(`  ${pc.dim('Tags:')}       ${skill.tags.join(', ')}`);
    }
    if (skill.path) {
      console.log(`  ${pc.dim('Path:')}       ${skill.path}`);
    }
    if (skill.updatedAt) {
      console.log(`  ${pc.dim('Updated:')}    ${new Date(skill.updatedAt).toLocaleDateString()}`);
    }
    console.log();

    // Build install command
    const installCmd = skill.owner && skill.repo
      ? `${skill.owner}/${skill.repo}@${displayName}`
      : displayName;
    console.log(`  ${pc.dim('Install:')}    ${pc.cyan(`askill install gh:${installCmd}`)}`);
    console.log();

    p.outro('');
  } catch (error) {
    if (error instanceof APIError && error.status === 404) {
      spinner.stop(pc.red('Not found'));
      p.outro(pc.red(`Skill "${skillName}" not found`));
      process.exit(1);
    }
    throw error;
  }
}

// ============================================
// Check Command
// ============================================

export interface SkillUpdateInfo {
  name: string;
  source: string;
  sourceUrl: string;
  skillPath?: string;
  localHash: string;
  remoteHash: string;
}

async function runCheck(_args: string[]): Promise<void> {
  console.log();
  p.intro(pc.bgCyan(pc.black(' askill check ')));

  const spinner = p.spinner();
  spinner.start('Reading lock file...');

  const skills = await getAllLockedSkills();
  const skillNames = Object.keys(skills);

  if (skillNames.length === 0) {
    spinner.stop('No skills tracked');
    p.log.info('No installed skills found in lock file');
    p.log.info(`Install skills with ${pc.cyan('askill add <skill>')}`);
    p.outro('');
    return;
  }

  spinner.stop(`Found ${skillNames.length} tracked skill(s)`);
  spinner.start('Checking for updates...');

  const updatable: SkillUpdateInfo[] = [];
  const upToDate: string[] = [];
  const uncheckable: Array<{ name: string; reason: string }> = [];

  for (const [name, entry] of Object.entries(skills)) {
    // Only GitHub sources can be checked via Tree SHA
    if (entry.sourceType !== 'github' || !entry.source) {
      const reason = entry.sourceType === 'local'
        ? 'local source'
        : entry.sourceType === 'collection'
          ? 'installed from shared collection (reinstall collection to refresh)'
          : 'source type not auto-checkable';
      uncheckable.push({ name, reason });
      continue;
    }

    // No hash stored — can't compare
    if (!entry.skillFolderHash) {
      uncheckable.push({ name, reason: 'no hash recorded (reinstall to fix)' });
      continue;
    }

    try {
      const remoteHash = await fetchSkillFolderHash(entry.source, entry.skillPath || '');

      if (!remoteHash) {
        uncheckable.push({ name, reason: 'could not fetch remote hash' });
        continue;
      }

      if (remoteHash !== entry.skillFolderHash) {
        updatable.push({
          name,
          source: entry.source,
          sourceUrl: entry.sourceUrl,
          skillPath: entry.skillPath,
          localHash: entry.skillFolderHash,
          remoteHash,
        });
      } else {
        upToDate.push(name);
      }
    } catch {
      uncheckable.push({ name, reason: 'failed to check remote' });
    }
  }

  spinner.stop('Check complete');
  console.log();

  if (updatable.length > 0) {
    p.log.warning(pc.yellow(`${updatable.length} skill(s) have updates available:`));
    for (const u of updatable) {
      console.log(`  ${pc.yellow('↑')} ${pc.cyan(u.name)} ${pc.dim(`from ${u.source}`)}`);
      console.log(`    ${pc.dim(`${u.localHash.slice(0, 8)} → ${u.remoteHash.slice(0, 8)}`)}`);
    }
    console.log();
    p.log.info(`Run ${pc.cyan('askill update')} to update all`);
  }

  if (upToDate.length > 0) {
    p.log.success(pc.green(`${upToDate.length} skill(s) up to date`));
  }

  if (uncheckable.length > 0) {
    for (const u of uncheckable) {
      console.log(`  ${pc.dim('?')} ${u.name} ${pc.dim(`(${u.reason})`)}`);
    }
  }

  console.log();
  p.outro(updatable.length > 0 ? pc.yellow(`${updatable.length} update(s) available`) : pc.green('All up to date'));
}

// ============================================
// Update Command
// ============================================

async function runUpdate(args: string[]): Promise<void> {
  const isYes = args.includes('-y') || args.includes('--yes');
  const specificSkill = args.find((a) => !a.startsWith('-'));

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill update ')));

  const spinner = p.spinner();
  spinner.start('Checking for updates...');

  const skills = await getAllLockedSkills();
  const skillNames = Object.keys(skills);

  if (skillNames.length === 0) {
    spinner.stop('No skills tracked');
    p.log.info('No installed skills found in lock file');
    p.outro('');
    return;
  }

  // Find which skills have updates
  const updatable: SkillUpdateInfo[] = [];

  for (const [name, entry] of Object.entries(skills)) {
    // If specific skill requested, skip others
    if (specificSkill && name !== specificSkill) continue;

    if (entry.sourceType !== 'github' || !entry.source || !entry.skillFolderHash) {
      continue;
    }

    try {
      const remoteHash = await fetchSkillFolderHash(entry.source, entry.skillPath || '');
      if (remoteHash && remoteHash !== entry.skillFolderHash) {
        updatable.push({
          name,
          source: entry.source,
          sourceUrl: entry.sourceUrl,
          skillPath: entry.skillPath,
          localHash: entry.skillFolderHash,
          remoteHash,
        });
      }
    } catch {
      // Skip skills that can't be checked
    }
  }

  if (updatable.length === 0) {
    spinner.stop('All skills up to date');
    p.outro(pc.green('Nothing to update'));
    return;
  }

  spinner.stop(`${updatable.length} update(s) available`);

  // Show what will be updated
  for (const u of updatable) {
    console.log(`  ${pc.yellow('↑')} ${pc.cyan(u.name)} ${pc.dim(`(${u.localHash.slice(0, 8)} → ${u.remoteHash.slice(0, 8)})`)}`);
  }

  // Confirm
  if (!isYes) {
    const confirmed = await p.confirm({
      message: `Update ${updatable.length} skill(s)?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Update cancelled');
      return;
    }
  }

  // Get last selected agents
  const lastAgents = await getLastSelectedAgents();
  let targetAgents: AgentType[];

  if (lastAgents && lastAgents.length > 0) {
    targetAgents = lastAgents as AgentType[];
  } else {
    // Detect installed agents
    spinner.start('Detecting agents...');
    const installedAgents = await detectInstalledAgents();
    spinner.stop(`Found ${installedAgents.length} agent(s)`);
    targetAgents = installedAgents;
  }

  if (targetAgents.length === 0) {
    p.log.error('No agents found');
    p.outro(pc.red('Cannot update without agents'));
    return;
  }

  // Update each skill: clone → discover → install
  spinner.start('Updating...');

  let successCount = 0;
  let failCount = 0;

  for (const u of updatable) {
    spinner.message(`Updating ${u.name}...`);

    let tempDir: string | undefined;
    try {
      // Clone the source repo
      tempDir = await cloneRepo(u.sourceUrl, undefined, u.skillPath);

      // Discover the specific skill
      let discovered = await discoverSkills(tempDir, u.skillPath);
      discovered = discovered.filter((s) => s.name === u.name);

      if (discovered.length === 0) {
        // Skill might have been renamed or moved; try all
        discovered = await discoverSkills(tempDir);
        discovered = discovered.filter((s) => s.name === u.name);
      }

      if (discovered.length === 0) {
        p.log.warning(`Skill "${u.name}" not found in source, skipping`);
        failCount++;
        continue;
      }

      const skill = discovered[0];

      // Install to all target agents
      for (const agent of targetAgents) {
        if (skill.path) {
          await installSkillFromDir(skill.name, skill.path, agent, { mode: 'symlink' });
        } else {
          await installSkill(skill.name, skill.rawContent, agent, { mode: 'symlink' });
        }
      }

      // Update lock entry with new hash
      const lockEntry = skills[u.name];
      await addSkillToLock(u.name, {
        source: lockEntry.source,
        sourceType: lockEntry.sourceType,
        sourceUrl: lockEntry.sourceUrl,
        skillPath: lockEntry.skillPath,
        skillFolderHash: u.remoteHash,
      });

      successCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      p.log.error(`Failed to update ${u.name}: ${pc.dim(msg)}`);
      failCount++;
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  }

  spinner.stop('Update complete');

  if (successCount > 0) {
    p.log.success(pc.green(`Updated ${successCount} skill(s)`));
  }
  if (failCount > 0) {
    p.log.error(pc.red(`Failed to update ${failCount} skill(s)`));
  }

  console.log();
  p.outro(pc.green('Done!'));
}

// ============================================
// Run Command
// ============================================

/**
 * Parse the skill:command format.
 * Supports: skill-name:command, @scope/skill:command
 */
function parseRunTarget(input: string): { skill: string; command: string } | null {
  // Find the last colon that separates skill from command
  // Handle @scope/name:command (colon is after the skill name)
  const colonIndex = input.lastIndexOf(':');
  if (colonIndex <= 0 || colonIndex === input.length - 1) {
    return null;
  }

  return {
    skill: input.slice(0, colonIndex),
    command: input.slice(colonIndex + 1),
  };
}

/**
 * Locate the installed skill directory.
 * Search order: project canonical → project agent dirs → global canonical → global agent dirs
 */
async function findSkillDir(skillName: string): Promise<string | null> {
  const { access: fsAccess } = await import('fs/promises');
  const sanitized = sanitizeName(skillName);
  const cwd = process.cwd();

  // 1. Project canonical: .agents/skills/<skill>
  const projectCanonical = join(cwd, AGENTS_DIR, SKILLS_SUBDIR, sanitized);
  try {
    await fsAccess(join(projectCanonical, 'SKILL.md'));
    return projectCanonical;
  } catch {}

  // 2. Project agent dirs (check first few common agents)
  const commonAgentDirs = ['.claude/skills', '.cursor/skills', '.opencode/skills', '.windsurf/skills'];
  for (const dir of commonAgentDirs) {
    const agentPath = join(cwd, dir, sanitized);
    try {
      await fsAccess(join(agentPath, 'SKILL.md'));
      return agentPath;
    } catch {}
  }

  // 3. Global canonical: ~/.agents/skills/<skill>
  const home = homedir();
  const globalCanonical = join(home, AGENTS_DIR, SKILLS_SUBDIR, sanitized);
  try {
    await fsAccess(join(globalCanonical, 'SKILL.md'));
    return globalCanonical;
  } catch {}

  // 4. Global agent dirs
  const globalAgentDirs = ['.claude/skills', '.cursor/skills', '.opencode/skills'];
  for (const dir of globalAgentDirs) {
    const agentPath = join(home, dir, sanitized);
    try {
      await fsAccess(join(agentPath, 'SKILL.md'));
      return agentPath;
    } catch {}
  }

  return null;
}

async function runRun(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log(`${RED}Error: Missing run target${RESET}`);
    console.log(`Usage: askill run <skill>:<command> [args...]`);
    console.log(`\nExamples:`);
    console.log(`  askill run my-skill:build`);
    console.log(`  askill run code-stats:analyze -- --path ./src`);
    console.log(`  askill run my-skill:_setup`);
    process.exit(1);
  }

  const target = args[0];
  const parsed = parseRunTarget(target);

  if (!parsed) {
    console.log(`${RED}Error: Invalid run target "${target}"${RESET}`);
    console.log(`Expected format: ${CYAN}<skill>:<command>${RESET}`);
    console.log(`Example: askill run my-skill:build`);
    process.exit(1);
  }

  const { skill, command } = parsed;

  // Extra args: everything after the target, skip -- separator if present
  let extraArgs = args.slice(1);
  if (extraArgs[0] === '--') {
    extraArgs = extraArgs.slice(1);
  }

  // Find the skill directory
  const skillDir = await findSkillDir(skill);

  if (!skillDir) {
    console.log(`${RED}Error: Skill "${skill}" not found${RESET}`);
    console.log(`Install it with: ${CYAN}askill add <source>${RESET}`);
    process.exit(1);
  }

  // Read SKILL.md and parse commands
  const fs = await import('fs/promises');
  const skillMdPath = join(skillDir, 'SKILL.md');
  const content = await fs.readFile(skillMdPath, 'utf-8');
  const { frontmatter } = parseSkillMd(content);

  if (!frontmatter.commands || Object.keys(frontmatter.commands).length === 0) {
    console.log(`${RED}Error: Skill "${skill}" does not define any commands${RESET}`);
    console.log(`${DIM}Check the skill's SKILL.md for available commands${RESET}`);
    process.exit(1);
  }

  const cmdDef = frontmatter.commands[command];

  if (!cmdDef) {
    console.log(`${RED}Error: Command "${command}" not found in skill "${skill}"${RESET}`);
    console.log(`\nAvailable commands:`);
    for (const [name, def] of Object.entries(frontmatter.commands)) {
      const prefix = name.startsWith('_') ? pc.dim('  (internal) ') : '  ';
      console.log(`${prefix}${pc.cyan(name)} ${pc.dim('—')} ${def.description || 'No description'}`);
    }
    process.exit(1);
  }

  if (!cmdDef.run) {
    console.log(`${RED}Error: Command "${command}" has no "run" field${RESET}`);
    process.exit(1);
  }

  // Build the full command with extra args
  let shellCmd = cmdDef.run;
  if (extraArgs.length > 0) {
    // Shell-escape args and append
    const escapedArgs = extraArgs.map((a) => {
      if (/[^a-zA-Z0-9_\-.\/=:]/.test(a)) {
        return `'${a.replace(/'/g, "'\\''")}'`;
      }
      return a;
    });
    shellCmd += ' ' + escapedArgs.join(' ');
  }

  // Execute the command in the skill's directory
  console.log(`${DIM}$ ${shellCmd}${RESET}`);
  console.log();

  const { spawn } = await import('child_process');

  const child = spawn(shellCmd, {
    cwd: skillDir,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ASKILL_SKILL_DIR: skillDir,
      ASKILL_SKILL_NAME: skill,
      ASKILL_COMMAND: command,
    },
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });

  process.exit(exitCode);
}

// ============================================
// Validate Command
// ============================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateFrontmatter(frontmatter: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!frontmatter.name) {
    errors.push('Missing required field: name');
  } else if (typeof frontmatter.name !== 'string') {
    errors.push('Field "name" must be a string');
  } else if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
    errors.push('Field "name" must be lowercase alphanumeric with hyphens only');
  }

  if (!frontmatter.description) {
    errors.push('Missing required field: description');
  } else if (typeof frontmatter.description !== 'string') {
    errors.push('Field "description" must be a string');
  } else if (frontmatter.description.length > 200) {
    warnings.push('Field "description" should be 200 characters or less');
  }

  // Version format (optional but if present must be valid semver)
  if (frontmatter.version !== undefined) {
    if (typeof frontmatter.version !== 'string') {
      errors.push('Field "version" must be a string');
    } else if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(frontmatter.version)) {
      errors.push('Field "version" must be valid semver (e.g., 1.0.0, 1.0.0-beta.1)');
    }
  } else {
    warnings.push('Missing optional field: version (recommended)');
  }

  // Author (optional)
  if (frontmatter.author !== undefined) {
    if (typeof frontmatter.author !== 'string' && typeof frontmatter.author !== 'object') {
      errors.push('Field "author" must be a string or object');
    }
  }

  // Tags (optional)
  if (frontmatter.tags !== undefined) {
    if (!Array.isArray(frontmatter.tags)) {
      errors.push('Field "tags" must be an array');
    } else {
      for (const tag of frontmatter.tags) {
        if (typeof tag !== 'string') {
          errors.push('Each tag must be a string');
          break;
        }
      }
    }
  }

  // Dependencies (optional)
  if (frontmatter.dependencies !== undefined) {
    if (!Array.isArray(frontmatter.dependencies)) {
      errors.push('Field "dependencies" must be an array');
    } else {
      for (const dep of frontmatter.dependencies) {
        if (typeof dep !== 'string') {
          errors.push('Each dependency must be a string');
          break;
        }
        // Check dependency format: @scope/name@version or gh:owner/repo@skill
        if (!dep.startsWith('@') && !dep.startsWith('gh:')) {
          warnings.push(`Dependency "${dep}" should start with @ or gh:`);
        }
      }
    }
  }

  // Commands (optional)
  if (frontmatter.commands !== undefined) {
    if (typeof frontmatter.commands !== 'object' || frontmatter.commands === null) {
      errors.push('Field "commands" must be an object');
    } else {
      const commands = frontmatter.commands as Record<string, unknown>;
      for (const [cmdName, cmdDef] of Object.entries(commands)) {
        if (typeof cmdDef !== 'object' || cmdDef === null) {
          errors.push(`Command "${cmdName}" must be an object`);
          continue;
        }
        const def = cmdDef as Record<string, unknown>;
        if (!def.run) {
          errors.push(`Command "${cmdName}" is missing required field: run`);
        } else if (typeof def.run !== 'string') {
          errors.push(`Command "${cmdName}.run" must be a string`);
        }
        if (!def.description) {
          warnings.push(`Command "${cmdName}" is missing description`);
        } else if (typeof def.description !== 'string') {
          errors.push(`Command "${cmdName}.description" must be a string`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function runValidate(args: string[]): Promise<void> {
  // Default to ./SKILL.md if no path provided
  let targetPath = args.find((a) => !a.startsWith('-')) || 'SKILL.md';
  
  // If path doesn't end with SKILL.md, append it
  if (!targetPath.endsWith('SKILL.md')) {
    targetPath = join(targetPath, 'SKILL.md');
  }

  // Resolve to absolute path
  const absolutePath = join(process.cwd(), targetPath);

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill validate ')));

  const spinner = p.spinner();
  spinner.start(`Checking ${targetPath}...`);

  // Check if file exists
  const fs = await import('fs/promises');
  try {
    await fs.access(absolutePath);
  } catch {
    spinner.stop(pc.red('File not found'));
    p.log.error(`Cannot find ${pc.cyan(targetPath)}`);
    p.outro(pc.red('Validation failed'));
    process.exit(1);
  }

  // Read and parse the file
  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    spinner.stop(pc.red('Read error'));
    p.log.error(`Cannot read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    p.outro(pc.red('Validation failed'));
    process.exit(1);
  }

  // Check for frontmatter
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    spinner.stop(pc.red('Invalid format'));
    p.log.error('SKILL.md must start with YAML frontmatter (--- ... ---)');
    p.outro(pc.red('Validation failed'));
    process.exit(1);
  }

  spinner.stop('Parsing...');

  // Parse frontmatter
  const { frontmatter } = parseSkillMd(content);

  // Validate
  const result = validateFrontmatter(frontmatter as Record<string, unknown>);

  console.log();

  // Report errors
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.log(`  ${pc.red('✗')} ${error}`);
    }
  }

  // Report warnings
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.log(`  ${pc.yellow('!')} ${warning}`);
    }
  }

  // Report successes (what passed)
  const checks = [
    { name: 'Frontmatter is valid YAML', passed: true }, // Already parsed
    { name: 'Required field: name', passed: !!frontmatter.name && typeof frontmatter.name === 'string' },
    { name: 'Required field: description', passed: !!frontmatter.description && typeof frontmatter.description === 'string' },
  ];

  if (frontmatter.version) {
    const versionValid = typeof frontmatter.version === 'string' && 
      /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(frontmatter.version);
    checks.push({ name: `Version format: ${frontmatter.version}`, passed: versionValid });
  }

  if (frontmatter.dependencies && Array.isArray(frontmatter.dependencies)) {
    checks.push({ name: `Dependencies: ${frontmatter.dependencies.length} defined`, passed: true });
  }

  if (frontmatter.commands && typeof frontmatter.commands === 'object') {
    const cmdCount = Object.keys(frontmatter.commands).length;
    checks.push({ name: `Commands: ${cmdCount} defined`, passed: cmdCount > 0 });
  }

  // Show passing checks only if no errors
  if (result.errors.length === 0) {
    for (const check of checks) {
      if (check.passed) {
        console.log(`  ${pc.green('✓')} ${check.name}`);
      }
    }
  }

  console.log();

  if (result.valid) {
    if (result.warnings.length > 0) {
      p.outro(pc.yellow(`Valid with ${result.warnings.length} warning(s)`));
    } else {
      p.outro(pc.green('Ready to publish!'));
    }
  } else {
    p.outro(pc.red(`Validation failed: ${result.errors.length} error(s)`));
    process.exit(1);
  }
}

// ============================================
// Init Command
// ============================================

async function runInit(args: string[]): Promise<void> {
  const targetDir = args.find((a) => !a.startsWith('-')) || '.';
  const isYes = args.includes('-y') || args.includes('--yes');

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill init ')));

  // Check if SKILL.md already exists
  const skillPath = join(process.cwd(), targetDir, 'SKILL.md');
  
  try {
    await import('fs').then((fs) => fs.promises.access(skillPath));
    p.log.error(`SKILL.md already exists at ${pc.cyan(skillPath)}`);
    p.outro(pc.red('Aborted'));
    return;
  } catch {
    // File doesn't exist, continue
  }

  let name: string;
  let description: string;
  let version: string;
  let author: string;
  let tags: string[];

  if (isYes) {
    // Non-interactive: use defaults
    const dirName = targetDir === '.' ? process.cwd().split('/').pop() || 'my-skill' : targetDir;
    name = dirName;
    description = 'A new askill skill';
    version = '0.1.0';
    author = '';
    tags = [];
  } else {
    // Interactive prompts
    const dirName = targetDir === '.' ? process.cwd().split('/').pop() || 'my-skill' : targetDir;

    const nameResult = await p.text({
      message: 'Skill name',
      placeholder: dirName,
      defaultValue: dirName,
      validate: (value) => {
        if (!value) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Name must be lowercase alphanumeric with hyphens';
        return undefined;
      },
    });

    if (p.isCancel(nameResult)) {
      p.cancel('Init cancelled');
      return;
    }
    name = nameResult as string;

    const descResult = await p.text({
      message: 'Description',
      placeholder: 'What does this skill do?',
      validate: (value) => {
        if (!value) return 'Description is required';
        if (value.length > 200) return 'Description must be 200 characters or less';
        return undefined;
      },
    });

    if (p.isCancel(descResult)) {
      p.cancel('Init cancelled');
      return;
    }
    description = descResult as string;

    const versionResult = await p.text({
      message: 'Version',
      placeholder: '0.1.0',
      defaultValue: '0.1.0',
      validate: (value) => {
        if (!value) return 'Version is required';
        if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(value)) return 'Must be valid semver (e.g., 0.1.0)';
        return undefined;
      },
    });

    if (p.isCancel(versionResult)) {
      p.cancel('Init cancelled');
      return;
    }
    version = versionResult as string;

    const authorResult = await p.text({
      message: 'Author (GitHub username)',
      placeholder: 'your-username',
    });

    if (p.isCancel(authorResult)) {
      p.cancel('Init cancelled');
      return;
    }
    author = (authorResult as string) || '';

    const tagsResult = await p.text({
      message: 'Tags (comma-separated)',
      placeholder: 'automation, productivity',
    });

    if (p.isCancel(tagsResult)) {
      p.cancel('Init cancelled');
      return;
    }
    tags = (tagsResult as string)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Generate SKILL.md content
  let content = '---\n';
  content += `name: ${name}\n`;
  content += `description: ${description}\n`;
  content += `version: ${version}\n`;
  if (author) {
    content += `author: ${author}\n`;
  }
  if (tags.length > 0) {
    content += `tags:\n`;
    for (const tag of tags) {
      content += `  - ${tag}\n`;
    }
  }
  content += '---\n\n';
  content += `# ${name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n\n`;
  content += `${description}\n\n`;
  content += `## Usage\n\n`;
  content += `Explain how an AI agent should use this skill...\n\n`;
  content += `## Examples\n\n`;
  content += `Provide concrete examples of when and how to use this skill.\n`;

  // Create directory if needed
  const targetPath = join(process.cwd(), targetDir);
  if (targetDir !== '.') {
    const fs = await import('fs');
    await fs.promises.mkdir(targetPath, { recursive: true });
  }

  // Write SKILL.md
  const fs = await import('fs');
  await fs.promises.writeFile(skillPath, content, 'utf-8');

  p.log.success(`Created ${pc.cyan(skillPath)}`);
  console.log();
  console.log(pc.dim('Next steps:'));
  console.log(`  1. Edit ${pc.cyan('SKILL.md')} to add instructions`);
  console.log(`  2. Optionally add ${pc.cyan('scripts/')} for commands`);
  console.log(`  3. Test locally: ${pc.cyan(`askill add ./${targetDir === '.' ? '' : targetDir}`)}`);
  console.log();
  p.outro(pc.green('Done!'));
}

// ============================================
// Submit / Auth / Publish Commands
// ============================================

async function runSubmit(args: string[]): Promise<void> {
  const url = args.find((a) => !a.startsWith('-'));
  if (!url) {
    console.log(`${RED}Usage: askill submit <github-url>${RESET}`);
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill submit ')));
  const spinner = p.spinner();
  spinner.start('Submitting URL for indexing...');

  try {
    const result = await api.submit(url);
    spinner.stop(pc.green(result.message));

    console.log();
    for (const skill of result.skills) {
      const statusColor =
        skill.status === 'indexed' ? pc.green : skill.status === 'skipped' ? pc.yellow : pc.red;
      console.log(`  ${statusColor(skill.status.padEnd(7))} ${pc.dim(skill.path)}${skill.name ? ` (${skill.name})` : ''}`);
    }

    p.outro(pc.green(`Submitted ${pc.cyan(`${result.repoOwner}/${result.repoName}`)}`));
  } catch (error) {
    spinner.stop(pc.red('Submit failed'));
    if (error instanceof APIError) {
      p.log.error(error.message);
    } else {
      p.log.error(error instanceof Error ? error.message : 'Unknown error');
    }
    p.outro(pc.red('Failed'));
    process.exit(1);
  }
}

async function runLogin(args: string[]): Promise<void> {
  let token = '';
  const tokenFlagIndex = args.findIndex((a) => a === '--token');
  if (tokenFlagIndex >= 0 && args[tokenFlagIndex + 1]) {
    token = args[tokenFlagIndex + 1];
  }

  if (!token) {
    console.log();
    p.note(`To get your token, visit: ${pc.cyan(`${REGISTRY_URL}/account`)}`);
    const input = await p.password({
      message: 'API token',
      placeholder: 'ask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      mask: '*',
      validate: (value) => {
        if (!value) return 'Token is required';
        if (!value.startsWith('ask_')) return 'Token must start with ask_';
        return undefined;
      },
    });

    if (p.isCancel(input)) {
      p.cancel('Login cancelled');
      return;
    }
    token = input as string;
  }

  const spinner = p.spinner();
  spinner.start('Verifying token...');

  try {
    const me = await api.authMe(token);
    const username = me.username ?? undefined;
    await saveCredentials({ token, username });
    spinner.stop(pc.green(`Logged in as @${username ?? 'unknown'}`));
    p.outro(pc.green('Authentication saved'));
  } catch (error) {
    spinner.stop(pc.red('Invalid token'));
    if (error instanceof APIError) {
      p.log.error(error.message);
    } else {
      p.log.error(error instanceof Error ? error.message : 'Unknown error');
    }
    p.outro(pc.red('Login failed'));
    process.exit(1);
  }
}

async function runLogout(): Promise<void> {
  await clearCredentials();
  p.outro(pc.green('Logged out'));
}

async function runWhoami(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    p.log.warn('Not logged in. Run askill login first.');
    return;
  }

  try {
    const me = await api.authMe(creds.token);
    const username = me.username ?? creds.username ?? 'unknown';
    console.log(`@${username} (token: ${maskToken(creds.token)})`);
  } catch {
    console.log(`Stored token appears invalid (token: ${maskToken(creds.token)})`);
    process.exit(1);
  }
}

async function runPublish(args: string[]): Promise<void> {
  const githubFlagIndex = args.findIndex((a) => a === '--github');
  const githubUrl = githubFlagIndex >= 0 ? args[githubFlagIndex + 1] : undefined;
  if (githubFlagIndex >= 0 && !githubUrl) {
    p.log.error('Missing value for --github. Provide a GitHub blob URL to SKILL.md.');
    showCommandHelp('publish');
    process.exit(1);
  }

  // Positional args (excluding the --github URL value)
  const positional = args.filter((a, idx) => {
    if (a.startsWith('-')) return false;
    if (githubFlagIndex >= 0 && idx === githubFlagIndex + 1) return false;
    return true;
  });

  // Avoid surprising behavior: `askill publish` should show help,
  // and publishing current directory should be explicit via `askill publish .`.
  if (!githubUrl && positional.length === 0) {
    showCommandHelp('publish');
    console.log(`${DIM}Tip:${RESET} publish current directory with ${CYAN}askill publish .${RESET}`);
    return;
  }

  const localPath = positional[0] ?? '.';

  let content = '';
  if (githubUrl) {
    const rawUrl = toRawGitHubUrl(githubUrl);
    if (!rawUrl) {
      p.log.error('Invalid GitHub file URL. Use a blob URL to SKILL.md');
      process.exit(1);
    }

    const spinner = p.spinner();
    spinner.start('Fetching SKILL.md from GitHub...');
    const res = await fetch(rawUrl);
    if (!res.ok) {
      spinner.stop(pc.red('Fetch failed'));
      p.log.error('Unable to fetch SKILL.md from GitHub URL');
      process.exit(1);
    }
    content = await res.text();
    spinner.stop('Fetched');
  } else {
    const fs = await import('fs/promises');
    const skillPath = localPath.endsWith('SKILL.md') ? localPath : join(localPath, 'SKILL.md');
    try {
      content = await fs.readFile(join(process.cwd(), skillPath), 'utf-8');
    } catch {
      p.log.error(`Cannot read ${pc.cyan(skillPath)}`);
      process.exit(1);
    }
  }

  // Local validation
  const parsed = parseSkillMd(content);
  const name = typeof parsed.frontmatter.name === 'string' ? parsed.frontmatter.name.trim() : '';
  const slug = typeof parsed.frontmatter.slug === 'string' ? parsed.frontmatter.slug.trim() : '';
  const version = typeof parsed.frontmatter.version === 'string' ? parsed.frontmatter.version.trim() : '';
  if (!name) {
    p.log.error('SKILL.md must include frontmatter name');
    process.exit(1);
  }
  if (!slug) {
    p.log.error('SKILL.md must include frontmatter slug');
    p.log.info('Add slug using lowercase letters, numbers, and hyphens (example: slug: my-skill)');
    process.exit(1);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    p.log.error(`Invalid slug in SKILL.md: "${slug}"`);
    p.log.info('Expected format: lowercase letters, numbers, hyphens (example: my-skill)');
    process.exit(1);
  }
  if (!version) {
    p.log.error('SKILL.md is missing frontmatter field "version".');
    p.log.info('Add a semver version, for example: version: 0.1.0');
    p.log.info('Valid examples: 1.0.0, 1.2.3-beta.1, 2.0.0+build.5');
    process.exit(1);
  }
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/.test(version)) {
    p.log.error(`Invalid semver version in SKILL.md: "${version}"`);
    p.log.info('Expected format: MAJOR.MINOR.PATCH with optional prerelease/build');
    p.log.info('Examples: 1.0.0, 1.1.0-beta.1, 2.0.0+build.7');
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' askill publish ')));
  const spinner = p.spinner();
  spinner.start('Publishing skill...');

  try {
    const creds = githubUrl ? null : await loadCredentials();
    if (!githubUrl && !creds?.token) {
      spinner.stop(pc.red('Publish failed'));
      p.log.error('Not logged in. Run askill login first for local publish.');
      process.exit(1);
    }

    const result = await api.publish({
      token: creds?.token,
      githubUrl,
      content: githubUrl ? undefined : content,
    });
    spinner.stop(pc.green(`Published ${result.slug}@${result.version}`));
    p.outro(pc.cyan(result.url));
  } catch (error) {
    spinner.stop(pc.red('Publish failed'));
    if (error instanceof APIError) {
      p.log.error(error.message);
    } else {
      p.log.error(error instanceof Error ? error.message : 'Unknown error');
    }
    p.outro(pc.red('Failed'));
    process.exit(1);
  }
}

function toRawGitHubUrl(url: string): string | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/[^/]+\/(.+)$/);
  if (!match) return null;
  const [, owner, repo, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  // Per-command help: askill <command> --help
  if ((restArgs.includes('--help') || restArgs.includes('-h')) && showCommandHelp(command)) {
    return;
  }

  // Auto-update on startup for regular commands
  if (!jsonMode) {
    await maybeAutoUpgradeOnStartup(command);
  }

  switch (command) {
    case 'install':
    case 'i':
    case 'add':
      await runInstall(restArgs);
      break;

    case 'search':
    case 's':
    case 'find':
      await runSearch(restArgs);
      break;

    case 'list':
    case 'ls':
      await runList(restArgs);
      break;

    case 'remove':
    case 'rm':
    case 'uninstall':
      await runRemove(restArgs);
      break;

    case 'info':
    case 'show':
      await runInfo(restArgs);
      break;

    case 'check':
      await runCheck(restArgs);
      break;

    case 'update':
      await runUpdate(restArgs);
      break;

    case 'upgrade':
      await selfUpdate();
      break;

    case 'run':
      await runRun(restArgs);
      break;

    case 'validate':
      await runValidate(restArgs);
      break;

    case 'init':
      await runInit(restArgs);
      break;

    case 'submit':
      await runSubmit(restArgs);
      break;

    case 'login':
      await runLogin(restArgs);
      break;

    case 'logout':
      await runLogout();
      break;

    case 'whoami':
      await runWhoami();
      break;

    case 'publish':
      await runPublish(restArgs);
      break;

    case '--help':
    case '-h':
    case 'help':
      if (restArgs[0] && showCommandHelp(restArgs[0])) {
        break;
      }
      showHelp();
      break;

    case '--version':
    case '-v':
    case 'version':
      console.log(VERSION);
      break;

    default:
      console.log(`${RED}Unknown command: ${command}${RESET}`);
      console.log(`Run ${CYAN}askill --help${RESET} for usage.`);
      process.exit(1);
  }

}

main().catch((error) => {
  const jsonMode = process.argv.slice(2).includes('--json');
  if (jsonMode) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    printJson({
      ok: false,
      error: {
        code: 'UNHANDLED_ERROR',
        message: errorMessage,
      },
    });
    process.exit(1);
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`${RED}Error: ${errorMessage}${RESET}`);
  process.exit(1);
});
