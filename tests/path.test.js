import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { normalizeProjectPath, validateExistingRepoPath } from '../src/core/path.js';

test('normalizeProjectPath normalizes Windows separators and returns an absolute path', () => {
  const result = normalizeProjectPath({
    input: 'D:/Project/lumu99/lumu99-server',
    platform: 'windows',
    cwd: 'D:/Project',
  });

  assert.equal(result.isAbsolute, true);
  assert.match(result.normalized, /lumu99-server/);
});

test('validateExistingRepoPath returns a clear error when a directory does not exist', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-path-'));
  const missingPath = path.join(tempDir, 'missing-repo');

  try {
    await assert.rejects(
      () => validateExistingRepoPath(missingPath),
      /does not exist/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
