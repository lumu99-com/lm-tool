export const commandRegistry = [
  { usage: 'lm init', description: '初始化当前平台和项目路径' },
  { usage: 'lm build server', description: '拉取并构建后端项目' },
  { usage: 'lm build web', description: '拉取并构建用户前端项目' },
  { usage: 'lm build admin', description: '拉取并构建管理员前端项目' },
  { usage: 'lm build', description: '按顺序构建 server、web、admin' },
  { usage: 'lm help', description: '显示帮助信息' },
];

export function buildHelpText(commands = commandRegistry) {
  const commandLines = commands
    .map((command) => `${command.usage} - ${command.description}`)
    .join('\n');

  return [
    'lm-tool 使用说明',
    '',
    '命令列表：',
    commandLines,
    '',
    '使用规则：',
    '- 执行 lm、lm help、lm init、lm build 前会先检查 lm-tool 是否有更新',
    '- build 命令才会拉取 server、web、admin 仓库最新代码',
    '- 所有外部命令都会实时输出原始信息',
    '- 每个外部命令结束后都会输出 [INFO] 和 =======================',
  ].join('\n');
}
