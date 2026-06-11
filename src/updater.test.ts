import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlatformKey } from './platform.ts';

test('resolvePlatformKey: uses arm64 artifact for translated Apple Silicon processes', () => {
  assert.equal(
    resolvePlatformKey({ platform: 'darwin', arch: 'x64', isTranslated: true }),
    'darwin-arm64',
  );
});

test('resolvePlatformKey: keeps native Intel macOS on x64 artifact', () => {
  assert.equal(
    resolvePlatformKey({ platform: 'darwin', arch: 'x64', isTranslated: false }),
    'darwin-x64',
  );
});

test('resolvePlatformKey: keeps non-macOS platform mapping unchanged', () => {
  assert.equal(
    resolvePlatformKey({ platform: 'linux', arch: 'arm64', isTranslated: true }),
    'linux-arm64',
  );
});
