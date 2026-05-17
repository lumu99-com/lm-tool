# lm build 前端平台分流设计

## 背景

当前 `lm build web` 和 `lm build admin` 在所有平台上都固定执行 `npm run build`。这适合 Linux 服务器场景，因为构建完成后会直接得到 `dist`，配合 Nginx 就能使用；但在 Windows 和 macOS 本地开发场景下，前端通常需要执行 `npm run dev` 才能获得本地访问端口，并通过关闭终端窗口来停止开发服务。

## 目标

- 保留 `lm build` 作为统一入口，不新增新的顶层命令。
- Linux 上继续保持现有前端构建语义：`git pull`、`npm install`、`npm run build`。
- Windows 和 macOS 上把 `lm build web` / `lm build admin` 改成启动可见终端窗口运行 `npm run dev`。
- `lm build` 在 Windows/macOS 上仍按 `server -> web -> admin` 顺序执行，其中 `web` 和 `admin` 会分别拉起新的终端窗口。
- 新窗口直接展示 `npm run dev` 的原始输出，方便用户查看端口并通过关闭窗口结束进程。

## 非目标

- 不新增 `lm dev` 命令。
- 不改造 `server` 的构建与重启逻辑。
- 不在当前终端中长期托管前端 dev 进程。

## 命令行为

### Linux

- `lm build web`
  - `git pull`
  - `npm install`
  - `npm run build`
- `lm build admin`
  - `git pull`
  - `npm install`
  - `npm run build`
- `lm build`
  - `server`
  - `web`
  - `admin`

### Windows / macOS

- `lm build web`
  - `git pull`
  - `npm install`
  - 新开终端窗口执行 `npm run dev`
  - 当前 `lm build web` 在新窗口成功拉起后结束
- `lm build admin`
  - 同上
- `lm build`
  - 正常执行 `server`
  - 为 `web` 新开终端窗口跑 `npm run dev`
  - 为 `admin` 新开终端窗口跑 `npm run dev`
  - 当前命令在两个窗口都成功发起后结束

## 平台实现

### Windows

- 通过 `powershell.exe` 调用 `Start-Process powershell.exe`
- 新窗口中执行：
  - 切换到项目目录
  - 输出一条中文提示
  - 执行 `npm run dev`
- 窗口保持可见，关闭窗口即可停止对应 dev 服务

### macOS

- 通过 `osascript` 控制 Terminal.app 新开标签页或窗口
- 在 Terminal 中执行：
  - `cd <projectDir>`
  - 输出中文提示
  - `npm run dev`
- 用户可直接在 Terminal 中查看端口并关闭窗口

## 受影响模块

- `src/core/build-plan.js`
  - 为 `web` / `admin` 生成平台相关的 build 或 dev 步骤
- `src/core/build-plan.test.js`
  - 覆盖 Linux 与 Windows/macOS 的计划差异
- `src/commands/build.js`
  - 处理新的“启动前端 dev 窗口”步骤
- `src/commands/build.test.js`
  - 覆盖 `lm build web` 在 Windows/macOS 上不再执行 `npm run build`
- `README.md`
  - 明确说明前端 `build` 的平台差异

## 约束与取舍

- 平台差异通过配置文件中的 `platform` 字段驱动，不根据当前 Node 进程平台硬编码分支。
- Windows/macOS 的 `lm build web/admin` 成功语义是“开发窗口已成功启动”，不是“dev 服务已完全 ready”。
- 当前终端无法继续透传 dev 进程输出，但新开的终端窗口会直接显示原始 `stdout/stderr`，满足本地查看端口与关闭窗口的需求。
