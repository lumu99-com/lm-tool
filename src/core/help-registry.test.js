import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelpText } from './help-registry.js';

function extractCommandSection(scope) {
  const text = buildHelpText(scope);
  return text.split('\n\n')[1] ?? '';
}

test('root help includes lm update command', () => {
  const commandSection = extractCommandSection('root');
  assert.match(commandSection, /lm update/);
});

test('root help includes lm mysql command', () => {
  const commandSection = extractCommandSection('root');
  assert.match(commandSection, /lm mysql/);
});

test('build help only includes build commands', () => {
  const commandSection = extractCommandSection('build');
  assert.match(commandSection, /lm build server/);
  assert.doesNotMatch(commandSection, /lm check server/);
});

test('init help only includes init commands', () => {
  const commandSection = extractCommandSection('init');
  assert.match(commandSection, /lm init help/);
  assert.doesNotMatch(commandSection, /lm build server/);
});

test('mysql help only includes mysql commands', () => {
  const commandSection = extractCommandSection('mysql');
  assert.match(commandSection, /lm mysql init/);
  assert.match(commandSection, /lm mysql user/);
  assert.doesNotMatch(commandSection, /lm build server/);
});
