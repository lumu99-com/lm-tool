import path from 'node:path';
import { constants } from 'node:fs';
import { access, copyFile, readFile } from 'node:fs/promises';

export function resolveServerEnvPaths({ config }) {
  const serverDir = config?.projects?.server;
  if (!serverDir) {
    throw new Error('server 项目路径未配置，请重新执行 lm init');
  }

  return {
    serverDir,
    envPath: path.join(serverDir, '.env'),
    examplePath: path.join(serverDir, '.env.example'),
  };
}

export async function ensureServerEnvFile({ config }) {
  const paths = resolveServerEnvPaths({ config });
  const envExists = await exists(paths.envPath);
  const exampleExists = await exists(paths.examplePath);

  if (!envExists && exampleExists) {
    await copyFile(paths.examplePath, paths.envPath);
  }

  return {
    ...paths,
    envExists: envExists || exampleExists,
    exampleExists,
    createdFromExample: !envExists && exampleExists,
  };
}

export function parseEnvLine(rawLine) {
  const raw = rawLine ?? '';
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { kind: 'blank', raw };
  }

  if (trimmed.startsWith('#')) {
    return { kind: 'comment', raw };
  }

  const separatorIndex = raw.indexOf('=');
  if (separatorIndex === -1) {
    return { kind: 'other', raw };
  }

  const rawKey = raw.slice(0, separatorIndex).trim();
  const key = rawKey.startsWith('export ')
    ? rawKey.slice('export '.length).trim()
    : rawKey;

  return {
    kind: 'key',
    raw,
    key,
    value: raw.slice(separatorIndex + 1),
  };
}

export function parseEnvLines(lines) {
  return toLineArray(lines).map(parseEnvLine);
}

export function findEmptyEnvKeys(lines) {
  return parseEnvLines(lines)
    .filter((line) => line.kind === 'key' && line.value.trim() === '')
    .map((line) => line.key);
}

export async function readEmptyEnvKeys({ envPath }) {
  const content = await readFile(envPath, 'utf8');
  return findEmptyEnvKeys(content);
}

export function syncAddedExampleLines({
  beforeExampleLines,
  afterExampleLines,
  envLines,
}) {
  const before = toLineArray(beforeExampleLines);
  const after = toLineArray(afterExampleLines);
  const nextEnvLines = [...toLineArray(envLines)];
  const blocks = collectChangedBlocks(before, after);

  let changed = false;

  for (const block of blocks) {
    if (block.added.length === 0) {
      continue;
    }

    const insertLines = collectInsertableLines({
      candidateLines: block.added,
      removedLines: block.removed,
      envLines: nextEnvLines,
    });
    if (insertLines.length === 0) {
      continue;
    }

    const insertAt = findInsertionIndex({
      envLines: nextEnvLines,
      previousAnchor: after[block.afterStart - 1] ?? null,
      nextAnchor: after[block.afterEnd] ?? null,
    });

    nextEnvLines.splice(insertAt, 0, ...insertLines);
    changed = true;
  }

  return {
    lines: nextEnvLines,
    changed,
  };
}

function collectChangedBlocks(beforeLines, afterLines) {
  const lcs = buildLcsMatrix(beforeLines, afterLines);
  const blocks = [];
  let i = 0;
  let j = 0;
  let currentBlock = null;

  while (i < beforeLines.length || j < afterLines.length) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      if (currentBlock) {
        currentBlock.beforeEnd = i;
        currentBlock.afterEnd = j;
        blocks.push(currentBlock);
        currentBlock = null;
      }

      i += 1;
      j += 1;
      continue;
    }

    currentBlock ??= {
      beforeStart: i,
      beforeEnd: i,
      afterStart: j,
      afterEnd: j,
      removed: [],
      added: [],
    };

    const removeCurrent = j === afterLines.length
      || (i < beforeLines.length && lcs[i + 1][j] >= lcs[i][j + 1]);

    if (removeCurrent) {
      currentBlock.removed.push(beforeLines[i]);
      i += 1;
      continue;
    }

    currentBlock.added.push(afterLines[j]);
    j += 1;
  }

  if (currentBlock) {
    currentBlock.beforeEnd = i;
    currentBlock.afterEnd = j;
    blocks.push(currentBlock);
  }

  return blocks;
}

function buildLcsMatrix(beforeLines, afterLines) {
  const matrix = Array.from(
    { length: beforeLines.length + 1 },
    () => Array.from({ length: afterLines.length + 1 }, () => 0),
  );

  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = beforeLines[i] === afterLines[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  return matrix;
}

function collectInsertableLines({ candidateLines, removedLines, envLines }) {
  const parsedEnvLines = parseEnvLines(envLines);
  let removedCommentSlots = parseEnvLines(removedLines)
    .filter((line) => line.kind === 'comment')
    .length;
  const removedKeys = new Set(
    parseEnvLines(removedLines)
      .filter((line) => line.kind === 'key')
      .map((line) => line.key),
  );
  const existingKeys = new Set(
    parsedEnvLines
      .filter((line) => line.kind === 'key')
      .map((line) => line.key),
  );
  const existingComments = new Set(
    parsedEnvLines
      .filter((line) => line.kind === 'comment')
      .map((line) => line.raw),
  );
  const insertLines = [];

  for (const rawLine of candidateLines) {
    const parsedLine = parseEnvLine(rawLine);

    if (parsedLine.kind === 'key') {
      if (removedKeys.has(parsedLine.key) || existingKeys.has(parsedLine.key)) {
        continue;
      }

      existingKeys.add(parsedLine.key);
      insertLines.push(parsedLine.raw);
      continue;
    }

    if (parsedLine.kind === 'comment') {
      if (removedCommentSlots > 0) {
        removedCommentSlots -= 1;
        continue;
      }

      if (existingComments.has(parsedLine.raw)) {
        continue;
      }

      existingComments.add(parsedLine.raw);
      insertLines.push(parsedLine.raw);
    }
  }

  return insertLines;
}

function findInsertionIndex({ envLines, previousAnchor, nextAnchor }) {
  const parsedEnvLines = parseEnvLines(envLines);

  const previousIndex = findAnchorIndex({
    parsedEnvLines,
    anchorLine: previousAnchor,
    direction: 'last',
  });
  if (previousIndex !== -1) {
    return previousIndex + 1;
  }

  const nextIndex = findAnchorIndex({
    parsedEnvLines,
    anchorLine: nextAnchor,
    direction: 'first',
  });
  if (nextIndex !== -1) {
    return nextIndex;
  }

  return envLines.length;
}

function findAnchorIndex({ parsedEnvLines, anchorLine, direction }) {
  if (!anchorLine) {
    return -1;
  }

  const anchor = parseEnvLine(anchorLine);
  if (anchor.kind === 'blank') {
    return -1;
  }

  const indexes = direction === 'last'
    ? Array.from(parsedEnvLines.keys()).reverse()
    : Array.from(parsedEnvLines.keys());

  for (const index of indexes) {
    if (matchesAnchor(parsedEnvLines[index], anchor)) {
      return index;
    }
  }

  return -1;
}

function matchesAnchor(line, anchor) {
  if (anchor.kind === 'key') {
    return line.kind === 'key' && line.key === anchor.key;
  }

  if (anchor.kind === 'comment') {
    return line.kind === 'comment' && line.raw === anchor.raw;
  }

  return line.raw === anchor.raw;
}

function toLineArray(input) {
  if (Array.isArray(input)) {
    return [...input];
  }

  if (typeof input !== 'string' || input.length === 0) {
    return [];
  }

  const lines = input.split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines;
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
