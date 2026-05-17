import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNpmCommand, buildNpmInvocation } from '../scripts/setup-global.js';

test('resolveNpmCommand uses npm.cmd on Windows', () => {
  assert.equal(resolveNpmCommand('win32'), 'npm.cmd');
});

test('resolveNpmCommand uses npm on non-Windows platforms', () => {
  assert.equal(resolveNpmCommand('linux'), 'npm');
  assert.equal(resolveNpmCommand('darwin'), 'npm');
});

test('buildNpmInvocation wraps npm.cmd through cmd.exe on Windows', () => {
  const invocation = buildNpmInvocation('win32', ['link']);

  assert.equal(invocation.command, 'cmd.exe');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm.cmd link']);
});

test('buildNpmInvocation runs npm directly on non-Windows platforms', () => {
  const invocation = buildNpmInvocation('linux', ['link']);

  assert.equal(invocation.command, 'npm');
  assert.deepEqual(invocation.args, ['link']);
});
