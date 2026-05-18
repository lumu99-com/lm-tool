export const helpRegistry = {
  root: [
    { usage: 'lm init', description: '初始化当前平台和项目路径，可执行 lm init help 查看初始化帮助' },
    { usage: 'lm init help', description: '显示 init 子命令帮助信息' },
    { usage: 'lm build', description: '按顺序处理 server、web、admin，可执行 lm build help 查看子命令' },
    { usage: 'lm check', description: '按顺序检查 server、web、admin，可执行 lm check help 查看子命令' },
    { usage: 'lm mysql', description: '查看当前本地 MySQL 配置，可执行 lm mysql help 查看子命令' },
    { usage: 'lm update', description: '手动检查并更新 lm-tool 自身代码' },
    { usage: 'lm help', description: '显示顶层帮助信息' },
  ],
  init: [
    { usage: 'lm init', description: '先检查本机 JDK 17、Maven 3.6.3 or later、MySQL 8、Redis 6+，再进入初始化流程' },
    { usage: 'lm init help', description: '显示 init 子命令帮助信息' },
  ],
  build: [
    { usage: 'lm build', description: '按顺序处理 server、web、admin；前端在 Linux 构建，在 Windows/macOS 启动 dev' },
    { usage: 'lm build server', description: '拉取、检查环境并构建 server 项目' },
    { usage: 'lm build web', description: 'Linux 上构建 web 项目，Windows/macOS 上启动 web 本地开发服务' },
    { usage: 'lm build admin', description: 'Linux 上构建 admin 项目，Windows/macOS 上启动 admin 本地开发服务' },
    { usage: 'lm build help', description: '显示 build 子命令帮助信息' },
  ],
  check: [
    { usage: 'lm check', description: '按顺序检查 server、web、admin' },
    { usage: 'lm check server', description: '检查 server 项目并补全 .env 空值' },
    { usage: 'lm check web', description: '检查 web 项目，当前仅提示暂无检查项' },
    { usage: 'lm check admin', description: '检查 admin 项目，当前仅提示暂无检查项' },
    { usage: 'lm check help', description: '显示 check 子命令帮助信息' },
  ],
  mysql: [
    { usage: 'lm mysql', description: '输出当前配置文件中的本地 MySQL 配置' },
    { usage: 'lm mysql init', description: '初始化本地 lumu99 数据库并执行 server 迁移脚本' },
    { usage: 'lm mysql user', description: '向 lumu99.users 表创建一个本地用户' },
    { usage: 'lm mysql help', description: '显示 mysql 子命令帮助信息' },
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
    '- 已执行过 lm init 的环境下，lm、lm help、lm init、lm build、lm check、lm mysql 每天第一次执行时会先检查 lm-tool 是否有更新',
    '- lm init 只有在输入完整命令 lm init 时才会执行初始化，lm init help 只显示帮助',
    '- lm init 在进入交互前会检查本机 JDK 17、Maven 3.6.3 or later、MySQL 8、Redis 6+',
    '- build 命令才会拉取 server、web、admin 仓库最新代码',
    '- lm build web 和 lm build admin 在 Linux 上执行 npm run build，在 Windows/macOS 上会新开终端窗口执行 npm run dev',
    '- lm update 会立刻手动检查并更新 lm-tool，自身更新后需要重新执行目标命令',
    '- lm build server 会在 git pull 后对齐 .env.example 的纯新增项，再执行 lm check server',
    '- lm check server 只处理配置中 server 项目目录下的 .env 和 .env.example',
    '- lm mysql init 会使用配置中的 projects.server 路径定位 server 迁移目录',
    '- 所有外部命令都会实时透传原始输出信息',
    '- 每个外部命令结束后都会输出 [INFO] 和 =======================',
  ].join('\n');
}
