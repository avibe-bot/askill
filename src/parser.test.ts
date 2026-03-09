import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDependencies, isValidDependencySpec } from './parser.ts';

test('extractDependencies: parses inline bracket list string', () => {
  const content = `---
name: whisper
dependencies: [openai-whisper, transformers, torch]
---
`;

  const dependencies = extractDependencies(content);
  assert.deepEqual(dependencies, ['openai-whisper', 'transformers', 'torch']);
});

test('extractDependencies: parses quoted comma-separated string', () => {
  const content = `---
name: whisper
dependencies: "openai-whisper, transformers, torch"
---
`;

  const dependencies = extractDependencies(content);
  assert.deepEqual(dependencies, ['openai-whisper', 'transformers', 'torch']);
});

test('isValidDependencySpec: accepts supported dependency formats', () => {
  const validDependencies = [
    '@acme/tool',
    '@acme/tool@^1.2.3',
    'gh:owner/repo',
    'gh:owner/repo@skill-name',
    'gh:owner/repo/path/to/skill',
  ];

  for (const dep of validDependencies) {
    assert.equal(isValidDependencySpec(dep), true, `expected valid dependency: ${dep}`);
  }
});

test('isValidDependencySpec: rejects non-askill dependency annotations', () => {
  const invalidDependencies = [
    'openai-whisper',
    'transformers',
    'torch',
    'pip:requests',
    '@broken',
    'gh:owner',
    'gh:owner/repo@',
  ];

  for (const dep of invalidDependencies) {
    assert.equal(isValidDependencySpec(dep), false, `expected invalid dependency: ${dep}`);
  }
});
