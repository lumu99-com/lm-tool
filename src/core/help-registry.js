export const commandRegistry = [
  { usage: 'lm init', description: '初始化当前平台和项目路径' },
  { usage: 'lm build server', description: '拉取并构建后端项目' },
  { usage: 'lm build web', description: '拉取并构建用户前端项目' },
  { usage: 'lm build admin', description: '拉取并构建管理员前端项目' },
  { usage: 'lm build', description: '按顺序构建 server、web、admin' },
  { usage: 'lm help', description: '显示帮助信息' },
];

export function buildHelpText(commands = commandRegistry) {
  return commands
    .map((command) => `${command.usage} - ${command.description}`)
    .join('\n');
}
