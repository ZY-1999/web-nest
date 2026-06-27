# Spec 08: 服务型 Web App 端到端 E2E（Playwright）

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: #04, #05, #06, #07

## Goal
用 Playwright 验证服务型 app 完整生命周期（添加 → 打开 → starting→running → 关窗 kill 服务 → quit 扫杀 → 运行中崩溃 stopped），并覆盖旧配置兼容回归——端到端验收 PRD AC1/AC2/AC3/AC4/AC5/AC7。

## Acceptance criteria
- [x] 全链路成功：添加服务型 app（url=测试 server、command=启动测试 server 脚本）→ 打开 → 标题栏 starting → server 起来后 running（内容加载成功）— 证明 AC1 E2E
- [x] 关窗 kill 断言：关窗 → 断言服务进程被 kill（poll 进程列表或测试用 pid 文件消失）— 证明 AC2 E2E
- [x] command 拼错 failed：command 故意拼错 → 标题栏 failed（红字简述），不无限重试（不卡 starting）— 证明 AC4 E2E
- [x] quit 扫杀（AC3）：开多个服务型 app 运行中 → 触发 app quit（退出 main 进程）→ poll 所有 pid 文件消失 / 进程探活均 ESRCH — 证明 AC3 E2E（兜底安全语义）
- [x] 运行中 stopped（AC5）：服务型 app 打开至 running → 外部 `process.kill(pid)` → 断言标题栏 stopped（灰点）+ 窗口仍可操作（保留最后页面） — 证明 AC5 E2E
- [x] 旧配置兼容 smoke：用 apps.config fixture（无 service 字段）启动，断言全部按普通型正常打开 — 证明 AC7 E2E 回归
- [x] 普通型回归：普通型 app（无 service）E2E 行为不受影响（沿用现有 app.spec.ts）— 证明不破坏现有
- [x] fill→click flaky 缓解：提交前加 `toBeEnabled()` 断言 — 证明 E2E 稳定

## Scope
- **In**: tests/e2e/serviceWebApp.spec.ts；测试用本地 server 脚本 fixture；pid 文件或进程列表断言手段。
- **Out**: 单元测试（各 spec 自带）；功能实现本身。

## Context
- 领域词汇：服务型 web app / serviceState（CONTEXT.md）。
- 现状接线：tests/e2e/（webCatalog / webAppTitlebar / theme / settings / app.spec.ts，codemap Validation）；Playwright 可枚举同一 BaseWindow 下多 WebContentsView（标题栏 view 用 data-testid 定位，项目 memory）。
- E2E 约定（项目 memory）：fill→click 时序 flaky，submit 前 `toBeEnabled()`；`w.close()` 只关 view 不一定关 BaseWindow。
- **Design 须钉死**：测试 server 脚本形态（node http / python）；kill 断言手段（pid 文件 vs 进程列表 poll）；触发 app quit 的手段（Playwright 关闭 electron 实例）。

## Design

**Interface delta**：
- 新文件 `tests/e2e/serviceWebApp.spec.ts`。
- 测试 fixture：测试用本地 server 脚本 + fixture apps.config（无 service）。

**Internal architecture**：
- **测试 server 脚本（钉死）**：node 脚本，`http.createServer` 监听动态端口响应 200，启动时把 `process.pid` 写入约定 pid 文件路径；command 配为 `node <fixture>`。
- **kill 断言（钉死）**：关窗后读 pid 文件，用 `process.kill(pid, 0)` 探活（try-catch ESRCH=已死），poll 至进程消失或超时。
- **quit 扫杀（AC3）**：开多个服务型 app → Playwright 关闭 electron app 实例触发 quit → poll 全部 pid 文件消失 / 进程探活均 ESRCH。
- **运行中 stopped（AC5）**：running 后测试侧 `process.kill(pid)` → 断言标题栏 stopped + 窗口保留最后页面。
- 全链路用例：AddDialog 填 url(localhost:动态端口) + command → 打开 → 断言标题栏 starting→running（data-testid 定位 ServiceStateIndicator）→ 关窗 → pid 探活断言已死。
- command 拼错用例：command='nonexistent-cmd-xyz' → 断言 failed（红字）。
- 旧配置兼容 smoke：fixture apps.config（无 service）放入 `WEB_NEST_HOME` → 启动 → 断言 app 卡片正常 + 打开正常。
- 沿用现有 E2E 范式（tests/e2e/webCatalog.spec.ts）+ 提交前 `toBeEnabled()` flaky 缓解。

## Rework on failure

E2E 独立；redo this spec only。
