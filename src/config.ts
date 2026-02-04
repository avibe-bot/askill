// Config module - handles persistent user preferences
// Stores config in ~/.config/askill/config.json

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { AgentType } from './constants.ts';

const CONFIG_DIR = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const ASKILL_CONFIG_DIR = join(CONFIG_DIR, 'askill');
const CONFIG_FILE = join(ASKILL_CONFIG_DIR, 'config.json');

export interface AskillConfig {
  preferredAgents?: AgentType[];
  lastUpdated?: string;
}

/**
 * Load config from ~/.config/askill/config.json
 */
export async function loadConfig(): Promise<AskillConfig> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as AskillConfig;
  } catch {
    // File doesn't exist or invalid JSON
    return {};
  }
}

/**
 * Save config to ~/.config/askill/config.json
 */
export async function saveConfig(config: AskillConfig): Promise<void> {
  try {
    await mkdir(ASKILL_CONFIG_DIR, { recursive: true });
    config.lastUpdated = new Date().toISOString();
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Silently fail - config is not critical
  }
}

/**
 * Get preferred agents from config
 */
export async function getPreferredAgents(): Promise<AgentType[] | undefined> {
  const config = await loadConfig();
  return config.preferredAgents;
}

/**
 * Save preferred agents to config
 */
export async function savePreferredAgents(agents: AgentType[]): Promise<void> {
  const config = await loadConfig();
  config.preferredAgents = agents;
  await saveConfig(config);
}
