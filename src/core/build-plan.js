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
    throw new Error(`Missing project path for ${target}`);
  }

  if (target === 'web' || target === 'admin') {
    return {
      target,
      successMessage: `${target} 编译成功`,
      steps: [
        { kind: 'command', label: 'git pull', command: 'git', args: ['pull'], cwd: projectDir },
        { kind: 'command', label: 'npm install', command: 'npm', args: ['install'], cwd: projectDir },
        { kind: 'command', label: 'npm run build', command: 'npm', args: ['run', 'build'], cwd: projectDir },
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
      { kind: 'command', label: 'git pull', command: 'git', args: ['pull'], cwd: projectDir },
      { kind: 'command', label: 'mvn clean package -DskipTests', command: 'mvn', args: ['clean', 'package', '-DskipTests'], cwd: projectDir },
      { kind: 'copy-server-jar', label: 'copy server jar', targetDir, fixedJarPath },
      {
        kind: 'restart-server',
        label: 'restart server',
        platform: config.platform,
        serverDir: projectDir,
        jarPath: fixedJarPath,
        logPath,
        linuxServiceName: config.server.linuxServiceName,
      },
    ],
  };
}
