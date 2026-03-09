// Git module - handles repository cloning for skill installation

import { execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { join, normalize, resolve, sep } from 'path';
import { tmpdir } from 'os';

const CLONE_TIMEOUT_MS = 60_000; // 60 seconds

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = 'GitCloneError';
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

/**
 * Clone a git repository to a temporary directory.
 * Uses partial clone (`--filter=blob:none`) to avoid downloading all blobs,
 * and supports sparse checkout for a specific subpath.
 */
export async function cloneRepo(url: string, ref?: string, subpath?: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'askill-'));
  const args = ['clone', '--depth', '1', '--no-checkout', '--filter=blob:none'];

  if (ref) {
    args.push('--branch', ref);
  }

  args.push(url, tempDir);

  try {
    try {
      await execGit(args);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const filterUnsupported =
        message.includes('filter') ||
        message.includes('blob:none') ||
        message.includes('partial clone') ||
        message.includes('uploadpack.allowfilter');

      if (!filterUnsupported) {
        throw error;
      }

      // Fallback for servers that don't support partial clone filters.
      const fallbackArgs = args.filter((arg) => arg !== '--filter=blob:none');
      await execGit(fallbackArgs);
    }

    const sparseSubpath = normalizeSparseSubpath(subpath);
    if (sparseSubpath) {
      try {
        await execGit(['-C', tempDir, 'sparse-checkout', 'init', '--no-cone']);
        await execGit(['-C', tempDir, 'sparse-checkout', 'set', '--no-cone', sparseSubpath]);
      } catch {
        // Sparse checkout is best-effort; fall back to full checkout.
        await execGit(['-C', tempDir, 'sparse-checkout', 'disable']).catch(() => {});
      }
    }

    await execGit(['-C', tempDir, 'checkout']);
    return tempDir;
  } catch (error) {
    // Clean up temp dir on failure
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('timeout');
    const isAuthError =
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('could not read Username') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Repository not found');

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This may happen with private repos.\n` +
          `  Ensure SSH keys or credentials are configured.`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  For SSH: Check keys with 'ssh -T git@github.com'\n` +
          `  For HTTPS: Run 'gh auth login'`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`, url);
  }
}

function normalizeSparseSubpath(subpath?: string): string | undefined {
  if (!subpath) return undefined;

  const normalized = subpath
    .trim()
    .replace(/\\+/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');

  return normalized || undefined;
}

/**
 * Clean up a temporary directory (with safety check)
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  const normalizedDir = normalize(resolve(dir));
  const normalizedTmpDir = normalize(resolve(tmpdir()));

  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await rm(dir, { recursive: true, force: true });
}

/**
 * Execute a git command with timeout
 */
function execGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, { timeout: CLONE_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Build a GitHub clone URL from owner and repo
 */
export function githubCloneUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}
