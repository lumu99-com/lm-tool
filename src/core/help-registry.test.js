import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelpText } from './help-registry.js';

test('build help only includes build commands', () => {
  const text = buildHelpText('build');
  assert.match(text, /lm build server/);
  assert.doesNotMatch(text, /lm check server/);
});
