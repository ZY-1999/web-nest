# Archive (LLM): 将 src/utils 移动至 src/shared/utils

## 1. Task Snapshot

- **Goal**: 将 `src/utils/` 整体移至 `src/shared/utils/`，统一跨进程共享代码根目录
- **In-Scope**: 9 文件移动 + 25 文件 import 替换 + 2 文档更新
- **Out-of-Scope**: `src/main/utils/paths.ts`、代码逻辑改动、barrel export

## 2. Stable Facts & Constraints

- `@` 别名在所有 vite 配置和 vitest 配置中统一指向 `src/`，import 路径 `@/shared/utils/xxx` 可无缝解析
- `src/main/utils/paths.ts` 是 main 进程专属工具，使用相对路径引用（`./utils/paths`、`../utils/paths`），与顶层 utils 无关
- 移动后的模块内部引用（`log/index.ts` → `serialize`）使用 `@/shared/utils/serialize` 绝对别名

## 3. Interfaces & Contracts

- API / Schema / Event: 无变化
- 所有对外导出（`Singleton`, `serialize`, `deserialize`, `logger`, `logManager`, `TypedEmitter`, `isDev`, `AsyncifyFunctions`）签名和行为完全不变
- Breaking Change: No

## 4. Code Touchpoints

- **Entry Points**: 无变化（三进程入口文件仅 import 路径变更）
- **Core Files/Modules**:
  - `src/shared/utils/singleton.ts` — @Singleton 装饰器，被 Channel、ServiceRegistry、WindowManager、ViewManager 等核心模块依赖
  - `src/shared/utils/serialize/index.ts` — 序列化/反序列化，被 Channel IPC 和日志系统依赖
  - `src/shared/utils/log/index.ts` — 统一日志，被所有进程使用
  - `src/shared/utils/typedEmitter.ts` — 事件发射器，被 WindowManager 和 ViewManager 使用
- **Hotspots & Risks**: 无新增风险点

## 5. Accepted Patterns / Rejected Paths

- **Accepted**:
  - `git mv` 保留历史 + `sed` 批量替换 `@/utils/` → `@/shared/utils/`
  - 别名路径替换而非相对路径，避免目录层级变化导致的多处维护
- **Rejected**:
  - 不为 `src/shared/utils/` 添加 barrel export（保持最小变更）
  - 不移动 `src/main/utils/paths.ts`（它不属于共享代码）

## 6. Reuse Hints for Future Tasks

- **推荐复用步骤**: 类似目录移动任务可复用本流程 — `git mv` → `grep -rl` + `sed -i` 批量替换 → 全量验证
- **常见坑位与规避**:
  - 注意区分同名子目录（本例中 `src/utils/` vs `src/main/utils/`）
  - 文档中的引用可能不带尾随斜杠（`src/utils` vs `src/utils/`），需单独检查
  - 内部交叉引用（如 `log/index.ts` 引用 `serialize`）不要遗漏

## 7. Trace to Sources

| Statement | Source File | Section / Evidence |
|---|---|---|
| 9 文件移动清单 | `docs/specs/2026-05-30_sdd-move-utils-to-shared.md` | §1.6 被移动文件清单 |
| 25 文件 import 变更 | `docs/specs/2026-05-30_sdd-move-utils-to-shared.md` | §1.6 需更新 import 的文件 |
| 三轴评审 PASS | `docs/specs/2026-05-30_sdd-move-utils-to-shared.md` | §6 Review Verdict |
| paths.ts 未触及 | git diff (0 changes) | Out of Scope 验证 |
