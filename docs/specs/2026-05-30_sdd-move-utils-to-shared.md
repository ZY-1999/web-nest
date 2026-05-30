# Spec: 将 src/utils 移动至 src/shared/utils

> **阶段**: Review | **状态**: LOCKED | **层级**: Feature Spec

## 1. 目标与边界

### Goal
将顶层 `src/utils/` 目录整体移动至 `src/shared/utils/`，统一跨进程共享工具代码的组织位置，使 `src/shared/` 成为唯一的跨进程共享代码根目录。

### In Scope
- 移动 `src/utils/` 全部 8 个文件至 `src/shared/utils/`
- 更新所有 `@/utils/` import 路径为 `@/shared/utils/`
- 更新内部交叉引用（utils 内部文件之间的 import）
- 更新 `docs/codemap/` 中涉及 `src/utils/` 的引用
- 更新 `AGENTS.md` 中涉及 `src/utils/` 的描述

### Out of Scope
- 不改动 `src/main/utils/paths.ts`（这是 main 进程专属工具，与本次移动无关）
- 不改动工具代码本身的内容/逻辑
- 不引入新的 barrel export 或 API 变更

### Acceptance Criteria
1. `pnpm run typecheck` 通过 ✅
2. `pnpm run lint` 通过 ✅
3. `pnpm run test` 全量通过 ✅
4. 源码中不再存在 `from '@/utils/` 或 `from '../utils/` 的顶层 utils 引用 ✅
5. `src/utils/` 目录已被删除，所有文件位于 `src/shared/utils/` ✅

## 1.5 Code Map Used

- `docs/codemap/2026-05-29_12-00_electron-template项目总图.md` — 项目总览

## 1.6 Research Findings

### 被移动文件清单（9 个文件）

| 原路径 | 目标路径 |
|--------|---------|
| `src/utils/env.ts` | `src/shared/utils/env.ts` |
| `src/utils/promise.ts` | `src/shared/utils/promise.ts` |
| `src/utils/singleton.ts` | `src/shared/utils/singleton.ts` |
| `src/utils/type.ts` | `src/shared/utils/type.ts` |
| `src/utils/typedEmitter.ts` | `src/shared/utils/typedEmitter.ts` |
| `src/utils/log/index.ts` | `src/shared/utils/log/index.ts` |
| `src/utils/log/logSender.ts` | `src/shared/utils/log/logSender.ts` |
| `src/utils/log/types.ts` | `src/shared/utils/log/types.ts` |
| `src/utils/serialize/index.ts` | `src/shared/utils/serialize/index.ts` |

### 需更新 import 的文件（33 处引用，25 个文件）

**main 进程（10 文件）：**
- `src/main/index.ts` — `@/utils/log`, `@/utils/serialize`
- `src/main/mainWindow.ts` — `@/utils/env`, `@/utils/log`
- `src/main/nativeExample.ts` — `@/utils/log`
- `src/main/services/counterService.ts` — `@/utils/singleton`
- `src/main/services/updaterService.ts` — `@/utils/singleton`
- `src/main/updater/index.ts` — `@/utils/log`
- `src/main/windowManager/index.ts` — `@/utils/typedEmitter`, `@/utils/singleton`
- `src/main/windowManager/managedWindow.ts` — `@/utils/typedEmitter`
- `src/main/viewManager/index.ts` — `@/utils/typedEmitter`, `@/utils/singleton`
- `src/main/viewManager/managedView.ts` — `@/utils/typedEmitter`

**preload（1 文件）：**
- `src/preload/index.ts` — `@/utils/log`

**renderer（2 文件）：**
- `src/renderer/App.tsx` — `@/utils/log`
- `src/renderer/services/counterService.ts` — `@/utils/singleton`

**shared（5 文件）：**
- `src/shared/channel/index.ts` — `@/utils/singleton`, `@/utils/log`
- `src/shared/channel/impl.ts` — `@/utils/serialize`
- `src/shared/channel/portManager.ts` — `@/utils/singleton`, `@/utils/log`
- `src/shared/serviceRegistry/index.ts` — `@/utils/singleton`
- `src/shared/serviceRegistry/apiDefinitions.ts` — `@/utils/type`
- `src/shared/serviceRegistry/serviceMetadataRegistry.ts` — `@/utils/singleton`

**utils 内部引用（1 文件）：**
- `src/shared/utils/log/index.ts` → 内部引用 `@/shared/utils/serialize`

**测试文件（5 文件）：**
- `src/__tests__/main/serialize.test.ts` — `@/shared/utils/serialize`
- `src/__tests__/main/utils/singleton.test.ts` — `@/shared/utils/singleton`
- `src/__tests__/preload/utils/singleton.test.ts` — `@/shared/utils/singleton`
- `src/__tests__/renderer/utils/singleton.test.ts` — `@/shared/utils/singleton`
- `src/__tests__/shared/type.test.ts` — `@/shared/utils/type`

### 别名机制

`@` 别名在 `vitest.config.mts` 和各 vite 配置中统一指向 `src/`，因此 `@/shared/utils/xxx` 移动后可无缝解析，无需修改配置文件。

## 3. Plan — 实施清单

### File Changes

所有变更均为 import 路径替换，`@/utils/` → `@/shared/utils/`，无代码逻辑改动。

### Implementation Checklist

- [x] 1. 创建目标目录 `src/shared/utils/`，移动全部 9 个文件
- [x] 2. 更新 main 进程文件的 import 路径（10 个文件）
- [x] 3. 更新 preload 文件的 import 路径（1 个文件）
- [x] 4. 更新 renderer 文件的 import 路径（2 个文件）
- [x] 5. 更新 shared 模块文件的 import 路径（5 个文件）
- [x] 6. 更新 utils 内部引用（1 处：`log/index.ts` 中的 `@/utils/serialize` → `@/shared/utils/serialize`）
- [x] 7. 更新测试文件的 import 路径（5 个文件）
- [x] 8. 删除原 `src/utils/` 目录
- [x] 9. 更新 `AGENTS.md` 中 `src/utils/` 相关引用
- [x] 10. 更新 `docs/codemap/2026-05-29_12-00_electron-template项目总图.md` 中 `src/utils/` 引用
- [x] 11. 运行 `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` 验证

### Validation

- `pnpm run typecheck`：✅ 通过
- `pnpm run lint`：✅ 通过（0 errors，2 warnings 为既有问题）
- `pnpm run test`：✅ 15 文件 / 116 用例全部通过
- `grep -r "@/utils/" src/`：✅ 无残留

## Open Questions

无。

## 6. Review Verdict

### Review Matrix

| 轴线 | 检查项 | 结果 | 证据 |
|------|--------|------|------|
| **Axis-1: Spec 质量 & 需求完成度** | Goal 清晰可验证 | PASS | "统一跨进程共享工具代码目录"，5 条 AC 全部满足 |
| | In/Out of Scope 边界清晰 | PASS | 明确排除 `src/main/utils/paths.ts`、逻辑改动、API 变更 |
| | Acceptance Criteria 全部通过 | PASS | typecheck ✅ lint ✅ test ✅ 无残留引用 ✅ 旧目录已删 ✅ |
| **Axis-2: Spec-Code 一致性** | 移动文件清单完全匹配 | PASS | git diff 显示 9 文件 `src/{ → shared}/utils/`，100% similarity（仅 log/index.ts 有 1 行 import 变更） |
| | 所有 import 替换完成 | PASS | 25 个文件 import 变更，`grep "@/utils/" src/` 返回 0 结果 |
| | Out of Scope 未被违反 | PASS | `src/main/utils/paths.ts` 无 diff，`mainWindow.ts` 仍使用 `./utils/paths` 相对路径 |
| | 代码逻辑无改动 | PASS | 所有移动文件仅 1 处 import 行变更（log/index.ts → serialize），其余 100% similarity |
| | 文档引用已更新 | PASS | AGENTS.md + CodeMap 中所有 `src/utils/` 已替换为 `src/shared/utils/` |
| **Axis-3: 代码内在质量** | 无回归风险 | PASS | 116 测试全通过，覆盖 main/preload/renderer/shared 四环境 |
| | 无新增 lint/type 错误 | PASS | typecheck 0 errors，lint 2 warnings 为既有未使用变量 |
| | 无安全/性能/架构隐患 | PASS | 纯重命名，运行时行为零变化 |

### Overall Verdict

**✅ PASS** — 三轴全部通过，无阻塞问题，无偏差。

### Plan-Execution Diff

无偏差。Plan 中 11 项 checklist 全部按序执行，无遗漏、无越权、无逻辑变更。
