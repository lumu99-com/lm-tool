import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

export function createConfigStore({ executableDir }) {
  const configPath = path.join(executableDir, 'lm.config.json');

  return {
    getPath() {
      return configPath;
    },
    async load() {
      if (!(await exists(configPath))) {
        return null;
      }

      const fileContents = await readFile(configPath, 'utf8');
      return JSON.parse(fileContents);
    },
    async save(config) {
      await writeFile(configPath, JSON.stringify(config, null, 2));
    },
  };
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
