#!/usr/bin/env node

// askill - Agent Skill Package Manager
// Install AI agent skills from askill.sh

import { VERSION, RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED, GRAY, agents, type AgentType } from './constants.ts';
import { api, APIError, type Skill, type RepoSkill } from './api.ts';
import { installSkill, detectInstalledAgents, listInstalledSkills, removeSkill, isSkillInstalled, type InstallMode } from './installer.ts';
import { checkForUpdates, selfUpdate } from './updater.ts';
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
  console.log(`  ${DIM}$${RESET} askill install ${DIM}<skill>${RESET}   ${DIM}Install a skill${RESET}`);
  console.log(`  ${DIM}$${RESET} askill search ${DIM}[query]${RESET}   ${DIM}Search for skills${RESET}`);
  console.log(`  ${DIM}$${RESET} askill list${RESET}              ${DIM}List installed skills${RESET}`);
  console.log(`  ${DIM}$${RESET} askill remove ${DIM}<skill>${RESET}   ${DIM}Remove a skill${RESET}`);
  console.log(`  ${DIM}$${RESET} askill run ${DIM}<skill:cmd>${RESET}  ${DIM}Run a skill command${RESET}`);
  console.log();
  console.log(`${DIM}Browse skills at${RESET} ${CYAN}https://askill.sh${RESET}`);
  console.log();
}

function showHelp(): void {
  console.log(`
${BOLD}Usage:${RESET} askill <command> [options]

${BOLD}Commands:${RESET}
  install, i <skill>    Install a skill from askill.sh
  remove, rm <skill>    Remove an installed skill
  list, ls              List installed skills
  search, s [query]     Search for skills
  info <skill>          Show skill details
  run <skill:cmd>       Run a skill command
  update                Update askill CLI

${BOLD}Skill Slug Formats:${RESET}
  @scope/name                       Published skill
  gh:owner/repo/path                Indexed from GitHub

${BOLD}Install Options:${RESET}
  -g, --global          Install globally (user-level)
  -a, --agent <agents>  Install to specific agents
  -y, --yes             Skip confirmation prompts
  --copy                Copy files instead of symlink

${BOLD}Run Options:${RESET}
  askill run <skill>:<command>      Run a skill's command

${BOLD}Options:${RESET}
  --help, -h            Show this help message
  --version, -v         Show version number

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} askill install @anthropic/memory
  ${DIM}$${RESET} askill install gh:facebook/react/scripts/errors
  ${DIM}$${RESET} askill search memory
  ${DIM}$${RESET} askill run @anthropic/memory:save --key foo --value bar
  ${DIM}$${RESET} askill list -g
  ${DIM}$${RESET} askill info @anthropic/memory

${DIM}Browse more at${RESET} ${CYAN}https://askill.sh${RESET}
`);
}

// ============================================
// Install Command
// ============================================

/**
 * Parse skill identifier to determine the format:
 * - "extract-errors" -> { type: 'short', name: 'extract-errors' }
 * - "facebook/react" -> { type: 'repo', owner: 'facebook', repo: 'react' }
 * - "facebook/react@extract-errors" -> { type: 'at', owner: 'facebook', repo: 'react', skill: 'extract-errors' }
 * - "facebook/react/scripts/errors" -> { type: 'full', slug: 'facebook/react/scripts/errors' }
 */
interface SkillIdentifier {
  type: 'short' | 'repo' | 'at' | 'full';
  name?: string;
  owner?: string;
  repo?: string;
  skill?: string;
  slug?: string;
}

function parseSkillIdentifier(input: string): SkillIdentifier {
  // Check for @ format: owner/repo@skill-name
  if (input.includes('@')) {
    const [repoPath, skillName] = input.split('@');
    const parts = repoPath.split('/');
    if (parts.length === 2) {
      return { type: 'at', owner: parts[0], repo: parts[1], skill: skillName };
    }
  }

  const parts = input.split('/');

  // Single part: short name
  if (parts.length === 1) {
    return { type: 'short', name: input };
  }

  // Two parts: owner/repo
  if (parts.length === 2) {
    return { type: 'repo', owner: parts[0], repo: parts[1] };
  }

  // Three or more parts: full path (owner/repo/path...)
  return { type: 'full', slug: input, owner: parts[0], repo: parts[1] };
}

interface InstallOptions {
  global?: boolean;
  agent?: string[];
  yes?: boolean;
  copy?: boolean;
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
    } else if (arg === '-a' || arg === '--agent') {
      options.agent = [];
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        options.agent.push(args[i]);
      }
    } else if (!arg.startsWith('-')) {
      skillName = arg;
    }
  }

  return { skillName, options };
}

async function runInstall(args: string[]): Promise<void> {
  const { skillName, options } = parseInstallOptions(args);

  if (!skillName) {
    console.log(`${RED}Error: Missing skill identifier${RESET}`);
    console.log(`Usage: spm install <skill>`);
    console.log(`\nFormats supported:`);
    console.log(`  spm install extract-errors               ${DIM}# short name${RESET}`);
    console.log(`  spm install facebook/react               ${DIM}# list repo skills${RESET}`);
    console.log(`  spm install facebook/react@extract-errors  ${DIM}# specific skill${RESET}`);
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' spm install ')));

  const spinner = p.spinner();
  const identifier = parseSkillIdentifier(skillName);

  let skillsToInstall: Array<{ slug: string; name: string; description: string }> = [];

  // Handle different identifier types
  if (identifier.type === 'repo') {
    // List all skills in repo and let user select
    spinner.start(`Fetching skills from ${identifier.owner}/${identifier.repo}...`);

    try {
      const repoData = await api.getRepoSkills(identifier.owner!, identifier.repo!);
      spinner.stop(`Found ${repoData.skills.length} skill(s) in ${pc.cyan(`${identifier.owner}/${identifier.repo}`)}`);

      if (repoData.skills.length === 0) {
        p.log.warning('No skills found in this repository');
        p.outro(`Browse skills at ${pc.cyan('https://askill.sh')}`);
        return;
      }

      if (repoData.skills.length === 1 || options.yes) {
        // Single skill or --yes: install all
        skillsToInstall = repoData.skills.map((s) => ({
          slug: `${repoData.owner}/${repoData.repo}@${s.name}`,
          name: s.name || 'unknown',
          description: s.description || '',
        }));
        if (repoData.skills.length === 1) {
          p.log.info(`Installing: ${pc.cyan(repoData.skills[0].name)}`);
        } else {
          p.log.info(`Installing ${repoData.skills.length} skills`);
        }
      } else {
        // Multiple skills: let user select
        const selected = await p.multiselect({
          message: 'Select skills to install',
          options: repoData.skills.map((s) => ({
            value: s,
            label: s.name || 'unknown',
            hint: (s.description || '').slice(0, 60) + ((s.description || '').length > 60 ? '...' : ''),
          })),
        });

        if (p.isCancel(selected)) {
          p.cancel('Installation cancelled');
          process.exit(0);
        }

        skillsToInstall = (selected as RepoSkill[]).map((s) => ({
          slug: `${repoData.owner}/${repoData.repo}@${s.name}`,
          name: s.name || 'unknown',
          description: s.description || '',
        }));
      }
    } catch (error) {
      if (error instanceof APIError && error.status === 404) {
        spinner.stop(pc.red('Repository not found'));
        p.outro(pc.red(`Repository "${identifier.owner}/${identifier.repo}" not found on askill.sh`));
        process.exit(1);
      }
      throw error;
    }
  } else {
    // Short name, @ format, or full path - resolve to single skill
    let slug: string;

    if (identifier.type === 'at') {
      slug = `${identifier.owner}/${identifier.repo}@${identifier.skill}`;
    } else if (identifier.type === 'full') {
      slug = identifier.slug!;
    } else {
      slug = identifier.name!;
    }

    spinner.start(`Fetching skill: ${slug}...`);

    try {
      const skill = await api.getSkill(slug);
      spinner.stop(`Found: ${pc.cyan(skill.name)}`);

      // Build slug for fetching raw content
      const skillSlug = skill.owner && skill.repo && skill.name
        ? `${skill.owner}/${skill.repo}@${skill.name}`
        : String(skill.id);

      skillsToInstall = [{
        slug: skillSlug,
        name: skill.name || 'unknown',
        description: skill.description || '',
      }];

      // Show skill info
      p.log.info(`${pc.cyan(skill.name)} by ${skill.owner || 'unknown'}`);
      if (skill.description) {
        p.log.message(pc.dim(skill.description));
      }
    } catch (error) {
      if (error instanceof APIError && error.status === 404) {
        spinner.stop(pc.red('Skill not found'));
        p.outro(pc.red(`Skill "${slug}" not found on askill.sh`));
        process.exit(1);
      }
      throw error;
    }
  }

  if (skillsToInstall.length === 0) {
    p.log.warning('No skills selected');
    p.outro('');
    return;
  }

  // Detect agents
  let targetAgents: AgentType[];
  const validAgents = Object.keys(agents) as AgentType[];

  if (options.agent && options.agent.length > 0) {
    const invalidAgents = options.agent.filter((a) => !validAgents.includes(a as AgentType));
    if (invalidAgents.length > 0) {
      p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
      p.log.info(`Valid agents: ${validAgents.slice(0, 10).join(', ')}...`);
      process.exit(1);
    }
    targetAgents = options.agent as AgentType[];
  } else {
    spinner.start('Detecting installed agents...');
    const installedAgents = await detectInstalledAgents();
    spinner.stop(`Found ${installedAgents.length} agent(s)`);

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
          process.exit(0);
        }

        targetAgents = selected as AgentType[];
      }
    } else if (installedAgents.length === 1 || options.yes) {
      targetAgents = installedAgents;
      p.log.info(`Installing to: ${targetAgents.map((a) => pc.cyan(agents[a].displayName)).join(', ')}`);
    } else {
      const selected = await p.multiselect({
        message: 'Select agents to install to',
        options: installedAgents.map((a) => ({
          value: a,
          label: agents[a].displayName,
        })),
        initialValues: installedAgents,
      });

      if (p.isCancel(selected)) {
        p.cancel('Installation cancelled');
        process.exit(0);
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
      process.exit(0);
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
      process.exit(0);
    }
  }

  // Install each skill
  spinner.start('Installing...');

  const allResults: Array<{ skill: string; agent: string; success: boolean; error?: string }> = [];

  for (const skillInfo of skillsToInstall) {
    // Fetch SKILL.md content for each skill
    let content: string;
    try {
      content = await api.getSkillRaw(skillInfo.slug);
    } catch (error) {
      for (const agent of targetAgents) {
        allResults.push({ skill: skillInfo.name, agent, success: false, error: 'Failed to fetch SKILL.md' });
      }
      continue;
    }

    for (const agent of targetAgents) {
      const result = await installSkill(skillInfo.name, content, agent, {
        global: installGlobally,
        mode: installMode,
      });
      allResults.push({ skill: skillInfo.name, agent, ...result });
    }
  }

  spinner.stop('Installation complete');

  // Show results
  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log();
    const skillCount = new Set(successful.map((r) => r.skill)).size;
    const agentCount = new Set(successful.map((r) => r.agent)).size;
    p.log.success(pc.green(`Installed ${skillCount} skill(s) to ${agentCount} agent(s)`));

    // Group by skill
    const bySkill = successful.reduce((acc, r) => {
      if (!acc[r.skill]) acc[r.skill] = [];
      acc[r.skill].push(r.agent);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [skill, agentList] of Object.entries(bySkill)) {
      console.log(`  ${pc.green('✓')} ${skill}`);
      for (const agent of agentList) {
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

  console.log();
  p.outro(pc.green('Done!'));
}

// ============================================
// Search Command
// ============================================

async function runSearch(args: string[]): Promise<void> {
  const query = args.join(' ');

  console.log();
  p.intro(pc.bgCyan(pc.black(' spm search ')));

  const spinner = p.spinner();
  spinner.start(query ? `Searching for "${query}"...` : 'Loading skills...');

  try {
    const response = query
      ? await api.search(query, 20)
      : await api.listSkills({ limit: 20 });

    const skills = response.data || [];
    spinner.stop(`Found ${skills.length} result(s)`);

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

      console.log(`  ${pc.cyan(displayName)} ${pc.dim(`by ${owner}`)}`);
      if (description) {
        console.log(`  ${pc.dim(description.slice(0, 80))}${description.length > 80 ? '...' : ''}`);
      }
      // Build install command
      const installCmd = skill.owner && skill.repo
        ? `${skill.owner}/${skill.repo}@${displayName}`
        : displayName;
      console.log(`  ${pc.dim('spm install')} ${installCmd}`);
      console.log();
    }

    p.outro(`Browse more at ${pc.cyan('https://askill.sh')}`);
  } catch (error) {
    spinner.stop(pc.red('Search failed'));
    if (error instanceof Error) {
      console.log(pc.red(error.message));
    }
    process.exit(1);
  }
}

// ============================================
// List Command
// ============================================

async function runList(args: string[]): Promise<void> {
  const isGlobal = args.includes('-g') || args.includes('--global');

  console.log();
  p.intro(pc.bgCyan(pc.black(' spm list ')));

  const spinner = p.spinner();
  spinner.start('Loading installed skills...');

  const skills = await listInstalledSkills({ global: isGlobal ? true : undefined });
  spinner.stop(`Found ${skills.length} skill(s)`);

  if (skills.length === 0) {
    p.log.info('No skills installed');
    p.outro(`Install skills with ${pc.cyan('spm install <skill>')}`);
    return;
  }

  console.log();
  for (const skill of skills) {
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

async function runRemove(args: string[]): Promise<void> {
  const isGlobal = args.includes('-g') || args.includes('--global');
  const skillName = args.find((a) => !a.startsWith('-'));

  if (!skillName) {
    console.log(`${RED}Error: Missing skill name${RESET}`);
    console.log(`Usage: spm remove <skill-name>`);
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' spm remove ')));

  const spinner = p.spinner();
  spinner.start('Detecting agents...');

  const installedAgents = await detectInstalledAgents();
  spinner.stop(`Found ${installedAgents.length} agent(s)`);

  // Find which agents have this skill
  const agentsWithSkill: AgentType[] = [];
  for (const agent of installedAgents) {
    if (await isSkillInstalled(skillName, agent, { global: isGlobal })) {
      agentsWithSkill.push(agent);
    }
  }

  if (agentsWithSkill.length === 0) {
    p.log.info(`Skill "${skillName}" not found`);
    p.outro('');
    return;
  }

  // Confirm removal
  const confirmed = await p.confirm({
    message: `Remove ${pc.cyan(skillName)} from ${agentsWithSkill.length} agent(s)?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Removal cancelled');
    process.exit(0);
  }

  spinner.start('Removing...');

  for (const agent of agentsWithSkill) {
    await removeSkill(skillName, agent, { global: isGlobal });
  }

  spinner.stop('Removed');
  p.outro(pc.green(`Removed ${skillName} from ${agentsWithSkill.length} agent(s)`));
}

// ============================================
// Info Command
// ============================================

async function runInfo(args: string[]): Promise<void> {
  const skillName = args[0];

  if (!skillName) {
    console.log(`${RED}Error: Missing skill name${RESET}`);
    console.log(`Usage: spm info <skill-name>`);
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' spm info ')));

  const spinner = p.spinner();
  spinner.start(`Fetching ${skillName}...`);

  try {
    const skill = await api.getSkill(skillName);
    spinner.stop('');

    const displayName = skill.name || 'unknown';
    const owner = skill.owner || 'unknown';
    const repo = skill.repo || '';

    console.log();
    console.log(`  ${pc.bold(displayName)}`);
    if (skill.description) {
      console.log(`  ${pc.dim(skill.description)}`);
    }
    console.log();
    console.log(`  ${pc.dim('Owner:')}      ${owner}`);
    if (repo) {
      console.log(`  ${pc.dim('Repository:')} ${owner}/${repo}`);
    }
    if (skill.stars !== null && skill.stars !== undefined) {
      console.log(`  ${pc.dim('Stars:')}      ${skill.stars.toLocaleString()}`);
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
    console.log(`  ${pc.dim('Install:')}    ${pc.cyan(`spm install ${installCmd}`)}`);
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
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for updates in background (non-blocking)
  checkForUpdates().catch(() => {});

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

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

    case 'update':
    case 'upgrade':
      await selfUpdate();
      break;

    case '--help':
    case '-h':
    case 'help':
      showHelp();
      break;

    case '--version':
    case '-v':
    case 'version':
      console.log(VERSION);
      break;

    default:
      console.log(`${RED}Unknown command: ${command}${RESET}`);
      console.log(`Run ${CYAN}spm --help${RESET} for usage.`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`${RED}Error: ${error.message}${RESET}`);
  process.exit(1);
});
