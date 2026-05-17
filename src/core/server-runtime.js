import path from 'node:path';

export function createServerRestartPlan(input) {
  if (input.platform === 'linux') {
    return {
      steps: [
        {
          kind: 'command',
          label: 'systemctl restart',
          infoLabel: '重启 server 服务',
          startMessage: '正在重启 server 服务',
          command: 'systemctl',
          args: ['restart', input.linuxServiceName],
          cwd: input.serverDir,
        },
      ],
    };
  }

  return {
    steps: [
      {
        kind: 'stop-server-process',
        label: 'stop existing server process',
        infoLabel: '停止旧的 server 进程',
        startMessage: '正在停止旧的 server 进程',
        jarPath: input.jarPath,
      },
      {
        kind: 'ensure-logs-dir',
        label: 'ensure logs directory',
        logsDir: path.dirname(input.logPath),
      },
      {
        kind: 'start-java-server',
        label: 'start java server',
        infoLabel: '启动新的 server 进程',
        startMessage: '正在启动新的 server 进程',
        serverDir: input.serverDir,
        jarPath: input.jarPath,
        logPath: input.logPath,
      },
      {
        kind: 'verify-server-process',
        label: 'verify server process',
        infoLabel: '校验 server 进程状态',
        startMessage: '正在校验 server 进程状态',
        jarPath: input.jarPath,
      },
    ],
  };
}

export function matchesServerJarCommandLine(commandLine) {
  return commandLine.includes('lumu99-server.jar');
}
