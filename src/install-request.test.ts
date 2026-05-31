import test from 'node:test';
import assert from 'node:assert/strict';

import { getRequestedSkill } from './install-request.ts';
import { parseSource } from './source-parser.ts';

test('getRequestedSkill resolves source@name as an explicit skill request', () => {
  const input = 'gh:openclaw/openclaw@tavily';

  assert.deepEqual(getRequestedSkill(input, parseSource(input)), {
    name: 'tavily',
    source: 'gh:openclaw/openclaw',
  });
});

test('getRequestedSkill preserves the base source for --skill requests', () => {
  const input = 'gh:openclaw/openclaw';

  assert.deepEqual(getRequestedSkill(input, parseSource(input), 'tavily'), {
    name: 'tavily',
    source: 'gh:openclaw/openclaw',
  });
});

test('getRequestedSkill returns null when no skill was explicitly requested', () => {
  const input = 'gh:openclaw/openclaw';

  assert.equal(getRequestedSkill(input, parseSource(input)), null);
});
