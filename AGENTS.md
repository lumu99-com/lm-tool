# AGENTS

`lm-tool` 的长期行为规则如下：

- 执行 `lm`、`lm help`、`lm init`、`lm build...`、`lm check...` 前，先检查 `lm-tool` 自身仓库是否需要更新
- 只有 `build` 命令负责拉取 `server`、`web`、`admin` 业务仓库最新代码
- 所有外部命令必须实时透传原始 `stdout` / `stderr`
- 所有提示文案统一使用详细中文，明确说明动作和对象
- 每个外部命令结束后都要输出 `[INFO] ...`，然后输出 `=======================`
- 新规则必须能够根据配置文件适配不同系统，不能写死平台行为
- `check server` 和 `build server` 处理的 `.env`、`.env.example` 必须基于配置里的 `projects.server` 路径，不能写死成字面量 `server/.env`
- `lm build server` 在 `git pull` 后，要先把 `.env.example` 中纯新增的 key / 注释增量补进 `.env`，再执行 `lm check server`
- 创建新的命令规则时，要把介绍写入父级 help，例如 `lm mysql init` 也要同步写入 `lm mysql help`
