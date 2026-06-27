# Issue tracker: 本地 Markdown（.scratch/）

本仓库的 issue 以 markdown 文件形式存放在仓库根的 `.scratch/`。在 SDD 流程里，**一个 issue 是三种工作之一的载体** —— `spec` / `prd` / `bug`。

## 目录约定

- 一个 feature 一个目录：`.scratch/<YYYY-MM-DD>-<feature-slug>/`
- 每个 issue：`.scratch/<YYYY-MM-DD>-<feature-slug>/specs/<NN>-<slug>.md`，从 `01` 起编号
- 每个 issue 文件顶部附近带：
  - `Type:` 行 ——
    - `spec` — 原子实现单元，`/tdd` 的最小对象，叶
    - `prd` — 产品需求文档，`/to-spec` 把它分解为 `spec` 的父
    - `bug` — bug 报告，修复需多步时由 `/to-spec` 分解为 `spec` 的父
  - `Status:` 行 —— triage 状态，见 `triage-labels.md`
- 评论与对话历史追加到文件底部 `## Comments` 章节下

最小 issue 文件示例：

```markdown
# Fix login redirect loop

Type: bug
Status: needs-triage

<bug 报告 / spec / PRD 正文>

## Comments

- 2026-06-18 — reproduced on staging with…
```

## "发布到 issue tracker" 时

在 `.scratch/<YYYY-MM-DD>-<feature-slug>/specs/` 下新建文件（必要时创建目录），写正确的 `Type:` 行。

## "获取相关 ticket" 时

读取引用路径对应的文件。用户通常会直接传路径或 issue 编号。
