import { spawn } from 'node:child_process';

export async function runSelfUpdatePreflight(deps) {
  if (process.env.LM_TOOL_SKIP_SELF_UPDATE === '1') {
    return { exitCode: 0, shouldReexec: false };
  }

  const toolDir = await resolveToolDir(deps.executableDir);
  if (!toolDir) {
    return { exitCode: 0, shouldReexec: false };
  }

  const upstreamBranch = await resolveUpstreamBranch(toolDir);
  if (!upstreamBranch) {
    return { exitCode: 0, shouldReexec: false };
  }

  const fetchResult = await deps.executor.run({
    label: 'git fetch',
    infoLabel: 'lm-tool 更新检查',
    startMessage: '正在检查 lm-tool 是否有更新',
    command: 'git',
    args: ['fetch'],
    cwd: toolDir,
    writeLine: deps.writeLine,
    onStdout: deps.writeStdout,
    onStderr: deps.writeStderr,
  });

  if (fetchResult.exitCode !== 0) {
    return { exitCode: fetchResult.exitCode, shouldReexec: false };
  }

  const aheadBehind = await readAheadBehind(toolDir, upstreamBranch);
  if (!aheadBehind || aheadBehind.remoteAhead <= 0) {
    return { exitCode: 0, shouldReexec: false };
  }

  const hasLocalChanges = await readHasLocalChanges(toolDir);
  if (hasLocalChanges) {
    const action = await deps.prompts.selectSelfUpdateAction();
    if (action === 'skip-update') {
      return { exitCode: 0, shouldReexec: false };
    }

    const restoreResult = await deps.executor.run({
      label: 'git restore .',
      infoLabel: '回退 lm-tool 本地变更',
      startMessage: '正在回退 lm-tool 本地变更',
      command: 'git',
      args: ['restore', '.'],
      cwd: toolDir,
      writeLine: deps.writeLine,
      onStdout: deps.writeStdout,
      onStderr: deps.writeStderr,
    });

    if (restoreResult.exitCode !== 0) {
      return { exitCode: restoreResult.exitCode, shouldReexec: false };
    }
  }

  const pullResult = await deps.executor.run({
    label: 'git pull',
    infoLabel: '拉取 lm-tool 最新代码',
    startMessage: '正在拉取 lm-tool 最新代码',
    command: 'git',
    args: ['pull'],
    cwd: toolDir,
    writeLine: deps.writeLine,
    onStdout: deps.writeStdout,
    onStderr: deps.writeStderr,
  });

  if (pullResult.exitCode !== 0) {
    return { exitCode: pullResult.exitCode, shouldReexec: false };
  }

  return { exitCode: 0, shouldReexec: true };
}

async function resolveToolDir(executableDir) {
  const result = await runCaptureCommand({
    command: 'git',
    args: ['rev-parse', '--show-toplevel'],
    cwd: executableDir,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

async function resolveUpstreamBranch(cwd) {
  const result = await runCaptureCommand({
    command: 'git',
    args: ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    cwd,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

async function readAheadBehind(cwd, upstreamBranch) {
  const result = await runCaptureCommand({
    command: 'git',
    args: ['rev-list', '--left-right', '--count', `HEAD...${upstreamBranch}`],
    cwd,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const [localAheadText = '0', remoteAheadText = '0'] = result.stdout.trim().split(/\s+/);
  return {
    localAhead: Number(localAheadText) || 0,
    remoteAhead: Number(remoteAheadText) || 0,
  };
}

async function readHasLocalChanges(cwd) {
  const result = await runCaptureCommand({
    command: 'git',
    args: ['status', '--porcelain'],
    cwd,
  });

  if (result.exitCode !== 0) {
    return false;
  }

  return result.stdout.trim().length > 0;
}

async function runCaptureCommand(input) {
  return new Promise((resolve) => {
    const child = spawn(input.command, input.args ?? [], {
      cwd: input.cwd,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ exitCode: 1, stdout, stderr });
    });

    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}
