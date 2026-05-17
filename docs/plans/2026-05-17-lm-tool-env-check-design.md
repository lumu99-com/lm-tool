# lm-tool 环境检查与分层帮助设计

## 目标

为 `lm-tool` 增加环境检查命令、`server` 项目的 `.env` 自动补齐能力，以及 `help` / `build` / `check` 的分层帮助输出。

## 范围

本次设计覆盖以下能力：

- `lm check`
- `lm check help`
- `lm check server`
- `lm check web`
- `lm check admin`
- `lm build help`
- `lm build server` 对 `.env.example` 的增量同步
- `lm init` 在拉取 `server` 仓库后触发 `lm check server`

本次设计不改变：

- `web` 和 `admin` 的构建命令
- `.env` 已有配置的值
- `.env.example` 已有行的修改和删除同步策略

## 命令语义

### 顶层帮助

`lm help` 只显示顶层命令说明，包括：

- `lm init`
- `lm build`
- `lm check`
- `lm help`

### build 分层帮助

`lm build help` 显示以下命令说明：

- `lm build`
- `lm build server`
- `lm build web`
- `lm build admin`

### check 分层帮助

`lm check help` 显示以下命令说明：

- `lm check`
- `lm check server`
- `lm check web`
- `lm check admin`

### check 执行语义

`lm check` 是实际执行命令，不是帮助命令。执行时依次运行：

1. `lm check server`
2. `lm check web`
3. `lm check admin`

当前版本中：

- `lm check server` 执行真实检查
- `lm check web` 输出 `web 暂无检查项`
- `lm check admin` 输出 `admin 暂无检查项`

## server 环境文件规则

这里的 `.env` 和 `.env.example` 指的是配置文件 `projects.server` 对应目录下的文件，而不是字面上的 `server/.env` 路径。

例如：

- Windows: `D:\Project\lumu99\lumu99-server\.env`
- Linux: `/opt/lumu99/lumu99-server/.env`

### lm check server

`lm check server` 负责 `.env` 相关的实际检查和修复逻辑。

执行规则：

1. 读取配置中的 `projects.server`
2. 如果 server 项目路径不存在，直接报错并停止
3. 如果 `.env` 不存在且 `.env.example` 存在：
   - 从 `.env.example` 复制生成 `.env`
4. 如果 `.env` 不存在且 `.env.example` 也不存在：
   - 输出 `server 项目目录下未找到 .env.example，跳过检查`
   - 结束本次 `lm check server`
5. 解析 `.env`
6. 找出所有空值配置项，例如：
   - `spring.datasource.username=`
   - `spring.datasource.password=`
7. 逐个提示用户输入值，输入内容不隐藏
8. 每填写一个值后立即写回 `.env`

## init 与 check 的关系

`lm init` 不负责实现 `.env` 细节，而是在合适时机调用 `lm check server`。

规则：

- 只有本次 `lm init` 执行中实际拉取了 `server` 仓库，才在拉取完成后执行一次 `lm check server`
- 如果 `server` 仓库本次没有拉取，则 `lm init` 不自动执行 `lm check server`

## build server 与 .env.example 增量对齐

`lm build server` 在 `git pull` 之后，需要处理 `projects.server/.env.example` 的新增内容，但不能覆盖现有 `.env` 配置。

### 基本原则

- 只做增量对齐
- 不覆盖 `.env` 里已有 key 的值
- 不删除 `.env` 里的任何行
- 不处理 `.env.example` 中“修改旧行”或“删除旧行”的情况

### 对齐方式

实现时以 `git pull` 前后的 `.env.example` 文件内容对比为准，等价于只同步 diff 中纯新增的行。

#### 新增 key

如果 `.env.example` 新增了 key，且 `.env` 里不存在同名 key：

- 按照 `.env.example` 中的相对位置插入到 `.env`
- 如果该 key 带默认值，则连默认值一起写入
- 如果该 key 的值为空，例如 `XXX=`，先插入空值行

#### 新增注释

如果 `.env.example` 新增了纯注释行，且 `.env` 中还没有同样的注释：

- 按照 `.env.example` 中的相对位置插入到 `.env`

#### 修改旧行

如果 `.env.example` 是把旧注释或旧 key 改成了另一行，不做同步处理，避免覆盖现有配置。

### build server 与 check server 的关系

`lm build server` 的职责拆分如下：

1. `git pull`
2. 比较 pull 前后的 `.env.example`
3. 把纯新增 key / 注释增量补进 `.env`
4. 执行一次 `lm check server`
5. 继续后续的 `mvn clean package -DskipTests` 等构建步骤

如果增量对齐或 `lm check server` 失败，则停止后续构建。

## 输出与交互

- 所有提示文案保持中文
- 空值逐项提问时，不隐藏输入
- `lm check server` 在发现空值时，逐个列出并逐个提问
- `lm check web` / `lm check admin` 的输出也保持明确中文

## 失败处理

- 配置文件不存在：提示用户先执行 `lm init`
- `projects.server` 未配置：直接报错
- `.env.example` 不存在且 `.env` 也不存在：提示后跳过 `lm check server`
- `.env` 读写失败：立即报错并停止当前命令
- `.env.example` 增量对齐失败：停止 `lm build server`
- 用户在 `lm check server` 中途输入后，每个值立即写回，避免中断时全部丢失

## 文档同步

以下内容需要同步维护：

- `lm help`
- `lm build help`
- `lm check help`
- `README.md`
- `AGENTS.md`

## 非目标

本次设计不包括：

- `web` / `admin` 的 `.env` 检查逻辑
- 密码输入隐藏
- `.env.example` 修改旧行时的智能合并
- 删除 `.env` 中多余配置项
