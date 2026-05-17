import { readFile, writeFile } from 'node:fs/promises';

import {
  ensureServerEnvFile,
  parseEnvLine,
  readEmptyEnvKeys,
} from '../core/env-file.js';

const CHECK_TARGETS = ['server', 'web', 'admin'];

export function createCheckCommand(deps) {
  const writeLine = deps.writeLine ?? (() => {});
  const prompts = deps.prompts ?? {};
  const ensureEnvFile = deps.ensureServerEnvFile ?? ensureServerEnvFile;
  const readEmptyKeys = deps.readEmptyEnvKeys ?? readEmptyEnvKeys;
  const readFileImpl = deps.readFileImpl ?? readFile;
  const writeFileImpl = deps.writeFileImpl ?? writeFile;

  return {
    async run(target) {
      if (target === 'web') {
        writeLine('web 暂无检查项');
        return { exitCode: 0 };
      }

      if (target === 'admin') {
        writeLine('admin 暂无检查项');
        return { exitCode: 0 };
      }

      const config = await deps.configStore.load();
      if (!config) {
        writeLine('请先执行 lm init');
        return { exitCode: 1 };
      }

      try {
        return await runTarget(target, config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(message);
        return { exitCode: 1 };
      }
    },
  };

  async function runTarget(target, config) {
    if (target === 'all') {
      for (const item of CHECK_TARGETS) {
        const result = await runTarget(item, config);
        if (result.exitCode !== 0) {
          return result;
        }
      }

      return { exitCode: 0 };
    }

    if (target === 'server') {
      return runServerCheck(config);
    }

    if (target === 'web') {
      writeLine('web 暂无检查项');
      return { exitCode: 0 };
    }

    if (target === 'admin') {
      writeLine('admin 暂无检查项');
      return { exitCode: 0 };
    }

    return { exitCode: 1 };
  }

  async function runServerCheck(config) {
    const ensureResult = await ensureEnvFile({ config });

    if (!ensureResult.envExists && !ensureResult.exampleExists) {
      writeLine('server 项目目录下未找到 .env.example，跳过检查');
      return { exitCode: 0 };
    }

    const emptyKeys = await readEmptyKeys({ envPath: ensureResult.envPath });
    for (const key of emptyKeys) {
      const value = await promptRequiredEnvValue(key);
      await writeEnvValue({
        envPath: ensureResult.envPath,
        key,
        value,
      });
    }

    return { exitCode: 0 };
  }

  async function promptRequiredEnvValue(key) {
    while (true) {
      const answer = await prompts.inputEnvValue(key);
      const normalized = typeof answer === 'string'
        ? answer.trim()
        : String(answer ?? '').trim();

      if (normalized !== '') {
        return normalized;
      }
    }
  }

  async function writeEnvValue({ envPath, key, value }) {
    const content = await readFileImpl(envPath, 'utf8');
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const hasTrailingNewline = content.endsWith('\r\n') || content.endsWith('\n');
    const nextLines = splitLines(content).map((line) => replaceEnvLineValue({ line, key, value }));
    const nextContent = `${nextLines.join(lineEnding)}${hasTrailingNewline ? lineEnding : ''}`;
    await writeFileImpl(envPath, nextContent);
  }
}

function replaceEnvLineValue({ line, key, value }) {
  const parsed = parseEnvLine(line);
  if (parsed.kind !== 'key' || parsed.key !== key) {
    return line;
  }

  const separatorIndex = line.indexOf('=');
  const prefix = separatorIndex === -1 ? key : line.slice(0, separatorIndex);
  return `${prefix}=${value}`;
}

function splitLines(content) {
  if (!content) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}
