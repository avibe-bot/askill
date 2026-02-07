import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const ASKILL_DIR = join(homedir(), '.askill');
const CREDENTIALS_FILE = join(ASKILL_DIR, 'credentials.json');

export interface Credentials {
  token: string;
  username?: string;
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const content = await readFile(CREDENTIALS_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Credentials;
    if (!parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await mkdir(ASKILL_DIR, { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

export async function clearCredentials(): Promise<void> {
  try {
    await rm(CREDENTIALS_FILE);
  } catch {
    // ignore missing file
  }
}

export function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return `${token.slice(0, 8)}****`;
}
