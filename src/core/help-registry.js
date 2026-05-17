export const helpRegistry = {
  root: [
    { usage: 'lm init', description: '初始化当前平台和项目路径' },
    { usage: 'lm build', description: '按顺序构建 server、web、admin，可执行 lm build help 查看子命令' },
    { usage: 'lm check', description: '按顺序检查 server、web、admin，可执行 lm check help 查看子命令' },
    { usage: 'lm help', description: '显示顶层帮助信息' },
  ],
  build: [
    { usage: 'lm build', description: '按顺序构建 server、web、admin' },
    { usage: 'lm build server', description: '拉取、检查环境并构建 server 项目' },
    { usage: 'lm build web', description: '拉取并构建 web 项目' },
    { usage: 'lm build admin', description: '拉取并构建 admin 项目' },
    { usage: 'lm build help', description: '显示 build 子命令帮助信息' },
  ],
  check: [
    { usage: 'lm check', description: '按顺序检查 server、web、admin' },
    { usage: 'lm check server', description: '检查 server 项目并补全 .env 空值' },
    { usage: 'lm check web', description: '检查 web 项目，当前仅提示暂无检查项' },
    { usage: 'lm check admin', description: '检查 admin 项目，当前仅提示暂无检查项' },
    { usage: 'lm check help', description: '显示 check 子命令帮助信息' },
  ],
};

export function buildHelpText(scope = 'root') {
  const commands = helpRegistry[scope] ?? helpRegistry.root;
  const commandLines = commands
    .map((command) => `${command.usage} - ${command.description}`)
    .join('\n');

  return [
    scope === 'root' ? 'lm-tool 使用说明' : `lm ${scope} 使用说明`,
    '',
    '命令列表：',
    commandLines,
    '',
    '使用规则：',
    '- 执行 lm、lm help、lm init、lm build、lm check 前会先检查 lm-tool 是否有更新',
    '- build 命令才会拉取 server、web、admin 仓库最新代码',
    '- lm build server 会在 git pull 后对齐 .env.example 的纯新增项，再执行 lm check server',
    '- lm check server 只处理配置中 server 项目目录下的 .env 和 .env.example',
    '- 所有外部命令都会实时输出原始信息',
    '- 每个外部命令结束后都会输出 [INFO] 和 =======================',
  ].join('\n');
}
