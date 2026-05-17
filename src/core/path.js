import path from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

export function normalizeProjectPath({ input, platform, cwd }) {
  const pathApi = platform === 'windows' ? path.win32 : path.posix;
  const normalizedInput = input.replaceAll('\\', pathApi.sep);
  const normalized = pathApi.normalize(normalizedInput);
  const absolute = pathApi.isAbsolute(normalized)
    ? normalized
    : pathApi.resolve(cwd, normalized);

  return {
    original: input,
    normalized: absolute,
    isAbsolute: pathApi.isAbsolute(absolute),
  };
}

export async function validateExistingRepoPath(repoPath) {
  try {
    await access(repoPath, constants.F_OK);
  } catch {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
}
