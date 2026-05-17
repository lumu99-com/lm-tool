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
    return {
      target,
      successMessage: `${target} 编译成功`,
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
        {
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
