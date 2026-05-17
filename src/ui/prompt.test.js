import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptUi } from './prompt.js';

test('prompt ui exposes env value input method', () => {
  const ui = createPromptUi();
  assert.equal(typeof ui.inputEnvValue, 'function');
});
