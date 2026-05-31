// askill CLI Constants and Configuration

export const VERSION = '0.1.14';
const registryUrlOverride = process.env.ASKILL_REGISTRY_URL?.trim();
const apiBaseUrlOverride = process.env.ASKILL_API_BASE_URL?.trim();

export const REGISTRY_URL = registryUrlOverride || 'https://askill.sh';
export const API_BASE_URL = apiBaseUrlOverride || `${REGISTRY_URL}/api/v1`;

// ANSI Colors
export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const CYAN = '\x1b[36m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const RED = '\x1b[31m';
export const GRAY = '\x1b[90m';

// Supported AI Agents configuration
// Based on Vercel Skills - supports 40+ agents
export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;
  globalSkillsDir?: string;
  detectInstalled: () => Promise<boolean>;
}

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const home = homedir();
// Use XDG base directory spec for config paths
const configHome = process.env.XDG_CONFIG_HOME || join(home, '.config');
// Support environment variables for custom paths
const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex');
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude');

export const agents: Record<string, AgentConfig> = {
  // === Popular Agents ===
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    globalSkillsDir: join(claudeHome, 'skills'),
    detectInstalled: async () => existsSync(claudeHome),
  },
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    globalSkillsDir: join(home, '.cursor/skills'),
    detectInstalled: async () => existsSync(join(home, '.cursor')),
  },
  windsurf: {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    globalSkillsDir: join(home, '.codeium/windsurf/skills'),
    detectInstalled: async () => existsSync(join(home, '.codeium/windsurf')),
  },
  opencode: {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    globalSkillsDir: join(configHome, 'opencode/skills'),
    detectInstalled: async () => existsSync(join(configHome, 'opencode')) || existsSync(join(claudeHome, 'skills')),
  },
  codex: {
    name: 'codex',
    displayName: 'Codex',
    skillsDir: '.codex/skills',
    globalSkillsDir: join(codexHome, 'skills'),
    detectInstalled: async () => existsSync(codexHome) || existsSync('/etc/codex'),
  },
  cline: {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.cline/skills',
    globalSkillsDir: join(home, '.cline/skills'),
    detectInstalled: async () => existsSync(join(home, '.cline')),
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    skillsDir: '.gemini/skills',
    globalSkillsDir: join(home, '.gemini/skills'),
    detectInstalled: async () => existsSync(join(home, '.gemini')),
  },
  goose: {
    name: 'goose',
    displayName: 'Goose',
    skillsDir: '.goose/skills',
    globalSkillsDir: join(configHome, 'goose/skills'),
    detectInstalled: async () => existsSync(join(configHome, 'goose')),
  },
  amp: {
    name: 'amp',
    displayName: 'Amp',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(configHome, 'agents/skills'),
    detectInstalled: async () => existsSync(join(configHome, 'amp')),
  },
  roo: {
    name: 'roo',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    globalSkillsDir: join(home, '.roo/skills'),
    detectInstalled: async () => existsSync(join(home, '.roo')),
  },

  // === Additional Agents ===
  antigravity: {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    globalSkillsDir: join(home, '.gemini/antigravity/global_skills'),
    detectInstalled: async () => existsSync(join(process.cwd(), '.agent')) || existsSync(join(home, '.gemini/antigravity')),
  },
  augment: {
    name: 'augment',
    displayName: 'Augment',
    skillsDir: '.augment/rules',
    globalSkillsDir: join(home, '.augment/rules'),
    detectInstalled: async () => existsSync(join(home, '.augment')),
  },
  codebuddy: {
    name: 'codebuddy',
    displayName: 'CodeBuddy',
    skillsDir: '.codebuddy/skills',
    globalSkillsDir: join(home, '.codebuddy/skills'),
    detectInstalled: async () => existsSync(join(process.cwd(), '.codebuddy')) || existsSync(join(home, '.codebuddy')),
  },
  'command-code': {
    name: 'command-code',
    displayName: 'Command Code',
    skillsDir: '.commandcode/skills',
    globalSkillsDir: join(home, '.commandcode/skills'),
    detectInstalled: async () => existsSync(join(home, '.commandcode')),
  },
  continue: {
    name: 'continue',
    displayName: 'Continue',
    skillsDir: '.continue/skills',
    globalSkillsDir: join(home, '.continue/skills'),
    detectInstalled: async () => existsSync(join(process.cwd(), '.continue')) || existsSync(join(home, '.continue')),
  },
  crush: {
    name: 'crush',
    displayName: 'Crush',
    skillsDir: '.crush/skills',
    globalSkillsDir: join(home, '.config/crush/skills'),
    detectInstalled: async () => existsSync(join(home, '.config/crush')),
  },
  droid: {
    name: 'droid',
    displayName: 'Droid',
    skillsDir: '.factory/skills',
    globalSkillsDir: join(home, '.factory/skills'),
    detectInstalled: async () => existsSync(join(home, '.factory')),
  },
  'github-copilot': {
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    skillsDir: '.github/skills',
    globalSkillsDir: join(home, '.copilot/skills'),
    detectInstalled: async () => existsSync(join(process.cwd(), '.github')) || existsSync(join(home, '.copilot')),
  },
  junie: {
    name: 'junie',
    displayName: 'Junie',
    skillsDir: '.junie/skills',
    globalSkillsDir: join(home, '.junie/skills'),
    detectInstalled: async () => existsSync(join(home, '.junie')),
  },
  'iflow-cli': {
    name: 'iflow-cli',
    displayName: 'iFlow CLI',
    skillsDir: '.iflow/skills',
    globalSkillsDir: join(home, '.iflow/skills'),
    detectInstalled: async () => existsSync(join(home, '.iflow')),
  },
  kilo: {
    name: 'kilo',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    globalSkillsDir: join(home, '.kilocode/skills'),
    detectInstalled: async () => existsSync(join(home, '.kilocode')),
  },
  'kimi-cli': {
    name: 'kimi-cli',
    displayName: 'Kimi Code CLI',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(home, '.config/agents/skills'),
    detectInstalled: async () => existsSync(join(home, '.kimi')),
  },
  'kiro-cli': {
    name: 'kiro-cli',
    displayName: 'Kiro CLI',
    skillsDir: '.kiro/skills',
    globalSkillsDir: join(home, '.kiro/skills'),
    detectInstalled: async () => existsSync(join(home, '.kiro')),
  },
  kode: {
    name: 'kode',
    displayName: 'Kode',
    skillsDir: '.kode/skills',
    globalSkillsDir: join(home, '.kode/skills'),
    detectInstalled: async () => existsSync(join(home, '.kode')),
  },
  mcpjam: {
    name: 'mcpjam',
    displayName: 'MCPJam',
    skillsDir: '.mcpjam/skills',
    globalSkillsDir: join(home, '.mcpjam/skills'),
    detectInstalled: async () => existsSync(join(home, '.mcpjam')),
  },
  'mistral-vibe': {
    name: 'mistral-vibe',
    displayName: 'Mistral Vibe',
    skillsDir: '.vibe/skills',
    globalSkillsDir: join(home, '.vibe/skills'),
    detectInstalled: async () => existsSync(join(home, '.vibe')),
  },
  mux: {
    name: 'mux',
    displayName: 'Mux',
    skillsDir: '.mux/skills',
    globalSkillsDir: join(home, '.mux/skills'),
    detectInstalled: async () => existsSync(join(home, '.mux')),
  },
  openclaw: {
    name: 'openclaw',
    displayName: 'OpenClaw',
    skillsDir: 'skills',
    globalSkillsDir: existsSync(join(home, '.openclaw'))
      ? join(home, '.openclaw/skills')
      : existsSync(join(home, '.clawdbot'))
        ? join(home, '.clawdbot/skills')
        : join(home, '.moltbot/skills'),
    detectInstalled: async () => existsSync(join(home, '.openclaw')) || existsSync(join(home, '.clawdbot')) || existsSync(join(home, '.moltbot')),
  },
  openclaude: {
    name: 'openclaude',
    displayName: 'OpenClaude IDE',
    skillsDir: '.openclaude/skills',
    globalSkillsDir: join(home, '.openclaude/skills'),
    detectInstalled: async () => existsSync(join(home, '.openclaude')) || existsSync(join(process.cwd(), '.openclaude')),
  },
  openhands: {
    name: 'openhands',
    displayName: 'OpenHands',
    skillsDir: '.openhands/skills',
    globalSkillsDir: join(home, '.openhands/skills'),
    detectInstalled: async () => existsSync(join(home, '.openhands')),
  },
  pi: {
    name: 'pi',
    displayName: 'Pi',
    skillsDir: '.pi/skills',
    globalSkillsDir: join(home, '.pi/agent/skills'),
    detectInstalled: async () => existsSync(join(home, '.pi/agent')),
  },
  qoder: {
    name: 'qoder',
    displayName: 'Qoder',
    skillsDir: '.qoder/skills',
    globalSkillsDir: join(home, '.qoder/skills'),
    detectInstalled: async () => existsSync(join(home, '.qoder')),
  },
  'qwen-code': {
    name: 'qwen-code',
    displayName: 'Qwen Code',
    skillsDir: '.qwen/skills',
    globalSkillsDir: join(home, '.qwen/skills'),
    detectInstalled: async () => existsSync(join(home, '.qwen')),
  },
  replit: {
    name: 'replit',
    displayName: 'Replit',
    skillsDir: '.agent/skills',
    globalSkillsDir: undefined, // No global support
    detectInstalled: async () => existsSync(join(process.cwd(), '.agent')),
  },
  trae: {
    name: 'trae',
    displayName: 'Trae',
    skillsDir: '.trae/skills',
    globalSkillsDir: join(home, '.trae/skills'),
    detectInstalled: async () => existsSync(join(home, '.trae')),
  },
  'trae-cn': {
    name: 'trae-cn',
    displayName: 'Trae CN',
    skillsDir: '.trae/skills',
    globalSkillsDir: join(home, '.trae-cn/skills'),
    detectInstalled: async () => existsSync(join(home, '.trae-cn')),
  },
  zencoder: {
    name: 'zencoder',
    displayName: 'Zencoder',
    skillsDir: '.zencoder/skills',
    globalSkillsDir: join(home, '.zencoder/skills'),
    detectInstalled: async () => existsSync(join(home, '.zencoder')),
  },
  neovate: {
    name: 'neovate',
    displayName: 'Neovate',
    skillsDir: '.neovate/skills',
    globalSkillsDir: join(home, '.neovate/skills'),
    detectInstalled: async () => existsSync(join(home, '.neovate')),
  },
  pochi: {
    name: 'pochi',
    displayName: 'Pochi',
    skillsDir: '.pochi/skills',
    globalSkillsDir: join(home, '.pochi/skills'),
    detectInstalled: async () => existsSync(join(home, '.pochi')),
  },
  adal: {
    name: 'adal',
    displayName: 'AdaL',
    skillsDir: '.adal/skills',
    globalSkillsDir: join(home, '.adal/skills'),
    detectInstalled: async () => existsSync(join(home, '.adal')),
  },
};

export type AgentType = keyof typeof agents;

// Canonical skills directory
export const AGENTS_DIR = '.agents';
export const SKILLS_SUBDIR = 'skills';

// Hot agents for default pre-selection (intersect with installed agents)
export const POPULAR_AGENTS: AgentType[] = [
  'claude-code',
  'codex',
  'openclaw',
  'opencode',
];
