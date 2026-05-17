import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';

import { locateVersionedServerJar, copyServerJarToFixedName } from '../src/core/jar.js';

test('locateVersionedServerJar finds the versioned lumu99 server jar and ignores the fixed-name jar', async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-jar-'));
  const targetDir = path.join(repoDir, 'target');

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, 'lumu99-server-1.1.8.jar'), '');
    await writeFile(path.join(targetDir, 'lumu99-server.jar'), '');

    const result = await locateVersionedServerJar({ targetDir });

    assert.equal(result.fileName, 'lumu99-server-1.1.8.jar');
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('copyServerJarToFixedName copies the versioned jar to target/lumu99-server.jar', async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-jar-copy-'));
  const targetDir = path.join(repoDir, 'target');
  const versionedJarPath = path.join(targetDir, 'lumu99-server-1.1.8.jar');
  const fixedJarPath = path.join(targetDir, 'lumu99-server.jar');

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(versionedJarPath, 'jar-binary-placeholder');

    await copyServerJarToFixedName({ versionedJarPath, fixedJarPath });

    const copied = await readFile(fixedJarPath, 'utf8');
    assert.equal(copied, 'jar-binary-placeholder');
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});
