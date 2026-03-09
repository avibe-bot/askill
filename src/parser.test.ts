import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDependencies } from './parser.ts';

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
