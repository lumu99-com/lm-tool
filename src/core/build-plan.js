import path from 'node:path';

export function createBuildPlan({ target, config }) {
  if (target === 'all') {
    return {
      target: 'all',
      children: [
        createBuildPlan({ target: 'server', config }),
        createBuildPlan({ target: 'web', config }),
        createBuildPlan({ target: 'admin', config }),
      ],
    };
  }

  const projectDir = config.projects?.[target];
  if (!projectDir) {
    throw new Error(`${target} 项目路径未配置，请重新执行 lm init`);
  }

  if (target === 'web' || target === 'admin') {
    return createFrontendBuildPlan({
      target,
      projectDir,
      platform: config.platform,
    });
  }

  const targetDir = path.join(projectDir, 'target');
  const fixedJarPath = path.join(targetDir, config.server.fixedJarName);
  const logPath = path.join(projectDir, config.server.logFile);

  return {
    target: 'server',
    successMessage: 'server 编译成功',
    steps: [
      {
        kind: 'snapshot-server-example',
        label: 'snapshot server example',
      },
      {
        kind: 'command',
        label: 'git pull',
        infoLabel: '拉取 server 仓库最新代码',
        startMessage: '正在拉取 server 仓库最新代码',
        command: 'git',
        args: ['pull'],
        cwd: projectDir,
      },
      {
        kind: 'sync-server-env',
        label: 'sync server env',
        infoLabel: '对齐 server 项目的 .env 配置',
        startMessage: '正在对齐 server 项目的 .env 配置',
      },
      {
        kind: 'check-server-env',
        label: 'check server env',
        infoLabel: '检查 server 项目的环境变量',
        startMessage: '正在检查 server 项目的环境变量',
      },
      {
        kind: 'command',
        label: 'mvn clean package -DskipTests',
        infoLabel: '编译 server 项目',
        startMessage: '正在编译 server 项目',
        command: 'mvn',
        args: ['clean', 'package', '-DskipTests'],
        cwd: projectDir,
      },
      { kind: 'copy-server-jar', label: 'copy server jar', targetDir, fixedJarPath },
      {
        kind: 'restart-server',
        label: 'restart server',
        platform: config.platform,
        serverDir: projectDir,
        jarPath: fixedJarPath,
        logPath,
        linuxServiceName: config.server.linuxServiceName,
        linuxUseSudoForServiceCommands: config.server.linuxUseSudoForServiceCommands,
      },
    ],
  };
}

function createFrontendBuildPlan({ target, projectDir, platform }) {
  const isLocalDevPlatform = platform === 'windows' || platform === 'macos';

  return {
    target,
    successMessage: isLocalDevPlatform
      ? `${target} 本地开发服务已启动，请在新窗口中查看访问端口`
      : `${target} 编译成功`,
    steps: [
      {
        kind: 'command',
        label: 'git pull',
        infoLabel: `拉取 ${target} 仓库最新代码`,
        startMessage: `正在拉取 ${target} 仓库最新代码`,
        command: 'git',
        args: ['pull'],
        cwd: projectDir,
      },
      {
        kind: 'command',
        label: 'npm install',
        infoLabel: `安装 ${target} 项目依赖`,
        startMessage: `正在安装 ${target} 项目依赖`,
        command: 'npm',
        args: ['install'],
        cwd: projectDir,
      },
      isLocalDevPlatform
        ? createFrontendDevWindowStep({ target, projectDir, platform })
        : {
            kind: 'command',
            label: 'npm run build',
            infoLabel: `构建 ${target} 项目`,
            startMessage: `正在构建 ${target} 项目`,
            command: 'npm',
            args: ['run', 'build'],
            cwd: projectDir,
          },
    ],
  };
}

function createFrontendDevWindowStep({ target, projectDir, platform }) {
  if (platform === 'windows') {
    return {
      kind: 'command',
      label: `start ${target} dev window`,
      infoLabel: `启动 ${target} 项目的本地开发窗口`,
      startMessage: `正在启动 ${target} 项目的本地开发窗口，并在新窗口中执行 npm run dev`,
      command: 'powershell.exe',
      args: ['-Command', buildWindowsDevLaunchCommand({ target, projectDir })],
      cwd: projectDir,
    };
  }

  if (platform === 'macos') {
    return {
      kind: 'command',
      label: `start ${target} dev window`,
      infoLabel: `启动 ${target} 项目的本地开发窗口`,
      startMessage: `正在启动 ${target} 项目的本地开发窗口，并在新窗口中执行 npm run dev`,
      command: 'osascript',
      args: buildMacosDevLaunchArgs({ target, projectDir }),
      cwd: projectDir,
    };
  }

  throw new Error(`暂不支持的平台类型：${platform}`);
}

function buildWindowsDevLaunchCommand({ target, projectDir }) {
  const escapedProjectDir = escapePowerShellSingleQuotedString(projectDir);
  const escapedMessage = escapePowerShellSingleQuotedString(`正在执行 ${target} 项目的 npm run dev`);
  const innerCommand = [
    `Set-Location -LiteralPath '${escapedProjectDir}'`,
    `Write-Host '${escapedMessage}'`,
    'npm run dev',
  ].join('; ');

  return [
    'Start-Process powershell.exe',
    `-ArgumentList '-NoExit', '-Command', '${escapePowerShellSingleQuotedString(innerCommand)}'`,
  ].join(' ');
}

function buildMacosDevLaunchArgs({ target, projectDir }) {
  const shellCommand = [
    `cd ${quotePosix(projectDir)}`,
    `printf '%s\\n' ${quotePosix(`正在执行 ${target} 项目的 npm run dev`)}`,
    'npm run dev',
  ].join('; ');

  return [
    '-e',
    'tell application "Terminal" to activate',
    '-e',
    `tell application "Terminal" to do script "${escapeAppleScriptString(shellCommand)}"`,
  ];
}

function escapePowerShellSingleQuotedString(value) {
  return String(value).replaceAll("'", "''");
}

function quotePosix(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function escapeAppleScriptString(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
}
