import { spawn } from 'node:child_process';

export async function runSelfUpdatePreflight(deps) {
  if (process.env.LM_TOOL_SKIP_SELF_UPDATE === '1') {
    return { exitCode: 0, shouldReexec: false };
  }

  const mode = deps.mode ?? 'auto';
  const today = deps.today ?? buildTodayString();
  const autoConfigState = await loadAutoConfigState({
    mode,
    configStore: deps.configStore,
    today,
  });

  if (mode === 'auto' && !autoConfigState) {
    return { exitCode: 0, shouldReexec: false };
  }

  const resolveToolDirImpl = deps.resolveToolDir ?? resolveToolDir;
  const resolveUpstreamBranchImpl = deps.resolveUpstreamBranch ?? resolveUpstreamBranch;
  const readAheadBehindImpl = deps.readAheadBehind ?? readAheadBehind;
  const readHasLocalChangesImpl = deps.readHasLocalChanges ?? readHasLocalChanges;
  const configuredToolDir = await readConfiguredLmToolPath({
    configStore: deps.configStore,
    autoConfigState,
  });

  const toolDir = await resolveToolDirImpl(configuredToolDir ?? deps.executableDir);
  if (!toolDir) {
    writeSelfUpdateInfo(deps.writeLine, '当前 lm-tool 不在 Git 仓库中，已跳过更新检查');
    await saveAutoCheckDate(autoConfigState, today);
    return { exitCode: 0, shouldReexec: false };
  }

  const upstreamBranch = await resolveUpstreamBranchImpl(toolDir);
  if (!upstreamBranch) {
    writeSelfUpdateInfo(deps.writeLine, '当前 lm-tool 仓库未配置上游分支，已跳过更新检查');
    await saveAutoCheckDate(autoConfigState, today);
    return { exitCode: 0, shouldReexec: false };
  }

  const fetchResult = await deps.executor.run({
    label: 'git fetch',
    infoLabel: '检查 lm-tool 更新',
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

  const aheadBehind = await readAheadBehindImpl(toolDir, upstreamBranch);
  if (!aheadBehind || aheadBehind.remoteAhead <= 0) {
    await saveAutoCheckDate(autoConfigState, today);
    if (mode === 'manual' && aheadBehind && aheadBehind.remoteAhead <= 0) {
      writeSelfUpdateInfo(deps.writeLine, 'lm-tool 当前已经是最新代码，无需更新');
    }
    return { exitCode: 0, shouldReexec: false };
  }

  const hasLocalChanges = await readHasLocalChangesImpl(toolDir);
  if (hasLocalChanges) {
    const action = await deps.prompts.selectSelfUpdateAction();
    if (action === 'skip-update') {
      await saveAutoCheckDate(autoConfigState, today);
      return { exitCode: 0, shouldReexec: false };
    }

    const restoreResult = await resetLocalChanges({
      executor: deps.executor,
      toolDir,
      writeLine: deps.writeLine,
      writeStdout: deps.writeStdout,
      writeStderr: deps.writeStderr,
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

  await saveAutoCheckDate(autoConfigState, today);

  if (mode === 'manual') {
    writeSelfUpdateInfo(deps.writeLine, 'lm-tool 已更新完成，请重新执行需要的命令');
    return { exitCode: 0, shouldReexec: false };
  }

  writeSelfUpdateInfo(deps.writeLine, '检测到 lm-tool 有更新，已拉取最新代码，正在重新执行当前命令');
  return { exitCode: 0, shouldReexec: true };
}

async function loadAutoConfigState({ mode, configStore, today }) {
  if (mode !== 'auto' || !configStore?.load || !configStore?.save) {
    return null;
  }

  const config = await configStore.load();
  if (!config) {
    return null;
  }

  if (config.selfUpdate?.lastCheckedDate === today) {
    return null;
  }

  return {
    configStore,
    config,
  };
}

async function readConfiguredLmToolPath({ configStore, autoConfigState }) {
  const config = autoConfigState?.config ?? await loadSelfUpdateConfig(configStore);
  return config?.projects?.lmTool ?? null;
}

async function loadSelfUpdateConfig(configStore) {
  if (!configStore?.load) {
    return null;
  }

  return configStore.load();
}

async function saveAutoCheckDate(autoConfigState, today) {
  if (!autoConfigState) {
    return;
  }

  const nextConfig = {
    ...autoConfigState.config,
    selfUpdate: {
      ...autoConfigState.config.selfUpdate,
      lastCheckedDate: today,
    },
  };

  autoConfigState.config = nextConfig;
  await autoConfigState.configStore.save(nextConfig);
}

async function resetLocalChanges({
  executor,
  toolDir,
  writeLine,
  writeStdout,
  writeStderr,
}) {
  const resetTrackedResult = await executor.run({
    label: 'git reset --hard HEAD',
    infoLabel: '回退 lm-tool 已跟踪的本地变更',
    startMessage: '正在回退 lm-tool 已跟踪的本地变更',
    command: 'git',
    args: ['reset', '--hard', 'HEAD'],
    cwd: toolDir,
    writeLine,
    onStdout: writeStdout,
    onStderr: writeStderr,
  });

  if (resetTrackedResult.exitCode !== 0) {
    return resetTrackedResult;
  }

  return executor.run({
    label: 'git clean -fd',
    infoLabel: '清理 lm-tool 未跟踪的本地文件',
    startMessage: '正在清理 lm-tool 未跟踪的本地文件',
    command: 'git',
    args: ['clean', '-fd'],
    cwd: toolDir,
    writeLine,
    onStdout: writeStdout,
    onStderr: writeStderr,
  });
}

function writeSelfUpdateInfo(writeLine, message) {
  writeLine?.(`[INFO] ${message}`);
  writeLine?.('=======================');
}

function buildTodayString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
