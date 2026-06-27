# Spec 05: 进程清理双保险（closed kill + before-quit 扫杀）

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: #03, #04

## Goal
实现 ADR-0004 的双 kill 兜底：服务型 app 窗口 `closed` 时 kill 对应后台服务进程；`app.before-quit` 时同步扫杀所有仍在运行的服务进程——独立的清理触发链路，不退化成 Spec 04 的尾巴。

## Acceptance criteria
- [x] 关窗 kill：mock 单服务型 app 关窗 → closed handler 触发 processManager.killTree（Spec 03），进程对象从 entry 移除，无残留 — 证明 AC2 单窗口清理
- [x] before-quit 扫杀（独立验证）：mock 多个服务型 app 运行中 → before-quit 同步遍历全部 entry 调 kill，每个 kill 结果入日志 — 证明 AC3 退出扫杀，且独立于关窗路径
- [x] 销毁顺序安全：kill 与 view destroy 的相对顺序明确（对齐 AGENTS.md「content view 先销毁、titlebar 后销毁」+ 销毁安全约定），不抛异常 — 证明不踩销毁坑
- [x] 幂等：已 kill 的进程在 before-quit 时安全跳过 — 证明不重复 kill
- [x] 普通型回归：普通型 app 关窗/退出路径不变（无 process 对象时跳过 kill）— 证明向后兼容
- [x] before-quit handler 挂载点独立可验：main/index.ts 的 before-quit 注册被测试直接覆盖（非仅靠 Spec 04 间接覆盖）— 证明此 spec 独立价值

## Scope
- **In**: WebAppEntry 持有 process 引用的清理消费；nativeWindow.on('closed') 追加 kill；main/index.ts before-quit handler 扫杀全部；销毁顺序对齐。
- **Out**: killTree 实现本身（Spec 03）；何时 spawn（Spec 04）；状态机；UI。

## Context
- 领域词汇：后台服务进程（CONTEXT.md）。
- ADR-0004：窗口 closed kill + before-quit 兜底扫杀，强杀进程树，不做看门狗。
- 现状接线：webAppService 的 nativeWindow.on('closed') / destroyEntry；main/index.ts Phase 5（window-all-closed），before-quit 当前无 handler（codemap Entry Index）。
- AGENTS.md 销毁安全约定：Map 先 delete 再 destroy；基础设施层 try-catch；调用层不叠加；isClosing 标志。
- **Design 须钉死**：kill 在 closed handler 中的相对顺序（content view 销毁前/后）；进程注册表（所有 entry 的进程对象）的归属。

## Design

**Interface delta**：
- webAppService 暴露 `killAllServiceProcesses(): void` —— 遍历 `this.apps` 的 `entry.serviceProcess` 调 `processManager.killTree`，供 before-quit 调用。
- `nativeWindow.on('closed')` 现有 handler 追加 service 进程 kill。
- main/index.ts Phase 5 加 `app.on('before-quit', () => webAppService.killAllServiceProcesses())`（与 window-all-closed 并列）。

**Internal architecture**：
- **closed kill 顺序（钉死）**：在现有 closed handler（destroyView content → destroyView titlebar → apps.delete → destroyWindow）中，**在 destroyView content 之前** kill service process——进程清理属于 content 相关清理，先于 content view 销毁完成。killTree 由 processManager try-catch 保护，webAppService 不叠加 try-catch。
- **进程注册表归属（钉死）**：复用 `webAppService.apps` map（entry.serviceProcess），不另建注册表。
- **before-quit 扫杀**：同步遍历（不 await），每个 killTree 结果入日志；幂等——kill 后 entry.serviceProcess 置空，killAllServiceProcesses 跳过无 process 的 entry。
- 普通型 app：entry.serviceProcess 为空，closed/before-quit 跳过 kill。
- 销毁安全对齐 AGENTS.md：基础设施层（processManager）try-catch，调用层直接调。

## Rework on failure

清理逻辑独立；redo this spec only（不影响就绪流程本身）。
