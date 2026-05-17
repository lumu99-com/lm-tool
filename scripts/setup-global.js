#!/usr/bin/env node

import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function resolveNpmCommand(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function buildNpmInvocation(platform = process.platform, npmArgs = []) {
  const npmCommand = resolveNpmCommand(platform);

  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `${npmCommand} ${npmArgs.join(' ')}`],
    };
  }

  return {
    command: npmCommand,
    args: npmArgs,
  };
}

export function setupGlobalCommand(platform = process.platform) {
  const linkInvocation = buildNpmInvocation(platform, ['link']);
  execFileSync(linkInvocation.command, linkInvocation.args, {
    stdio: 'inherit',
  });

  if (platform !== 'win32') {
    console.log('Global lm command is ready.');
    return;
  }

  const prefixInvocation = buildNpmInvocation(platform, ['prefix', '-g']);
  const globalPrefix = execFileSync(prefixInvocation.command, prefixInvocation.args, {
    encoding: 'utf8',
  }).trim();

  const ps1ShimPath = path.join(globalPrefix, 'lm.ps1');
  const disabledPs1ShimPath = path.join(globalPrefix, 'lm.ps1.disabled');
  const cmdShimPath = path.join(globalPrefix, 'lm.cmd');

  if (existsSync(ps1ShimPath) && existsSync(cmdShimPath)) {
    renameSync(ps1ShimPath, disabledPs1ShimPath);
    console.log(`Disabled PowerShell shim at ${ps1ShimPath}`);
  }

  console.log('Global lm command is ready.');
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  setupGlobalCommand();
}
