# Git Contract

本仓库的 git 工作流约定 —— 分支策略、提交信息规范，以及什么可以/不可以进入仓库。SDD skills 在向仓库写入文档或代码时遵循本约定，并**为每次写入声明其 git 语义**。

## 分支策略：Solo

直接在当前分支上开发，**不创建 feature 分支**。

## 提交信息

- 引用 issue slug（如 `feat(login-redirect): refresh-token rotation`）。本仓库的 slug 取自 `.scratch/<YYYY-MM-DD>-<slug>/` 的目录名。
- 遵循本仓库既有的提交信息与 pre-commit 约定（见下）。
- **本仓库约定**：Conventional Commits 前缀 —— `feat` / `fix` / `docs` / `test` / `refactor` / `perf` / `chore` / `build` / `ci` / `style`，可选 scope（如 `test(e2e)`）；**无 sign-off、无 issue key**。（依据：`git log` 历史一贯如此。）

## 可进入仓库的内容

- `.scratch/` —— issue tracker；issue 是 `spec` / `prd` / `bug` 的载体。
- `CONTEXT.md`、`docs/adr/`、`docs/codemap/` —— 领域文档与代码地形。随相关 spec 一起提交（`/tdd` 关闭 spec 时），或在 `/sdd-flow` 的 summarize 步骤提交。
- `docs/agents/` —— 本配置。`/setup-skills` 运行或被编辑时提交。

## 不可进入仓库的内容

- `/handoff` 输出 —— 写到 OS 临时目录，绝不进仓库。
- 本地凭据、`.env`、API key、token。
- Agent 运行数据（`.agent-memory/`、本地 SQLite / Milvus Lite db、trace / episode / candidate / asset）。

## 为每次写入声明 git 语义

当 skill 向仓库写入文档或代码文件时，用一行声明该写入的 git 语义 —— 落到哪个 commit，或保持未提交（及原因）。示例：

- `/to-prd` 发布 `prd`：_"写入 PRD 到 `.scratch/`；未提交 —— Gate 0 通过后，由 `/sdd-flow` 在入口处统一提交。"_
- `/to-spec` 落 spec 骨架：_"写入 specs 到 `.scratch/.../specs/`；未提交 —— Gate A 后由 `/sdd-flow` 统一提交。"_
- `/tdd` 关闭 spec：_"写入代码 + 测试 + 翻转 status，并在 spec 关闭时提交。"_
- `/codemap` 在构建中刷新 map：_"写入 `docs/codemap/<map>.md`；随当前 spec 的关闭提交。"_

只读取、或写到仓库外（如 `/handoff` 写临时目录）的 skill 不需要声明。
