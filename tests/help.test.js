import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHelpText, commandRegistry } from '../src/core/help-registry.js';

test('help registry includes all first-version commands', () => {
  const text = buildHelpText(commandRegistry);

  assert.match(text, /lm init/);
  assert.match(text, /lm build server/);
  assert.match(text, /lm build web/);
  assert.match(text, /lm build admin/);
  assert.match(text, /lm build/);
  assert.match(text, /lm help/);
});
