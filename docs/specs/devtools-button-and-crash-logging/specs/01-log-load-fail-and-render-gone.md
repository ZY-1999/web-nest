# Issue 01: 记录 did-fail-load 与 render-process-gone 事件到日志

Status: ready-for-agent

## Parent

[PRD — 标题栏 DevTools 按钮 + 加载/崩溃事件日志](../PRD.md)

## What to build

为 view 的加载失败和渲染进程崩溃提供端到端可观测性：任何 `ManagedView` 的 webContents 触发 `did-fail-load` 或 `render-process-gone` 时，向统一日志（`~/.web-nest/log/main.log`）写一条 error 级记录，包含诊断字段（URL / errorCode / errorDescription / reason / exitCode）。监听集中在 `ManagedView`，一次接线覆盖主 view、Web App 内容 view、标题栏 view。

为让该行为可在单元测试中验证，升级共享的 electron mock：使 `mockWebContents` 能捕获 `.on(event, handler)` 注册，并暴露测试用的 `emit(event, …args)`。

## Design rationale

- **切分与集中化**：PRD「Implementation Decisions > 加载/崩溃事件日志」与「Testing Decisions > 主接缝」——接线集中在 `ManagedView`，error 级，字段契约固定。
- **只记日志不恢复**：本会话用户决策"先不做白屏恢复，仅记录日志"——故本片显式排除占位/重试/reload/show-after-ready。
- **销毁安全**：AGENTS.md「销毁安全约定」——监听器随现有 `webContentsSubscriptions` 在 `destroy()` 解绑，不在调用层叠加 try-catch。
- **现状证据**：本会话代码探查确认 `ManagedView.setupWebContentsListeners` 当前只订阅 `did-finish-load`；`mocks/electron.ts` 中 `mockWebContents.on` 仅是 `vi.fn()`（不捕获 handler、无法 emit）——这正是 mock 升级必须折进本片而非单列的原因（纯基础设施片无用户可见行为，被 skill 禁止）。
- **被否决的替代方案**：
  - 把 `did-fail-load` 与 `render-process-gone` 拆成两片——否决，同一接线位置/同一 logger/同一测试接缝/同一 mock 升级，拆分会重复劳动。
  - 过滤 `ERR_ABORTED`——本轮否决，需保留全部证据（PRD 已声明）。

## Out of scope

- 恢复类 UI：错误占位页、重试按钮、reload 策略、加载期 loading 覆盖。
- 主窗口 loadURL 失败兜底（dialog / show-after-ready / `waitForLoad` + `ready-to-show` 替换 50ms `setTimeout`）。
- DevTools 按钮（见 issue 02 / 03）。
- GPU / CSP 改动。
- `errorCode` 静默过滤。

## Acceptance criteria

- [ ] 任意 view 触发 `did-fail-load` → 写入一条 error 级日志，含 URL、errorCode、errorDescription——白屏时能从日志区分"加载失败"而非"渲染崩溃"。
- [ ] 任意 view 触发 `render-process-gone` → 写入一条 error 级日志，含 reason、exitCode——能识别 GPU/OOM 类崩溃，并与现有 `disableGpu` 设置关联。
- [ ] 日志条目带 source / view 上下文，多条 view 的记录可区分。
- [ ] view 销毁后再 emit 这些事件不抛异常，且监听已解绑（`webContents.off` 被调用）——守住销毁安全路径。
- [ ] electron mock 升级后测试可 emit webContents 事件；现有依赖该 mock 的单元测试无回归。
- [ ] `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` 全绿。

## Blocked by

None - can start immediately

## Comments

### 2026-06-17 — 实现完成（TDD：RED → GREEN → REFACTOR）

改动文件：
- `src/main/viewManager/managedView.ts` — 新增 `logger`，在 `setupWebContentsListeners` 订阅 `did-fail-load` / `render-process-gone`，error 级别记录 viewId / url / validatedURL / errorCode / errorDescription / reason / exitCode；随 `webContentsSubscriptions` 在 `destroy()` 解绑。
- `src/__tests__/infrastructure/mocks/electron.ts` — `mockWebContents` 升级为可捕获 `.on` 并暴露 `emit`（handlers Map），让 webContents 事件可在单元测试驱动。
- `src/__tests__/main/managedViewLogging.test.ts` — 新增 4 用例（did-fail-load 日志、render-process-gone 日志、did-finish-load 不记 error、销毁后不泄漏/不抛）。

过程备注：mock 升级后暴露一个既有隔离缺口——`mockWebContents` 是跨测试共享单例，其 handlers Map 是 `vi.clearAllMocks` 不重置的自定义状态，handler 会跨测试累积泄漏。本测试 `beforeEach` 用 `removeAllListeners()` 清理。若后续多文件复用 webContents 事件，可考虑把 webContents mock 改为每实例化一份（更忠实于真实 Electron），当前为本片最小修复。

验证：`pnpm run typecheck` ✓ / `pnpm run lint` ✓（0 errors；2 个 warning 为既有，非本次）/ `pnpm run test` ✓ 17 files / 156 tests。本片仅主进程改动、无跨进程/打包变更，按 AGENTS 验证要求无需 E2E/build。
