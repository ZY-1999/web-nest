# Domain Docs

SDD skills 探索代码库时应如何消费本仓库的领域文档。

## 探索前先读

- 根目录 **`CONTEXT.md`**，或
- 根目录 **`CONTEXT-MAP.md`**（若存在，指向每个 context 的 `CONTEXT.md`，按主题读相关的那份）
- **`docs/adr/`** —— 读涉及你即将改动区域的 ADR。多 context 仓库还要看 `src/<context>/docs/adr/`

这些文件目前本仓库都还没有。若不存在，**静默继续**：不要标记缺失、不要建议先建。`/domain-modeling` skill（经 `/grill-with-docs`、`/improve-codebase-architecture` 触达）会在术语或决策真正确定时懒创建它们。本项目的长期规则、踩坑记录现沉淀在 `AGENTS.md`。

## 文件结构（Single-context）

```
/
├── CONTEXT.md        ← 待创建（按需）
├── docs/adr/         ← 待创建（按需）
└── src/
```

## 用 glossary 的词汇

输出中提到领域概念时（issue 标题、重构提案、假设、测试名），用 `CONTEXT.md` 里定义的术语，不要漂移到 glossary 明确回避的同义词。

若需要的概念还不在 glossary 里 —— 这是一个信号：要么你在发明项目不用的语言（重新考虑），要么存在真实空缺（记给 `/domain-modeling`）。

## 标记 ADR 冲突

若你的输出与某条现存 ADR 矛盾，显式提出，而非静默覆盖：

> _与 ADR-0007 矛盾 —— 但值得重开，因为…_
