import path from 'node:path';
import { copyFile, readdir } from 'node:fs/promises';

const VERSIONED_SERVER_JAR = /^lumu99-server-\d+\.\d+\.\d+.*\.jar$/;

export async function locateVersionedServerJar({ targetDir }) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const match = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .find((entry) => VERSIONED_SERVER_JAR.test(entry));

  if (!match) {
    throw new Error('No versioned lumu99 server jar found in target');
  }

  return {
    fileName: match,
    fullPath: path.join(targetDir, match),
  };
}

export async function copyServerJarToFixedName({ versionedJarPath, fixedJarPath }) {
  await copyFile(versionedJarPath, fixedJarPath);
}
