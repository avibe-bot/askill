// Auto-updater module for askill CLI

import { existsSync, createWriteStream, unlinkSync, chmodSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform, arch } from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import semver from 'semver';
import { VERSION, CYAN, GREEN, YELLOW, RED, RESET, DIM } from './constants.ts';

const UPDATE_CHECK_FILE = join(homedir(), '.askill', 'last-update-check');
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface VersionInfo {
  latest: string;
  minimum: string;
  releaseNotes: string;
  downloadUrls: Record<string, string>;
}

/**
 * Get platform key for download URL
 */
function getPlatformKey(): string {
  const p = platform();
  const a = arch();

  if (p === 'darwin') {
    return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (p === 'linux') {
    return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else if (p === 'win32') {
    return 'win32-x64';
  }

  return `${p}-${a}`;
}

/**
 * Check if update check is needed
 */
async function shouldCheckUpdate(): Promise<boolean> {
  try {
    const { readFile } = await import('fs/promises');
    const lastCheck = await readFile(UPDATE_CHECK_FILE, 'utf-8');
    const lastCheckTime = parseInt(lastCheck, 10);
    return Date.now() - lastCheckTime > UPDATE_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Save last update check time
 */
async function saveUpdateCheckTime(): Promise<void> {
  try {
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(dirname(UPDATE_CHECK_FILE), { recursive: true });
    await writeFile(UPDATE_CHECK_FILE, String(Date.now()), 'utf-8');
  } catch {
    // Ignore errors
  }
}

/**
 * Fetch version info from API
 */
async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    const response = await fetch('https://askill.sh/api/v1/cli/version', {
      headers: { 'User-Agent': `askill/${VERSION}` },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Check for updates and notify user
 */
export async function checkForUpdates(force: boolean = false): Promise<void> {
  if (!force && !(await shouldCheckUpdate())) {
    return;
  }

  await saveUpdateCheckTime();

  const versionInfo = await fetchVersionInfo();
  if (!versionInfo) return;

  const current = VERSION;
  const latest = versionInfo.latest;

  if (semver.lt(current, latest)) {
    console.log();
    console.log(`${YELLOW}╭───────────────────────────────────────────╮${RESET}`);
    console.log(`${YELLOW}│${RESET}  Update available: ${DIM}${current}${RESET} → ${GREEN}${latest}${RESET}        ${YELLOW}│${RESET}`);
    console.log(`${YELLOW}│${RESET}  Run ${CYAN}askill update${RESET} to update               ${YELLOW}│${RESET}`);
    console.log(`${YELLOW}╰───────────────────────────────────────────╯${RESET}`);
    console.log();
  }

  // Check minimum version requirement
  if (semver.lt(current, versionInfo.minimum)) {
    console.log(`${RED}Your askill version is too old. Please update to continue.${RESET}`);
    console.log(`Minimum required: ${versionInfo.minimum}`);
    process.exit(1);
  }
}

/**
 * Self-update the CLI binary
 */
export async function selfUpdate(): Promise<boolean> {
  console.log(`${CYAN}Checking for updates...${RESET}`);

  const versionInfo = await fetchVersionInfo();
  if (!versionInfo) {
    console.log(`${RED}Failed to check for updates${RESET}`);
    return false;
  }

  const current = VERSION;
  const latest = versionInfo.latest;

  if (semver.gte(current, latest)) {
    console.log(`${GREEN}You are already on the latest version (${current})${RESET}`);
    return true;
  }

  console.log(`Updating from ${DIM}${current}${RESET} to ${GREEN}${latest}${RESET}...`);

  const platformKey = getPlatformKey();
  const downloadUrl = versionInfo.downloadUrls[platformKey];

  if (!downloadUrl) {
    console.log(`${RED}No download available for your platform (${platformKey})${RESET}`);
    console.log(`Please update manually: npm install -g askill@latest`);
    return false;
  }

  try {
    // Get current executable path
    const execPath = process.execPath;
    const isNodeProcess = execPath.includes('node') || execPath.includes('bun');

    if (isNodeProcess) {
      // Running via node/bun - suggest npm update
      console.log(`${YELLOW}Running via Node.js runtime${RESET}`);
      console.log(`Please update using: ${CYAN}npm install -g askill@latest${RESET}`);
      return false;
    }

    // Download new binary
    const tempPath = `${execPath}.new`;
    const backupPath = `${execPath}.backup`;

    console.log(`Downloading ${platformKey} binary...`);

    const response = await fetch(downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // Write to temp file
    const writer = createWriteStream(tempPath);
    await pipeline(Readable.fromWeb(response.body as any), writer);

    // Make executable
    chmodSync(tempPath, 0o755);

    // Backup current binary
    if (existsSync(execPath)) {
      renameSync(execPath, backupPath);
    }

    // Replace with new binary
    renameSync(tempPath, execPath);

    // Remove backup
    try {
      unlinkSync(backupPath);
    } catch {
      // Ignore
    }

    console.log(`${GREEN}Successfully updated to v${latest}!${RESET}`);
    console.log(`${DIM}Release notes: ${versionInfo.releaseNotes}${RESET}`);
    return true;
  } catch (error) {
    console.log(`${RED}Update failed: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}`);
    console.log(`Please update manually: npm install -g askill@latest`);
    return false;
  }
}
