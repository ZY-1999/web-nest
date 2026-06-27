# ADR-0004: 进程清理 = 窗口 closed kill + before-quit 兜底，强杀进程树

Date: 2026-06-27
Status: Accepted

## Context
服务型 web app 的 command spawn 的后台服务进程（常 fork 子进程，如 `npm start` → node → 真正服务）需在 app 关闭时清理。需决定 kill 时机、kill 方式、崩溃孤儿处理——这是最容易出 bug 的地方（孤儿进程、杀不干净、崩溃残留）。

## Decision
- **kill 时机**：每个 app 窗口 `nativeWindow.on('closed')` 事件 kill 自己的服务（与现有销毁逻辑并列）；`app.on('before-quit')` 兜底扫杀所有残留服务进程（同步，不 await，quit 时机敏感），每个 kill 结果写日志。
- **kill 方式**：**强杀整个进程树**。Windows 经 execa 走 `taskkill /T /F`（或 execa 在 win32 的等价杀树行为，spec 阶段用 context7 核版本行为）；不给优雅关闭期（Windows 无真正 SIGTERM，控制台服务不响应 WM_CLOSE）。
- **崩溃孤儿**：第一版**不做看门狗**（子进程监测父 PID 自杀），接受 web-nest 自身崩溃导致的服务孤儿为已知限制。正常退出由 `before-quit` 覆盖。

## Consequences
- 正常关窗 / 正常退出 web-nest 都能清理服务（双保险）
- 强杀简单可靠，适合本地 dev / 后台服务场景
- 服务进程没机会 graceful shutdown（可能留临时文件 / 未关连接）——可接受
- web-nest 崩溃时服务孤儿残留（已知限制，文档记录）
- execa 在 win32 的具体 kill 行为需在 spec 阶段确认（是否默认杀树）

## Alternatives considered
- **温和 → 超时强杀**（先 SIGTERM 给 2s，超时 SIGKILL）：服务能 graceful shutdown。否决——Windows 无 SIGTERM 语义，对控制台服务意义不大，徒增复杂度。
- **看门狗**（子进程监测父 PID）：防崩溃孤儿。否决——复杂度高，崩溃是罕见边缘，YAGNI。
- **仅绑窗口 closed / 仅绑 app quit**：前者漏 quit 时扫杀，后者违背"应用关闭后服务关闭"。否决，采用双绑。
