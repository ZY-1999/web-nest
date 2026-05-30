# Archive (Human): 将 src/utils 移动至 src/shared/utils

## 1. Executive Summary

- **背景与目标**: 项目中跨进程共享工具代码（Singleton、日志、序列化、TypedEmitter 等）位于顶层 `src/utils/`，而其他跨进程共享代码均在 `src/shared/`。本次重构将 `src/utils/` 整体移入 `src/shared/utils/`，统一组织结构。
- **本次归档范围**: Feature Spec + 完整变更记录
- **结论摘要**: 纯重命名重构，25 个文件的 import 路径更新，116 测试全通过，无回归。三轴评审 PASS。

## 2. Scope & Sources

- Archive Mode: `snapshot`
- Source Targets:
  - `docs/specs/2026-05-30_sdd-move-utils-to-shared.md`
- Time Window: 2026-05-30

## 3. Key Decisions

- **决策 1**: 使用 `git mv` 移动文件以保留 git 历史追踪
- **决策 2**: 使用 `@/` 别名路径统一替换，避免相对路径维护负担
- **决策 3**: `src/main/utils/paths.ts` 不移动 — 它是 main 进程专属工具，不属于跨进程共享代码

## 4. Outcomes & Business Impact

- **已完成能力**: `src/shared/` 现在是唯一的跨进程共享代码根目录
- **验收结果**: typecheck ✅ lint ✅ test (116/116) ✅ 无残留引用 ✅
- **业务影响/收益**: 新增共享工具时放置位置不再有歧义，模板使用者的项目结构更清晰

## 5. Risks & Follow-ups

- **已知风险**: 无
- **后续建议**:
  - 可考虑为 `src/shared/utils/` 添加 barrel export (`index.ts`)，进一步简化引用路径
  - `docs/code-style.md` 若有引用旧路径需同步检查

## 6. Trace to Sources

| Conclusion | Source File | Section / Evidence |
|---|---|---|
| 移动 9 文件、更新 25 文件 import | `docs/specs/2026-05-30_sdd-move-utils-to-shared.md` | §1.6 Research Findings |
| 三轴评审全 PASS | `docs/specs/2026-05-30_sdd-move-utils-to-shared.md` | §6 Review Verdict |
| paths.ts 未触及 | git diff (0 changes on src/main/utils/) | Out of Scope 验证 |
