const SUPPORTED_PLATFORMS = new Set(['windows', 'macos', 'linux']);

export function createInitPrerequisiteCheck(deps) {
  const executor = deps.executor;
  const writeLine = deps.writeLine ?? (() => {});
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));
  const platform = normalizePlatform(deps.runtimePlatform ?? process.platform);

  return {
    async run() {
      const prerequisites = createPrerequisites(platform);

      for (const prerequisite of prerequisites) {
        const result = await runPrerequisite({
          prerequisite,
          executor,
          writeLine,
          writeStdout,
          writeStderr,
        });

        if (result.exitCode !== 0) {
          return result;
        }
      }

      writeLine('初始化前置环境检查已通过，开始执行 lm init。');
      return { exitCode: 0 };
    },
  };
}

async function runPrerequisite({
  prerequisite,
  executor,
  writeLine,
  writeStdout,
  writeStderr,
}) {
  const attemptedCommands = [];

  for (const probe of prerequisite.probes) {
    attemptedCommands.push(formatCommand(probe.command, probe.args));

    const result = await executor.run({
      label: formatCommand(probe.command, probe.args),
      infoLabel: probe.infoLabel,
      startMessage: probe.startMessage,
      command: probe.command,
      args: probe.args,
      writeLine,
      onStdout: writeStdout,
      onStderr: writeStderr,
      captureOutput: true,
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    if (result.exitCode !== 0) {
      if (looksLikeMissingCommand(output)) {
        continue;
      }

      writeLine(
        `初始化前置检查失败：执行 ${formatCommand(probe.command, probe.args)} 时返回非 0 状态。` +
        `请确认本机已正确安装 ${prerequisite.requirementText}，并确保相关命令可以直接在终端执行后，再重新运行 lm init。`,
      );
      return { exitCode: 1 };
    }

    const version = prerequisite.parseVersion(output);
    if (!version) {
      writeLine(
        `初始化前置检查失败：无法从 ${formatCommand(probe.command, probe.args)} 的输出中识别 ${prerequisite.label} 版本。` +
        `请确认当前 PATH 中的 ${probe.command} 指向正确的 ${prerequisite.requirementText}，然后重新执行 lm init。`,
      );
      return { exitCode: 1 };
    }

    if (!prerequisite.isSatisfied(version)) {
      writeLine(
        `初始化前置检查失败：当前检测到的 ${prerequisite.label} 版本为 ${version}，需要 ${prerequisite.requirementText}。` +
        '请先升级或切换版本后，再重新执行 lm init。',
      );
      return { exitCode: 1 };
    }

    writeLine(
      `初始化前置检查通过：已检测到本机 ${prerequisite.label} 版本 ${version}，满足 ${prerequisite.requirementText} 要求。`,
    );
    return { exitCode: 0 };
  }

  writeLine(
    `初始化前置检查失败：未找到可用的 ${prerequisite.label} 版本检查命令。` +
    `已尝试：${attemptedCommands.join('、')}。请先安装 ${prerequisite.requirementText} 并将命令加入 PATH，然后重新执行 lm init。`,
  );
  return { exitCode: 1 };
}

function createPrerequisites(platform) {
  return [
    {
      label: 'JDK',
      requirementText: 'JDK 17',
      parseVersion: parseJavaVersion,
      isSatisfied: (version) => getMajorVersion(version) === 17,
      probes: getPlatformProbes(platform, {
        infoLabel: '检查本机 JDK 版本',
        startMessage: '正在检查本机 JDK 版本，要求为 17',
        commands: [
          { command: 'java', args: ['-version'] },
        ],
      }),
    },
    {
      label: 'Maven',
      requirementText: 'Maven 3.9+',
      parseVersion: parseMavenVersion,
      isSatisfied: (version) => compareVersions(version, '3.9.0') >= 0,
      probes: getPlatformProbes(platform, {
        infoLabel: '检查本机 Maven 版本',
        startMessage: '正在检查本机 Maven 版本，要求为 3.9 及以上',
        commands: [
          { command: 'mvn', args: ['-version'] },
        ],
      }),
    },
    {
      label: 'MySQL',
      requirementText: 'MySQL 8',
      parseVersion: parseMysqlVersion,
      isSatisfied: (version) => getMajorVersion(version) === 8,
      probes: getPlatformProbes(platform, {
        infoLabel: '检查本机 MySQL 版本',
        startMessage: '正在检查本机 MySQL 版本，要求为 8',
        commands: [
          { command: 'mysql', args: ['--version'] },
          { command: 'mysqld', args: ['--version'] },
        ],
      }),
    },
    {
      label: 'Redis',
      requirementText: 'Redis 6+',
      parseVersion: parseRedisVersion,
      isSatisfied: (version) => compareVersions(version, '6.0.0') >= 0,
      probes: getPlatformProbes(platform, {
        infoLabel: '检查本机 Redis 版本',
        startMessage: '正在检查本机 Redis 版本，要求为 6 及以上',
        commands: [
          { command: 'redis-server', args: ['--version'] },
          { command: 'redis-cli', args: ['--version'] },
        ],
      }),
    },
  ];
}

function getPlatformProbes(platform, definition) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return definition.commands.map((command) => createProbe(command, definition));
  }

  return definition.commands.map((command) => createProbe(command, definition));
}

function createProbe(command, definition) {
  return {
    command: command.command,
    args: command.args,
    infoLabel: `${definition.infoLabel}（${formatCommand(command.command, command.args)}）`,
    startMessage: `${definition.startMessage}：${formatCommand(command.command, command.args)}`,
  };
}

function normalizePlatform(runtimePlatform) {
  if (runtimePlatform === 'win32' || runtimePlatform === 'windows') {
    return 'windows';
  }

  if (runtimePlatform === 'darwin' || runtimePlatform === 'macos') {
    return 'macos';
  }

  return 'linux';
}

function formatCommand(command, args = []) {
  return [command, ...args].join(' ');
}

function looksLikeMissingCommand(output) {
  const normalized = output.toLowerCase();
  return [
    'command not found',
    'not found',
    'not recognized as an internal or external command',
    'is not recognized as an internal or external command',
    'enoent',
    'spawn',
  ].some((pattern) => normalized.includes(pattern));
}

function parseJavaVersion(output) {
  const match = output.match(/version "([^"]+)"/i);
  return match?.[1] ?? null;
}

function parseMavenVersion(output) {
  const match = output.match(/apache maven\s+(\d+\.\d+\.\d+)/i);
  return match?.[1] ?? null;
}

function parseMysqlVersion(output) {
  const match = output.match(/\bver\s+(\d+\.\d+\.\d+)/i);
  return match?.[1] ?? null;
}

function parseRedisVersion(output) {
  const serverMatch = output.match(/\bv=(\d+\.\d+\.\d+)/i);
  if (serverMatch) {
    return serverMatch[1];
  }

  const cliMatch = output.match(/\bredis-cli\s+(\d+\.\d+\.\d+)/i);
  if (cliMatch) {
    return cliMatch[1];
  }

  const genericMatch = output.match(/\b(\d+\.\d+\.\d+)\b/);
  return genericMatch?.[1] ?? null;
}

function compareVersions(left, right) {
  const leftParts = toVersionParts(left);
  const rightParts = toVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function getMajorVersion(version) {
  const parts = toVersionParts(version);
  if (parts[0] === 1 && parts.length > 1) {
    return parts[1];
  }
  return parts[0] ?? 0;
}

function toVersionParts(version) {
  return String(version)
    .split(/[._-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
