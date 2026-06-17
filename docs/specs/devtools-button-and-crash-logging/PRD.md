# Spec: 标题栏 DevTools 按钮 + 加载/崩溃事件日志

Created: 2026-06-17
Status: ready-for-agent

## Problem Statement

作为 web-nest 的使用者/维护者，我偶尔会遇到窗口白屏，但当前应用对加载失败和渲染进程崩溃**完全没有可观测记录**——`ManagedView` 只监听了 `did-finish-load`，`did-fail-load` 与 `render-process-gone` 都没有处理。一旦白屏，我打开日志什么也看不到，无法判断是"外部 URL 加载失败"、"渲染进程崩溃"还是"GPU 问题"，只能凭猜。

同时，排查白屏时我需要观察出问题的那个 `WebContentsView`（尤其是 Web App 窗口加载外部 URL 的内容 view），但当前只有开发模式下主窗口会自动 `openDevTools`，**没有任何 UI 入口**能针对某个具体窗口/视图打开 DevTools，生产环境更是无从下手。

## Solution

两部分能力，主题是"提升可调试性 / 可观测性"：

1. **加载与崩溃事件仅记日志（不做恢复）**：在共享的 `ManagedView` 上集中监听 `did-fail-load` 和 `render-process-gone`，把关键诊断信息（URL、错误码、错误描述、崩溃原因、退出码）写入统一日志（`~/.web-nest/log/main.log`）。不弹占位、不重试、不显示 loading——纯粹为下次白屏留下定位证据。

2. **标题栏 DevTools 按钮**：在主窗口 TitleBar 和 Web App 标题栏第 1 行各增加一个图标按钮，点击切换该窗口**内容 view** 的 DevTools。dev 与生产环境均启用，生产也能就地排查白屏。

## User Stories

### 加载 / 崩溃事件日志

1. 作为维护者，我希望当任意 `WebContentsView` 加载失败时应用能在日志里记录一条 `did-fail-load` 信息，这样白屏后我能立刻知道是"加载失败"而非"渲染崩溃"。
2. 作为维护者，我希望日志里包含失败页面的 URL，这样我能定位是哪个 Web App / 哪次导航出了问题。
3. 作为维护者，我希望日志里包含 `errorCode` 和 `errorDescription`（例如 `ERR_CONNECTION_REFUSED`、`ERR_NAME_NOT_RESOLVED`），这样我能区分网络问题、DNS 问题还是证书问题。
4. 作为维护者，我希望当任意 view 的渲染进程意外退出时，日志里记录一条 `render-process-gone` 信息，这样我能识别 GPU 崩溃 / OOM 这类白屏诱因。
5. 作为维护者，我希望日志里包含崩溃 `reason`（如 `gpu-process-crashed`、`oom`）和 `exitCode`，这样我能判断是否与现有 `disableGpu` 设置相关。
6. 作为维护者，我希望日志条目带有来源上下文（source、view id），这样多条日志混在一起时我也能区分它们来自哪个 view。
7. 作为维护者，我希望加载失败 / 崩溃的日志使用 error 级别，这样它们在默认日志级别下也一定可见。
8. 作为使用者，我希望仅记录日志这一行为**不改变窗口的任何可见行为**——该白屏还是白屏，只是现在有了事后证据，不会出现意料外的弹窗或占位。
9. 作为维护者，我希望这套日志监听对主窗口 view、Web App 内容 view、Web App 标题栏 view **一视同仁**（因为它们都是 `ManagedView`），不需要为每种窗口单独接线。
10. 作为维护者，我希望 view 被销毁后这些监听不会泄漏或抛异常（遵循项目"销毁安全约定"）。

### 标题栏 DevTools 按钮

11. 作为维护者，我希望在主窗口标题栏看到一个 DevTools 图标按钮，点击就能打开主窗口内容 view 的 DevTools，这样排查主窗口白屏时不用记快捷键。
12. 作为维护者，我希望在 Web App 标题栏第 1 行也看到一个 DevTools 图标按钮，点击能打开**该 Web App 内容 view**（外部 URL）的 DevTools，这样排查 Web App 白屏时能直接看 Console / Network。
13. 作为维护者，我希望 DevTools 按钮是**切换式**的——再点一次关闭 DevTools，避免反复打开堆积窗口。
14. 作为维护者，我希望按钮带 tooltip/aria-label（如 "DevTools"），这样用途一目了然。
15. 作为维护者，我希望该按钮在**生产构建**中也可用，这样分发出去的版本也能就地排查白屏。
16. 作为维护者，我希望多个窗口的 DevTools 按钮**彼此独立**——每个窗口只控制自己的内容 view，互不影响。
17. 作为维护者，我希望 Web App 标题栏的 DevTools 按钮操作的是**内容 view 而非标题栏 view**（标题栏是本地 renderer，需要调试的是外部 URL）。
18. 作为使用者，我希望这个按钮在视觉上与现有标题栏图标按钮（设置、主题切换）风格一致，不破坏标题栏的整洁感。
19. 作为维护者，我希望按钮调用经过类型安全的 ServiceRegistry IPC，而不是裸 `ipcRenderer`（遵循项目禁止事项）。
20. 作为维护者，我希望按钮在 view 已销毁/正在关闭时点击不会抛异常（遵循销毁安全约定）。

## Implementation Decisions

### 加载 / 崩溃事件日志

- **接线位置（集中化）**：在 `ManagedView` 的 webContents 监听集合中新增 `did-fail-load` 与 `render-process-gone` 两个订阅，与现有 `did-finish-load` 同处维护。因主窗口 view、Web App 内容 view、标题栏 view 都是 `ManagedView`，一次接线覆盖所有窗口，无需在各 service 重复。
- **日志内容契约**：
  - `did-fail-load`：event、`errorCode`、`errorDescription`、`validatedURL`、当前 view 的 URL 与 view id。级别 `error`。
  - `render-process-gone`：event、`reason`、`exitCode`、view id。级别 `error`。
- **过滤**：不对 `errorCode` 做静默过滤（本轮只记日志，要保留全部证据）；若后续观察到页内导航产生的噪声 `ERR_ABORTED` 过多，再单独评估过滤，本期不做。
- **销毁安全**：监听器随现有 `webContentsSubscriptions` 一起在 `destroy()` 中解绑；handler 内访问 webContents 属性前复用现有 `isDestroyed()` 保护，遵循"基础设施层不抛异常、调用层不叠加 try-catch"约定。
- **无恢复逻辑**：明确不引入错误占位、重试、reload、loading 占位、`createMainWindow` 的 loadURL 失败兜底 dialog、主窗口 show-after-ready 等——这些属于后续"白屏恢复"范畴，本期排除。

### 标题栏 DevTools 按钮

- **能力暴露（ServiceRegistry）**：
  - Web App 标题栏：扩展现有 per-view 的 `WebAppWindowApi`，新增 `toggleDevTools()` 方法；`WebAppWindowService` 已持有 content view 引用，实现里调用该 view 的 `toggleDevTools()`。
  - 主窗口标题栏：在主 `channel` 上暴露一个 `toggleDevTools()` 能力，后端取主窗口内容 view 调用其 `toggleDevTools()`。复用现有 `ManagedView.toggleDevTools()`（已实现 open/close 切换）。
  - API 契约统一为 `toggleDevTools(): Promise<void>`，遵循项目"abstract class + `static apiName` + `defineApi`"模式。
- **UI**：
  - 主窗口 `TitleBar` 右侧操作区（设置、ThemeToggle 旁）与 Web App `TitleRow` 第 1 行右侧（ThemeToggle 旁）各加一个图标按钮，使用与现有按钮一致的 ghost/icon 样式（`Button variant="ghost" size="icon"` 等）。
  - 图标取自项目已用的 `lucide-react`（如 `Terminal` / `Code`），含 `aria-label`/`tooltip`（"DevTools"）与 `data-testid`（便于 E2E 定位，如 `titlebar-devtools`）。
- **环境**：dev 与生产均渲染按钮、均生效（与"生产也能排查白屏"目标一致），不做环境门控。
- **安全/销毁**：`toggleDevTools()` 实现内部对 view/webContents 做 `isDestroyed()` 检查；标题栏点击触发 IPC 调用走 ServiceRegistry 类型安全通道，不使用裸 IPC。
- **国际化**：按钮 label 走 i18n（新增 `titlebar.devtools` 之类 key，`zh-CN`/`en` 两份 locale 各补一条），与现有标题栏文案管理方式一致。

## Testing Decisions

- **好测试的标准**：只验证外部可观察行为（日志被以预期内容写入、按钮点击后 DevTools 确实打开/关闭），不断言私有方法调用顺序或内部数据结构。遵循项目既有测试风格（行为即规格）。
- **优先复用既有接缝**，仅在必要处新增一个 mock 能力。

### 主接缝：Unit（main，node 环境）— 需小幅升级 electron mock

- **mock 升级**：当前 `mocks/electron.ts` 里 `mockWebContents.on` 仅为 `vi.fn()`，不捕获 handler、无法驱动事件。将其升级为可捕获 `.on(event, handler)` 注册并暴露测试用 `emit(event, …args)` 的轻量 EventEmitter（与现有 `MessageChannelMain` mock 的"记录 handler 并可触发"思路同构）。这是为日志接线引入的唯一新接缝，处于最高可行点（基础设施层 mock）。
- **断言**：
  - 通过 `emit('did-fail-load', event, errorCode, errorDescription, validatedURL)` 触发 → 断言 logger 以 `error` 级别记录，内容含 URL / errorCode / errorDescription。
  - 通过 `emit('render-process-gone', event, { reason, exitCode })` 触发 → 断言 logger 以 `error` 级别记录，内容含 reason / exitCode。
  - 销毁后 emit 不抛、监听已解绑（断言 `webContents.off` 被调用）。

### 辅助接缝 1：Unit（main）— DevTools toggle 服务行为

- 断言 Web App 的 window service `toggleDevTools()` 调用其持有的 content view 的 `toggleDevTools()`；断言主窗口 `toggleDevTools()` 能力调用主内容 view 的 `toggleDevTools()`。
- 断言 view 已销毁时调用不抛异常。可在现有 mock（`openDevTools`/`closeDevTools`/`isDevToolsOpened` 已存在）上完成，无需额外基础设施。

### 辅助接缝 2：E2E（Playwright）

- 沿用 `tests/e2e/` 既有模式与本地 fixture 页面：
  - Web App：创建 Web App → 在标题栏定位 `[data-testid="titlebar-devtools"]` 按钮可见 → 点击 → 断言内容 view 的 DevTools 打开（`webContents.isDevToolsOpened()` 返回 true，或出现 detached devtools 窗口）；再点一次 → 关闭。
  - 主窗口：定位主标题栏 DevTools 按钮 → 点击 → 断言主内容 view DevTools 打开。
- 注：DevTools 断言在 Playwright 中偶有 flaky（detached 窗口时机），标为 best-effort；日志接线的确定性证据以主接缝（unit）为准。

### Prior art（先例）

- 单元层：`src/__tests__/main/viewManagerChannel.test.ts`（viewManager + channel mock 行为测试）、`mocks/electron.ts`（mock 基础设施）、`infrastructure/helpers/channelHelpers.ts`（连接的 mock port 对）。
- 集成层：`src/__tests__/integration/webAppService.integration.test.ts`（webAppService 端到端、electron 被 mock）。
- E2E 层：`tests/e2e/webAppTitlebar.spec.ts`（标题栏 `data-testid` 定位 + Playwright 枚举 BaseWindow 下多 WebContentsView）。

## Out of Scope

- **白屏恢复**的任何形式：错误占位页、重试按钮、reload 策略、加载期 loading 占位、消除 Web App 内容区加载白闪。
- **主窗口加载失败兜底**：`createMainWindow` 中 loadURL reject 时的 `dialog.showErrorBox` / 重试 / 退出 / show-after-ready（`waitForLoad` + `ready-to-show` 替换 50ms `setTimeout`）——均属后续"白屏恢复"范畴。
- **DevTools 快捷键**（`before-input-event` 拦截 F12 / Ctrl+Shift+I）：本轮明确仅做标题栏按钮，不做键盘快捷键。
- GPU 黑名单的进一步处理（现有 `disableGpu` 设置已覆盖，不扩展）。
- CSP 策略调整。
- 与加载失败/DevTools 无关的窗口定位、时序改动。
- 标题栏 DevTools 按钮的环境门控（不做"仅 dev 显示"开关）。

## Further Notes

- 本 spec 是"白屏可观测性"的第一步：先留下日志证据 + 提供 DevTools 入口，便于现场定位；真正的"恢复"留待后续 spec（届时日志已能区分失败类型，可针对性设计恢复策略）。
- 日志监听集中在 `ManagedView` 是关键设计：未来若要为不同 view 类型（embedded/offscreen、主/Web App）差异化处理，可基于 `this.type` 或 view id 分流，无需改动接线位置。
- `errorCode`/`reason` 的取值参考 Electron `did-fail-load` 与 `render-process-gone` 官方文档；`reason` 出现 `gpu-process-crashed` / `crashed` 时，可提示用户尝试现有 `disableGpu` 设置（仅作日志内的关联提示，不在本期实现 UI）。
- mock 升级（`mockWebContents` 可 emit）是基础设施增强，后续任何依赖 webContents 事件接线的特性（如未来白屏恢复、下载管理、权限请求）都会受益。
