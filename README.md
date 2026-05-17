# lm-tool

`lm-tool` 是一个用于 `lumu99` 项目的 DevOps 命令行工具。



## 使用前提

当前版本是源码安装方式，使用前需要先安装：

- `Node.js`
- `npm`
- `JDK 17`
- `Maven 3.9+`
- `MySQL 8`
- `Redis 6+`

Linux 额外要求：

- `lm build server` 在重启 Linux 服务时会执行 `sudo systemctl restart <service>`
- 机器需要为对应服务管理命令配置免密 `sudo`
- `git`、`npm`、`mvn` 仍然使用普通用户执行，不会统一提升为 `root`

然后把本仓库拉到本地。

## 直接使用 `lm` 命令

初次使用需要先在 `lm-tool` 项目目录执行一次：

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
lm init help
lm build
lm build help
lm build server
lm build web
lm build admin
lm check
lm check help
lm check server
lm mysql
lm mysql help
lm mysql init
lm mysql user
lm update
```

说明：

- 在已经生成 `lm.config.json` 的前提下，`lm`、`lm help`、`lm init`、`lm build...`、`lm check...`、`lm mysql...` 每天第一次执行时会先检查 `lm-tool` 是否需要更新
- `lm init help` 只显示初始化帮助，不会执行初始化
- `lm init` 会先检查本机 `JDK 17`、`Maven 3.9+`、`MySQL 8`、`Redis 6+`
- 只有 `build` 命令会拉取 `server` / `web` / `admin` 仓库最新代码
- `lm build web` 和 `lm build admin` 在 Linux 上执行 `npm run build`，在 Windows / macOS 上会新开终端窗口执行 `npm run dev`
- `lm mysql` 用于查看本地 MySQL 配置，`lm mysql init` 和 `lm mysql user` 用于初始化本地数据库与创建本地用户
- `lm update` 会立即手动检查并更新 `lm-tool`

## 直接从源码运行

如果你暂时不想安装全局 `lm` 命令，也可以直接运行源码：

```bash
node src/index.js help
node src/index.js init
node src/index.js init help
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

执行 `lm init` 时，会先检查以下本机环境版本：

- `JDK` 必须是 `17`
- `Maven` 必须是 `3.9+`
- `MySQL` 必须是 `8`
- `Redis` 必须是 `6+`

如果任意一项缺失、命令不可用或版本不满足，`lm init` 会先输出详细中文提示并终止，不会进入交互式初始化。

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
- Linux 下重启服务时只对服务管理命令使用 `sudo`
- Linux 机器需要为 `sudo systemctl restart <linuxServiceName>` 配置免密执行

### `lm build web`

会依次执行：

- 输出 `正在拉取 web 仓库最新代码`，执行 `git pull`
- `npm install`

Linux 下：

- `npm run build`

Windows 和 macOS 下：

- 新开一个可见终端窗口执行 `npm run dev`
- 在新窗口中直接查看原始 dev 输出和本地访问端口
- 关闭该窗口即可停止对应的 web 本地开发服务

### `lm build admin`

会依次执行：

- 输出 `正在拉取 admin 仓库最新代码`，执行 `git pull`
- `npm install`

Linux 下：

- `npm run build`

Windows 和 macOS 下：

- 新开一个可见终端窗口执行 `npm run dev`
- 在新窗口中直接查看原始 dev 输出和本地访问端口
- 关闭该窗口即可停止对应的 admin 本地开发服务

### `lm build`

会按下面顺序依次执行：

1. `server`
2. `web`
3. `admin`

特性说明：

- 工具会把原始命令输出实时打印到终端
- 每个外部命令结束后都会输出 `[INFO] ...` 和 `=======================`
- 任何一步失败后会立即停止
- Linux 上的 `web` / `admin` 会产出构建结果，Windows 和 macOS 上的 `web` / `admin` 会分别打开新的 dev 窗口

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

## MySQL 说明

### `lm mysql`

会输出当前配置文件中的本地 MySQL 配置：

- 端口
- 用户名
- 密码状态：未配置 / 空密码 / 已设置密码

然后提示你执行 `lm mysql help` 查看详细帮助。

### `lm mysql init`

会执行以下流程：

1. 如果 `lm.config.json` 中没有完整的 MySQL 连接配置，则依次提示输入：
   - 本地 MySQL 端口，默认 `3306`
   - 本地 MySQL 用户名，默认 `root`
   - 本地 MySQL 密码，直接回车表示空密码
2. 将补录后的 MySQL 配置写回 `lm.config.json`
3. 从配置中的 `projects.server` 路径定位 `src/main/resources/db/migration`
4. 检查本地 MySQL 中是否已存在 `lumu99` 数据库
5. 如果已存在，则通过上下键提示：
   - `确认删除并重建`
   - `取消初始化`
6. 执行：

```sql
create schema lumu99 collate utf8mb4_unicode_ci;
```

7. 按版本顺序逐个执行 `V<number>__*.sql` 迁移文件

说明：

- `lm mysql init` 依赖配置中的 `projects.server` 路径
- 如果还没有执行过 `lm init`，会在保存 MySQL 配置后提示你先完成 `lm init`
- 所有 `mysql` 外部命令同样会实时透传原始输出，并在结束后打印 `[INFO] ...`

### `lm mysql user`

会执行以下流程：

1. 如果 `lm.config.json` 中没有完整的 MySQL 连接配置，则先补录并保存
2. 提示输入要创建的用户名和密码，密码为明文可见输入
3. 通过上下键选择角色：`ADMIN` 或 `USER`
4. 使用 `bcrypt` 生成版本 `2a`、cost `10` 的密码哈希
5. 向 `lumu99.users` 表插入一条本地用户数据

说明：

- `user_uuid`、`weibo_uid`、`weibo_link`、`t_family_id` 会自动生成随机值
- 可为空的字段会写入 `null`
- `status`、`mute_status`、时间字段使用数据库默认值

### `lm mysql help`

显示 `mysql` 命令的子命令帮助。

### `lm update`

会立即检查当前 `lm-tool` 仓库是否有更新：

- 如果已经是最新代码，则提示无需更新
- 如果拉取到了新代码，则提示你重新执行需要的命令
- `lm update` 自身不会自动重启
- 即使当天已经执行过自动检查，`lm update` 仍然会再次检查

## 帮助说明

- `lm help`：显示顶层命令帮助
- `lm init help`：显示 `init` 子命令帮助
- `lm build help`：显示 `build` 子命令帮助
- `lm check help`：显示 `check` 子命令帮助
- `lm mysql help`：显示 `mysql` 子命令帮助

## 自更新说明

- `lm-tool` 自更新检查的是当前 `lm-tool` 本地仓库
- 自动检查只会在已存在 `lm.config.json` 时启用，并把当天检查日期记录到 `selfUpdate.lastCheckedDate`
- 如果当天已经检查过，后续 `lm`、`lm help`、`lm init`、`lm build...`、`lm check...`、`lm mysql...` 不会重复检查
- 如果检测到远端有新代码，且本地仓库干净，会自动拉取最新代码
- 自动检查拉取到新代码后，会提示并重新执行当前命令
- 如果检测到远端有新代码，但本地仓库有变更，会提示用户通过上下键选择：
  - `回退本地变更并更新`
  - `跳过更新，继续执行当前命令`
- 如果选择更新，自动检查会先拉取 `lm-tool` 最新代码，再继续当前命令
- `lm update` 为手动更新入口，不受“当天已检查过”的限制

## 配置文件位置

配置文件名为：

```bash
lm.config.json
```

其中 `server.linuxUseSudoForServiceCommands` 用于控制 Linux 服务管理命令是否包一层 `sudo`：

- Linux 新配置默认写入 `true`
- 旧 Linux 配置即使缺少这个字段，运行时也会默认按 `true` 处理
- Windows 和 macOS 不使用这个字段

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
