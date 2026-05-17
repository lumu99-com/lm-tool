import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelpText } from './help-registry.js';

test('build help only includes build commands', () => {
  const text = buildHelpText('build');
  const commandSection = text.split('\n\n使用规则：')[0];
  assert.match(commandSection, /lm build server/);
  assert.doesNotMatch(commandSection, /lm check server/);
});
