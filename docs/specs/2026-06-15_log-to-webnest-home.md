# SDD Spec: 日志目录迁移到 ~/.web-nest/log/（受 WEB_NEST_HOME 控制）

> Spec 层级：`Feature Spec`
> 创建：2026-06-15

## 0. Open Questions

- [x] 无

## 1. Requirements (Context)

- **Goal**: 把应用日志从 electron-log 默认目录 `%APPDATA%/web-nest/logs/main.log` 迁移到 `~/.web-nest/log/main.log`，使其与配置目录、缓存目录一样由 `WEB_NEST_HOME` 环境变量统一控制。
- **In-Scope**:
  - 在 `paths` 对象新增 `getLogDir()`，返回 `<getWebNestBaseDir()>/log`，且自动 `mkdirSync(dir, { recursive: true })`（与 `getConfigDir/getCacheDir` 一致风格）。
  - 在 `logManager.initLog({...})` 调用处（`src/main/index.ts`）传入 `logDir: paths.getLogDir()`，让 `resolvePathFn` 兜底落到该目录下的 `main.log`。
  - 新增针对 `getLogDir()` 的单元测试。
- **Out-of-Scope**:
  - 不迁移旧目录 `%APPDATA%/web-nest/logs/` 下已有的 `main.log` / `main.old.log`（日志会重新生成，迁移无业务价值）。
  - 不清理旧目录（避免破坏其他可能的引用；如需可由用户手动删除）。
  - 不改 `maxSize` / `level` / `format` / 轮转策略。
  - 不动 preload / renderer 的 `initLog()` 调用（renderer 日志通过 IPC 走主进程，文件落点由主进程决定）。
- **Acceptance / Done Contract**:
  1. 设置 `WEB_NEST_HOME=/tmp/xxx` 启动后，日志写到 `/tmp/xxx/log/main.log`。
  2. 不设 `WEB_NEST_HOME` 时，日志写到 `~/.web-nest/log/main.log`。
  3. `pnpm run typecheck` 通过。
  4. `pnpm run test` 全绿（含新增 `getLogDir` 测试）。

## 1.1 Context Sources

- Requirement Source: 用户指令 `/sdd-riper-one` 参数「修改到 ~/.web-nest/log/ 由 WEB_NEST_HOME 控制」。
- Design Refs:
  - [src/shared/utils/log/index.ts](../../src/shared/utils/log/index.ts) — `LogConfig.logDir` 兜底逻辑已存在（L84-L106）。
  - [src/main/utils/paths.ts](../../src/main/utils/paths.ts) — 现有 `getWebNestBaseDir/getConfigDir/getCacheDir/getSessionDir` 模式。
  - [src/main/index.ts:37-48](../../src/main/index.ts#L37-L48) — `logManager.initLog({...})` 当前未传 `logDir`。
- Chat/Business Refs: 本轮对话中已确认当前日志位于 `%APPDATA%/web-nest/logs/`，且确认其与 `WEB_NEST_HOME` 无关。
- Extra Context: electron-log `resolvePathFn` 在未提供自定义 subDir 时返回空串，最终路径为 `path.join(logDir, '', 'main.log')`，结果正确。

## 1.5 Codemap Used (Feature/Project Index)

- Codemap Mode: 未生成（任务小、影响面集中，无需独立 codemap）。
- Key Index:
  - Entry: `src/main/index.ts` `main()` -> `logManager.initLog({...})`。
  - Log infra: `src/shared/utils/log/index.ts` `initLog()` 主进程分支 -> `mainLog.transports.file.resolvePathFn`。
  - Path source of truth: `src/main/utils/paths.ts`。

## 1.6 Context Bundle Snapshot (Lite)

- Bundle Level: `Lite`（本任务上下文已在前序对话内齐备，无需额外 bundle 文件）。
- Key Facts:
  - electron-log 默认目录是 `%APPDATA%/<appName>/logs`，appName=`web-nest`，故现状为 `%APPDATA%/web-nest/logs/main.log`。
  - `paths.getWebNestBaseDir()` = `process.env.WEB_NEST_HOME || ~/.web-nest`。
  - `initLog` 已支持 `logDir` 入参，现有代码只需补传即可，无需改 log infra。
- Open Questions: 无。

## 1.7 Minimum Chaos Unit Assessment

- Final Goal: 日志受 `WEB_NEST_HOME` 统一控制，写到 `<base>/log/`。
- Current Task Unit: 在 `paths.ts` 加一个 `getLogDir()` + 在 `initLog` 调用处传 `logDir` + 单测。
- Why this unit is small enough: 仅 2 个源文件改动 + 1 个测试，无跨模块、无 IPC 契约变更、无破坏性 API。
- In-Scope Boundary: 见 §1 In-Scope。
- Out-of-Scope Boundary: 见 §1 Out-of-Scope。
- Verification Evidence: `typecheck` + `test`（新增 `getLogDir` 断言）+ 可选手动启动核对实际落点。
- Failure / Rework Plan: 若 `logDir` 未生效，回读 electron-log `resolvePathFn` 行为，确认 `variables.fileName` 兜底为 `main.log`。
- Model Autonomy Space: 可直接在已批准的 checklist 内执行；不需逐条确认（任务小）。
- User Decision: Accepted（待用户确认 Plan Approved 后执行）。

## 2. Research Findings

- 事实与约束:
  - `paths` 对象所有「数据目录」getter（`getConfigDir/getCacheDir/getSessionDir`）模式一致：`getWebNestBaseDir()` 拼子目录 + `fs.mkdirSync(dir, { recursive: true })`。`getLogDir()` 应沿用同一模式。
  - `initLog` 在 main 进程分支（[src/shared/utils/log/index.ts:84-106](../../src/shared/utils/log/index.ts#L84-L106)）中，当 `config.logDir` 提供时，`resolvePathFn` 返回 `path.join(logDir, subDir || '', variables.fileName ?? 'main.log')`；未提供 `resolveLogPath` 时 `subDir=''`，因此落点是 `logDir/main.log`，符合预期。
  - electron-log 文件 transport 也会尝试创建目录，但项目约定由 `paths` 层负责 `mkdir`，保持一致性并兜底。
  - 测试 mock（[src/__tests__/main/services/appConfig.test.ts:7-11](../../src/__tests__/main/services/appConfig.test.ts#L7-L11)）通过 `vi.mock('electron', ...)` 让 `app.getPath('home')` 返回 `/fake/path/home`，新增 `getLogDir` 测试可直接复用同套断言风格。
- 风险与不确定项:
  - 旧日志目录 `%APPDATA%/web-nest/logs/` 会残留（已在 Out-of-Scope 声明不迁移、不清理）。
  - `initLog` 在 `main()` 中是同步调用且未 `await`（现状即如此，与本次改动无关；electron-log 初始化早于首条业务日志，可接受）。
  - 注意用户要求是单数 `log`，不是默认的 `logs`——必须在 `getLogDir()` 中用 `'log'`。

## 2.1 Next Actions

- 进入 Plan，给出精确的 File Changes / Signatures / Checklist，等待 `Plan Approved`。

## 3. Innovate (Optional: Options & Decision)

- Skipped: true
- Reason: 单一路径已足够清晰，无方案分叉。

## 4. Plan (Contract)

### 4.1 File Changes

- `src/main/utils/paths.ts`: 在 `getSessionDir()` 之后新增 `getLogDir()` 方法，返回 `path.join(this.getWebNestBaseDir(), 'log')` 并 `fs.mkdirSync(dir, { recursive: true })`。
- `src/main/index.ts`: 在 `logManager.initLog({ ... })` 调用对象中追加 `logDir: paths.getLogDir()`（`paths` 已 import，见 [src/main/index.ts:10](../../src/main/index.ts#L10)）。
- `src/__tests__/main/services/appConfig.test.ts`: 在 `describe('paths')` 内新增 `it('getLogDir should return ~/.web-nest/log')`，断言为 `path.join('/fake/path/home', '.web-nest', 'log')`。

### 4.2 Signatures

- `paths.getLogDir(): string` —— 返回日志目录绝对路径，副作用：确保目录存在。
- `logManager.initLog({ level, maxSize, format, logDir })` —— 新增 `logDir` 字段（类型已存在于 `LogConfig.logDir?: string`）。

### 4.3 Implementation Checklist

- [ ] 1. 编辑 `src/main/utils/paths.ts`，在 `getSessionDir` 与 `getPreloadPath` 之间插入 `getLogDir()`。
- [ ] 2. 编辑 `src/main/index.ts` 的 `logManager.initLog({...})`，追加 `logDir: paths.getLogDir()`。
- [ ] 3. 编辑 `src/__tests__/main/services/appConfig.test.ts`，新增 `getLogDir` 测试用例。
- [ ] 4. 运行 `pnpm run typecheck`，确认通过。
- [ ] 5. 运行 `pnpm run test`，确认全绿（含新测试）。
- [ ] 6. （可选）启动应用前 `export WEB_NEST_HOME=/tmp/wn-test-log`，确认日志落到 `/tmp/wn-test-log/log/main.log`。

### 4.4 Spec Review Notes (Optional Advisory, Pre-Execute)

- Spec Review Matrix:
  | Check | Verdict | Evidence |
  |---|---|---|
  | Requirement clarity & acceptance | PASS | Goal/In-Scope/Out-of-Scope/Acceptance 齐全 |
  | Plan executability | PASS | 3 处精确改动 + 签名 + 原子 checklist |
  | Risk / rollback readiness | PASS | 低风险，回滚仅需删除 `logDir` 入参 |
- Readiness Verdict: GO（Advisory）
- Risks & Suggestions: 无阻塞项；用户要求 `log`（单数）需在代码中严格使用。

### 4.5 Route Alignment (Water Flow Check)

- Original assumption: 改 electron-log 默认路径。
- Current implementation route: 复用现有 `paths` 数据目录模式 + `initLog` 已支持的 `logDir` 入参。
- Why it fits code terrain: 与 `getConfigDir/getCacheDir/getSessionDir` 完全同构，不引入新约定。
- Scope impact: None。
- User Decision if route changed: N/A（无路线偏离）。

## 5. Execute Log

- [x] 1. 编辑 `src/main/utils/paths.ts`，在 `getSessionDir` 与 `getPreloadPath` 之间插入 `getLogDir()`。
- [x] 2. 编辑 `src/main/index.ts` 的 `logManager.initLog({...})`，追加 `logDir: paths.getLogDir()`。
- [x] 3. 编辑 `src/__tests__/main/services/appConfig.test.ts`，新增 `getLogDir` 测试用例。
- [x] 4. `pnpm run typecheck` —— 通过（`tsc --build` 无输出/无报错）。
- [x] 5. `pnpm run test` —— **16 files / 152 tests passed**；单独跑 paths 文件 **7 passed**（原 6 + 新增 `getLogDir`）。
- [~] 6. 手动启动验证 —— 跳过（证据链已完整，见 §6）。用户如需可在后续手动确认落点。

实际 diff（3 处）：
- [src/main/utils/paths.ts](../../src/main/utils/paths.ts#L24-L28)：新增 `getLogDir()`，返回 `getWebNestBaseDir()/log` 并 `mkdirSync(recursive)`。
- [src/main/index.ts:39](../../src/main/index.ts#L39)：`initLog({...})` 追加 `logDir: paths.getLogDir()`。
- [src/__tests__/main/services/appConfig.test.ts](../../src/__tests__/main/services/appConfig.test.ts)：新增 `getLogDir should return ~/.web-nest/log` 用例。

## 6. Review Verdict

- Review Matrix (Mandatory):
  | Axis | Key Checks | Verdict | Evidence |
  |---|---|---|---|
  | Spec Quality & Requirement Completion | Goal/In-Scope/Acceptance 完整；需求达成（日志目录由 `WEB_NEST_HOME` 控制，落点 `<base>/log`） | PASS | §1 + 单测断言 `~/.web-nest/log`；`logDir` 注入后 electron-log `resolvePathFn` 落点为 `<logDir>/main.log` |
  | Spec-Code Fidelity | 文件、签名、checklist、行为与 Plan 一致 | PASS | 3 处改动与 §4.1/§4.2 完全对应，无偏差 |
  | Code Intrinsic Quality | 正确性、鲁棒性、可维护性、测试、关键风险 | PASS | `getLogDir` 与 `getConfigDir/getCacheDir/getSessionDir` 同构；`mkdirSync` 兜底；新增单测覆盖；无 IPC/契约破坏 |
- Overall Verdict: **PASS**
- Blocking Issues: 无。
- Regression risk: **Low** —— 仅新增方法 + 新增 `initLog` 入参；electron-log 在未提供 `logDir` 时的默认行为被覆盖，但这是预期且是本次目标。旧目录 `%APPDATA%/web-nest/logs/` 残留不清理（Out-of-Scope）。
- Follow-ups:
  - 若需手动确认运行时落点：`export WEB_NEST_HOME=/tmp/wn-log` 后启动应用，检查 `/tmp/wn-log/log/main.log`。
  - 旧目录 `%APPDATA%/web-nest/logs/` 可由用户手动删除（含本任务执行前的历史日志）。
  - 闭环后可考虑同步到项目长期记忆（见 §9）。

## 7. Plan-Execution Diff

- 与 Plan 完全一致，无偏差。
- 唯一「跳过」项是 §4.3 Checklist 第 6 步（可选手动启动验证），已在 §5/§6 说明跳过理由：单测已验证 `getLogDir()` 返回正确路径，且 electron-log `resolvePathFn` 是确定性逻辑（`path.join(logDir, '', 'main.log')`），证据链完整。

## 9. Project Sync Candidates

- Candidate: 「日志目录由 `paths.getLogDir()` 提供，受 `WEB_NEST_HOME` 控制，落点 `~/.web-nest/log/main.log`；旧默认目录 `%APPDATA%/web-nest/logs/` 不自动迁移。」
- Suggested destination: `PROJECT_KNOWLEDGE.md`（路径约定类稳定事实），并在自动 memory `持久化约定` 区块更新「日志」条目。
- Sync decision: 待任务闭环后由用户确认是否同步（不主动提交）。
