import { execFileSync } from 'child_process';
import { arch, platform } from 'os';

export interface RuntimePlatform {
  platform: NodeJS.Platform | string;
  arch: string;
  isTranslated?: boolean;
}

/**
 * Rosetta reports the process as x64 even on Apple Silicon. For release
 * binaries, choose the native machine architecture so macOS installs can
 * replace a translated x64 binary with the arm64 build.
 */
export function resolvePlatformKey(runtime: RuntimePlatform): string {
  const p = runtime.platform;
  let a = runtime.arch;

  if (p === 'darwin' && a === 'x64' && runtime.isTranslated) {
    a = 'arm64';
  }

  if (p === 'darwin') {
    return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (p === 'linux') {
    return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else if (p === 'win32') {
    return 'win32-x64';
  }

  return `${p}-${a}`;
}

function isRosettaTranslated(): boolean {
  if (platform() !== 'darwin' || arch() !== 'x64') {
    return false;
  }

  try {
    const output = execFileSync('/usr/sbin/sysctl', ['-in', 'sysctl.proc_translated'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output === '1';
  } catch {
    return false;
  }
}

export function getPlatformKey(): string {
  return resolvePlatformKey({
    platform: platform(),
    arch: arch(),
    isTranslated: isRosettaTranslated(),
  });
}
