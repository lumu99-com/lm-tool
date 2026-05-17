# lm-tool

`lm-tool` 是一个用于 `lumu99` 项目的 DevOps 命令行工具。

当前支持的命令：

- `lm init`
- `lm build help`
- `lm build server`
- `lm build web`
- `lm build admin`
- `lm build`
- `lm check help`
- `lm check server`
- `lm check web`
- `lm check admin`
- `lm check`
- `lm help`

所有 `lm` 命令在正式执行前，都会先检查 `lm-tool` 自身仓库是否有更新。

## 使用前提

当前版本是源码安装方式，使用前需要先安装：

- `Node.js`
- `npm`

然后把本仓库拉到本地。

## 直接使用 `lm` 命令

如果你希望直接输入：

```bash
lm build
```

需要先在 `lm-tool` 项目目录执行一次：

```bash
npm run setup:global
```

这个命令的作用是：

- 执行 `npm link`，把当前项目注册成全局命令 `lm`
- 在 Windows 下额外处理 npm 生成的 `lm.ps1`，避免 PowerShell 因执行策略拦截，自动改为走 `lm.cmd`

执行完成后，就可以直接使用：

```bash
lm help
lm init
lm build
lm build help
lm build server
lm build web
lm build admin
lm check
lm check help
lm check server
```

说明：

- `lm`、`lm help`、`lm init`、`lm build...`、`lm check...` 在执行前都会先检查 `lm-tool` 是否需要更新
- 只有 `build` 命令会拉取 `server` / `web` / `admin` 仓库最新代码

## 新机器安装步骤

在新的机器上，推荐按下面步骤使用：

```bash
git clone <lm-tool 仓库地址>
cd lm-tool
npm run setup:global
lm init
lm build
```

说明：

- 这是“源码安装版”，不是独立可执行文件版
- 新机器上同样需要先安装 `Node.js` 和 `npm`
- `npm run setup:global` 只需要执行一次

## 直接从源码运行

如果你暂时不想安装全局 `lm` 命令，也可以直接运行源码：

```bash
node src/index.js help
node src/index.js init
node src/index.js build server
node src/index.js build
```

也可以使用：

```bash
npm start -- help
```

## 初始化说明

首次使用先执行：

```bash
lm init
```

初始化流程会：

- 通过上下键选择当前平台：`Windows` / `macOS` / `Linux`
- 通过上下键选择仓库状态：`已拉取三个仓库` / `拉取了部分仓库` / `未拉取仓库`
- 如果仓库已存在，输入本机仓库路径
- 如果仓库缺失，输入项目父目录，工具会自动创建目录并执行 `git clone`
- 最终生成配置文件 `lm.config.json`

如果仓库拉取权限不足，工具会提示：

`仓库拉取失败，如无权限请联系 @幻仔`

## 构建说明

### `lm build server`

会依次执行：

- 输出 `正在拉取 server 仓库最新代码`，执行 `git pull`
- 对比 `git pull` 前后的 `.env.example`
- 只把 `.env.example` 中纯新增的 key / 注释增量补到 `.env`
- 执行 `lm check server`
- `mvn clean package -DskipTests`
- 在 `target` 目录中查找版本号 jar，例如 `lumu99-server-1.1.8.jar`
- 复制为固定文件名 `target/lumu99-server.jar`
- 重启服务

说明：

- 不会覆盖 `.env` 中已存在的值
- 不会删除 `.env` 中已有内容
- 只处理配置文件中 `server` 项目路径下的 `.env` 和 `.env.example`

### `lm build web`

会依次执行：

- 输出 `正在拉取 web 仓库最新代码`，执行 `git pull`
- `npm install`
- `npm run build`

### `lm build admin`

会依次执行：

- 输出 `正在拉取 admin 仓库最新代码`，执行 `git pull`
- `npm install`
- `npm run build`

### `lm build`

会按下面顺序依次执行：

1. `server`
2. `web`
3. `admin`

特性说明：

- 工具会把原始命令输出实时打印到终端
- 每个外部命令结束后都会输出 `[INFO] ...` 和 `=======================`
- 任何一步失败后会立即停止

## 检查说明

### `lm check`

会按下面顺序依次执行：

1. `lm check server`
2. `lm check web`
3. `lm check admin`

### `lm check server`

会检查配置文件中 `server` 项目路径下的环境文件：

1. 如果不存在 `.env`，则从 `.env.example` 复制生成
2. 如果 `.env` 和 `.env.example` 都不存在，则提示跳过
3. 检查 `.env` 中所有空值，例如 `spring.datasource.username=`
4. 逐个提示你输入值，并立即写回 `.env`

### `lm check web`

当前仅输出：`web 暂无检查项`

### `lm check admin`

当前仅输出：`admin 暂无检查项`

### `lm check help`

显示 `check` 命令的子命令帮助。

## 帮助说明

- `lm help`：显示顶层命令帮助
- `lm build help`：显示 `build` 子命令帮助
- `lm check help`：显示 `check` 子命令帮助

## 自更新说明

- `lm-tool` 自更新检查的是当前 `lm-tool` 本地仓库
- 如果检测到远端有新代码，且本地仓库干净，会自动拉取最新代码
- 如果检测到远端有新代码，但本地仓库有变更，会提示用户通过上下键选择：
  - `回退本地变更并更新`
  - `跳过更新，继续执行当前命令`
- 如果选择更新，工具会先拉取 `lm-tool` 最新代码，再继续当前命令

## 配置文件位置

配置文件名为：

```bash
lm.config.json
```

配置文件会写在当前 CLI 入口文件旁边。

如果你是通过源码方式运行：

```bash
node src/index.js
```

那么配置文件会写在 `src/index.js` 所在目录旁边。

## 当前交付形态

当前仓库已经支持：

- 直接源码运行
- 通过 `npm run setup:global` 安装成全局 `lm` 命令

当前仓库还没有完成验证通过的三平台独立可执行文件打包流程。
