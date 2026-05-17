# lm-tool

`lm-tool` 是一个用于 `lumu99` 项目的 DevOps 命令行工具。

当前支持的命令：

- `lm init`
- `lm build server`
- `lm build web`
- `lm build admin`
- `lm build`
- `lm help`

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
lm build server
lm build web
lm build admin
```

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

- `git pull`
- `mvn clean package -DskipTests`
- 在 `target` 目录中查找版本号 jar，例如 `lumu99-server-1.1.8.jar`
- 复制为固定文件名 `target/lumu99-server.jar`
- 重启服务

### `lm build web`

会依次执行：

- `git pull`
- `npm install`
- `npm run build`

### `lm build admin`

会依次执行：

- `git pull`
- `npm install`
- `npm run build`

### `lm build`

会按下面顺序依次执行：

1. `server`
2. `web`
3. `admin`

特性说明：

- 工具会把原始命令输出实时打印到终端
- 任何一步失败后会立即停止

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
