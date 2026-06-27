# Spec 04: 服务型 Web App 就绪流程与失败矩阵

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: #01, #02, #03

## Goal
把数据契约（Spec 01）与进程管理（Spec 03）接入 openWebApp/createWebApp：服务型 app 打开时 spawn command → 并行开窗 + URL 自适应重试（500ms→2s，30s 超时）→ 失败矩阵四场景的 serviceState 迁移；进程对象挂 WebAppEntry 供清理（Spec 05）消费。

## Acceptance criteria
- [x] 成功路径：spawn → 立即开窗 loadURL → starting → 加载成功 → running（窗口秒开）— 证明 AC1 主路径
- [x] URL 重试退避：mock did-fail-load，断言重试间隔 500ms→2s、总超时 30s，超时后仍 loadURL 一次并转 failed（「服务可能未就绪」）— 证明 D3
- [x] 失败矩阵·spawn 失败（ENOENT/EACCES）：停止重试，窗口保留，state=failed（附 execa 错误简述）— 证明矩阵第 1 行
- [x] 失败矩阵·加载成功前进程 exit：提前结束重试（不等 30s），state=failed（附 exit code）— 证明矩阵第 2 行
- [x] 失败矩阵·运行中崩溃（已 running 后 exit）：state=stopped（附 exit code），窗口保留最后页面，不重启 — 证明矩阵第 3 行 + AC5
- [x] 失败矩阵·重试超时：state=failed「服务可能未就绪」（见重试退避条）— 证明矩阵第 4 行
- [x] exit 边界判定：**以 `did-finish-load` 成功为界**，此前 exit=failed、此后 exit=stopped（Design 钉死边界事件）— 证明四态判定不歧义
- [x] 普通型回归：无 service 的 app 走原有 loadURL 路径，无 spawn/无重试/无状态推送 — 证明向后兼容
- [x] `--open-app=<服务型 appId>` 快捷方式直达：不经管理窗也能正确 spawn + 加载 + 进入状态机 — 证明快捷方式路径不漏（codemap Entry Index）

## Scope
- **In**: openWebApp/createWebApp 服务型分支；spawn 时机；loadURL 并行 + did-fail-load 重试订阅；serviceState 状态机（main 侧）；进程对象挂 WebAppEntry；exit 边界判定。
- **Out**: closed kill / before-quit 扫杀（Spec 05）；serviceState 推送到标题栏（Spec 06）；UI（Spec 07）；E2E（Spec 08）。

## Context
- 领域词汇：URL 自适应重试 / serviceState（idle/starting/running/failed/stopped）/ 后台服务进程（CONTEXT.md）。
- ADR-0003：并行开窗 + URL 自适应重试，did-fail-load 触发 500ms→2s 退避，30s 超时仍加载一次。
- 现状接线：webAppService.openWebApp / createWindowForApp；managedView 已订阅 did-fail-load（仅记日志），重试需新增 service-specific 订阅或抽 helper（见 codemap Risk Areas）；`--open-app` 经 parseOpenAppArg 直开。
- mock 约定（项目 memory）：webContents 是模块级共享单例，beforeEach 须 `webContents.removeAllListeners()`。
- **Design 须钉死**：exit 边界事件（did-finish-load 为界）；进程对象在 WebAppEntry 的存放；serviceState 状态机归属（webAppService 持有 vs 独立）。

## Design

**Interface delta**：
- `WebAppEntry`（webAppService 内部）加 `serviceProcess?: { child; pid }` 与 `serviceState?: ServiceState` 与 `serviceLoaded?: boolean`（进程对象 + 状态机 + 加载界标志存放）。
- `ServiceState = 'idle' | 'starting' | 'running' | 'failed' | 'stopped'`（shared 类型）。
- `_doOpenWebApp` / `createWindowForApp` 增服务型分支：`appData.service` 存在时走 spawn + 重试 + 状态机。
- `WebAppWindowService.updateServiceState(state, error)` setter（预埋存储，本 spec 不改 buildNavState——Spec 06 接通）。

**Internal architecture**：
- 服务型打开编排（appData.service 存在）：
  1. `shellDetector.resolveShell(service.shell)` 得真实 shell（消费 Spec 02）
  2. `processManager.spawn(service.command, shell, handlers)`（消费 Spec 03）—— handlers.onExit/onError 驱动状态机
  3. 并行调 createWindowForApp（已有 loadURL `waitForLoad:false`）；`serviceState='starting'`
  4. 订阅 content view webContents：`did-fail-load`（重试）+ `did-finish-load`（加载成功界）
- **URL 自适应重试**：did-fail-load 触发重试 loadURL，退避 500ms→2s（首次 500ms，指数到 2s 封顶）；累计 30s 超时 → 停止重试 + 仍 loadURL 一次 + `serviceState='failed'`（"服务可能未就绪"）。
- **exit 边界（钉死）**：以 content view 的 `did-finish-load` 成功事件为界——`serviceLoaded=false` 时进程 exit → `'failed'`（附 exit code）；`serviceLoaded=true` 时进程 exit → `'stopped'`（附 exit code，窗口保留最后页面，不重启）。did-finish-load 置 `serviceLoaded=true` + `serviceState='running'`。
- **spawn 失败**（onError ENOENT/EACCES）→ 停止重试 + `serviceState='failed'`（附 execa 错误简述），窗口保留。
- did-fail-load 订阅：webAppService 额外订阅（managedView 已订阅仅记日志，多订阅互不干扰），不抽 helper 到 managedView（保持其通用性）。
- 状态推送预埋：serviceState 变化点调现有 pushNavState 模式；经 `windowService.updateServiceState` 存状态（Spec 06 让 buildNavState 带上）。
- 普通型（无 service）：走原 createWindowForApp，无 spawn/无重试订阅/无 serviceState。
- `--open-app` / second-instance 路径：openWebApp/_doOpenWebApp 是统一入口，服务型分支自动覆盖。

## Rework on failure

失败隔离在就绪流程；redo this spec only（进程管理/数据契约不受影响）。
