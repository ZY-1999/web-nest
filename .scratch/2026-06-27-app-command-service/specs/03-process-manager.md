# Spec 03: 后台服务进程管理器（ProcessManager）

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: None — shell 由调用方（Spec 04）解析后传入，本模块不依赖 shellDetector

## Goal
实现封装 execa spawn + 进程树 kill 的进程管理模块，作为 webAppService 的内部依赖——spawn command（经指定 shell）、强杀进程树（win32 taskkill /T /F 语义）、上报 exit/error 事件、stderr 尾部入日志。

## Acceptance criteria
- [x] spawn 传参：processManager.spawn 收到 command + **已解析的 shell**（由 Spec 04 调用 shellDetector.resolveShell 后传入），正确转给 execa；本模块**不内部解析 'auto'** — 证明 D1（execa 执行）+ 职责单一
- [x] spawn 失败隔离：spawn 失败（ENOENT/EACCES）经 onError 回调上报，不抛到调用层 — 证明失败面隔离
- [x] kill 走进程树：mock execa 子进程，win32 断言调用 `taskkill /T /F`（或 execa 等价杀树行为）— 证明 D4 强杀进程树
- [x] exit/error 回调：子进程 exit 事件附 exit code 触发 onExit；error 事件触发 onError 附错误简述 — 证明失败矩阵的事件来源
- [x] stderr 尾部入日志 + 截断：超出阈值（**尾部 20 行或 1KB 取先到者**）截断后写入，不爆日志 — 证明可观测且不爆
- [x] kill 幂等：同一 child 不重复 kill，kill 后再 kill 安全无副作用 — 证明清理安全
- [x] mock execa 可独立单测（不依赖真实子进程、不依赖 shellDetector）— 证明可独立验证

## Scope
- **In**: processManager 模块（spawn / killTree / 事件回调 / stderr 截断）；新增生产依赖 execa。
- **Out**: 何时 spawn/kill（Spec 04/05 的生命周期决策）；shell 探测实现（Spec 02，由 Spec 04 调用）；serviceState 状态机归属（Spec 04）；UI。

## Context
- 领域词汇：后台服务进程 / command / shell（CONTEXT.md）。
- ADR-0001：command 经 execa 执行；ADR-0004：强杀进程树（win32 taskkill /T /F 或 execa 等价）。
- Deepening Goal：execa win32 `kill` 是否默认杀进程树 —— Design 用 context7 核版本，必要时显式 taskkill。
- 销毁安全约定（AGENTS.md）：基础设施层 try-catch 保护原生访问，调用层不叠加 try-catch。
- 实现提醒：execa v9+ 是 pure ESM——/tdd 阶段核版本 + 主进程 esbuild 打包（vite.config.main.mts）external 处理（用 context7）。

## Design

**Interface delta**：
- 新模块 processManager（内部依赖，非 IPC service）。
- `spawn(command: string, shell: string, handlers: { onExit?(code, signal); onError?(err); onStderrTail?(text) }): { child; pid }` —— 接收**已解析的 shell**（不在内部解析 auto）。
- `killTree(child): void` —— 强杀进程树。

**Internal architecture**：
- 用 execa，`shell` 参数直传 execa 的 shell 选项。
- **killTree（钉死）**：win32 用 `taskkill /pid <pid> /T /F`（/T 杀树 /F 强制）；非 win32 用 `child.kill()`（默认信号杀进程组）。spec 阶段用 context7 核 execa 当前版本 `kill` 是否默认杀树——若已杀树则直接 `child.kill()`，否则显式 taskkill /T /F。不依赖调用方传平台。
- **stderr 尾部截断（钉死）**：滚动 buffer 累积 stderr，保留**最后 20 行或 1KB（取先到者）**，经 onStderrTail 回调出 + 入日志。
- spawn 失败（ENOENT/EACCES）try-catch 包 spawn 调用 → onError 上报，不抛调用层。
- 销毁安全：killTree try-catch 保护（对齐 AGENTS.md），kill 后标记，幂等；对已 exit 的 child 安全无副作用。
- 测试 mock execa 模块（vi.mock），不依赖真实子进程 / 不依赖 shellDetector。

## Rework on failure

模块独立；redo this spec only。
