// Auto-updater module for askill CLI

import { existsSync, createWriteStream, unlinkSync, chmodSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import semver from 'semver';
import { VERSION, CYAN, GREEN, YELLOW, RED, RESET, DIM } from './constants.ts';
import { getPlatformKey } from './platform.ts';

const UPDATE_CHECK_FILE = join(homedir(), '.askill', 'last-update-check');
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_REPO = 'avibe-bot/askill';

interface VersionInfo {
  latest: string;
  minimum: string;
  releaseNotes: string;
  releaseUrl?: string;
  downloadUrls: Record<string, string>;
}

export interface AvailableUpdate {
  current: string;
  latest: string;
  minimum: string;
  releaseNotes: string;
  releaseUrl?: string;
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
 * Fetch version info from API, fallback to GitHub
 */
async function fetchVersionInfo(): Promise<VersionInfo | null> {
  // Try askill.sh API first
  try {
    const response = await fetch('https://askill.sh/api/v1/cli/version', {
      headers: { 'User-Agent': `askill/${VERSION}` },
    });

    if (response.ok) {
      return response.json();
    }
  } catch {
    // API failed, try GitHub directly
  }

  // Fallback: fetch from GitHub releases
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'User-Agent': `askill/${VERSION}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) return null;

    const release = await response.json();
    const latest = release.tag_name.replace(/^v/, '');

    // Build download URLs from assets
    const downloadUrls: Record<string, string> = {};
    for (const asset of release.assets || []) {
      const platforms = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'];
      for (const p of platforms) {
        if (asset.name.includes(p)) {
          downloadUrls[p] = asset.browser_download_url;
        }
      }
    }

    return {
      latest,
      minimum: '0.1.0',
      releaseNotes: release.body?.slice(0, 500) || `Release ${latest}`,
      releaseUrl: release.html_url,
      downloadUrls,
    };
  } catch {
    return null;
  }
}

/**
 * Check for updates and notify user
 */
export async function checkForUpdates(force: boolean = false): Promise<void> {
  const available = await getAvailableUpdate(force);
  if (!available) return;

  if (semver.lt(available.current, available.latest)) {
    console.log();
    console.log(`${YELLOW}╭───────────────────────────────────────────╮${RESET}`);
    console.log(`${YELLOW}│${RESET}  Update available: ${DIM}${available.current}${RESET} → ${GREEN}${available.latest}${RESET}        ${YELLOW}│${RESET}`);
    console.log(`${YELLOW}│${RESET}  Run ${CYAN}askill upgrade${RESET} to update             ${YELLOW}│${RESET}`);
    console.log(`${YELLOW}╰───────────────────────────────────────────╯${RESET}`);
    console.log();
  }
}

/**
 * Get update information if a newer version is available.
 * Returns null when no check is needed, no update exists, or remote info is unavailable.
 */
export async function getAvailableUpdate(force: boolean = false): Promise<AvailableUpdate | null> {
  if (!force && !(await shouldCheckUpdate())) {
    return null;
  }

  await saveUpdateCheckTime();

  const versionInfo = await fetchVersionInfo();
  if (!versionInfo) return null;

  const current = VERSION;

  // Check minimum version requirement
  if (semver.lt(current, versionInfo.minimum)) {
    console.log(`${RED}Your askill version is too old. Please update to continue.${RESET}`);
    console.log(`Minimum required: ${versionInfo.minimum}`);
    process.exit(1);
  }

  if (!semver.lt(current, versionInfo.latest)) {
    return null;
  }

  return {
    current,
    latest: versionInfo.latest,
    minimum: versionInfo.minimum,
    releaseNotes: versionInfo.releaseNotes,
    releaseUrl: versionInfo.releaseUrl,
  };
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
    console.log(`Please update manually:`);
    console.log(`  ${CYAN}curl -fsSL https://askill.sh | sh${RESET}`);
    console.log(`  ${DIM}or${RESET}`);
    console.log(`  ${CYAN}npm install -g askill-cli@latest${RESET}`);
    return false;
  }

  try {
    // Get current executable path
    const execPath = process.execPath;
    const isNodeProcess = execPath.includes('node') || execPath.includes('bun');

    if (isNodeProcess) {
      // Running via node/bun - suggest npm update
      console.log(`${YELLOW}Running via Node.js runtime${RESET}`);
      console.log(`Please update using: ${CYAN}npm install -g askill-cli@latest${RESET}`);
      return false;
    }

    // Download new binary
    const tempPath = `${execPath}.new`;
    const backupPath = `${execPath}.backup`;

    console.log(`Downloading ${platformKey} binary...`);

    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': `askill/${VERSION}` },
      redirect: 'follow',
    });
    
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
    if (versionInfo.releaseNotes) {
      console.log(`${DIM}Release notes: ${versionInfo.releaseNotes.slice(0, 200)}${RESET}`);
    }
    return true;
  } catch (error) {
    console.log(`${RED}Update failed: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}`);
    console.log(`Please update manually:`);
    console.log(`  ${CYAN}curl -fsSL https://askill.sh | sh${RESET}`);
    console.log(`  ${DIM}or${RESET}`);
    console.log(`  ${CYAN}npm install -g askill-cli@latest${RESET}`);
    return false;
  }
}
