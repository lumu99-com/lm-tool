# AGENTS

`lm-tool` 的长期行为规则如下：

- 执行 `lm`、`lm help`、`lm init`、`lm build...` 前，先检查 `lm-tool` 自身仓库是否需要更新
- `build` 命令才负责拉取 `server`、`web`、`admin` 业务仓库最新代码
- 所有外部命令必须实时透传原始 stdout / stderr
- 所有提示文案统一使用详细中文，明确说明动作和对象
- 每个外部命令结束后都要输出 `[INFO] ...`，然后输出 `=======================`
