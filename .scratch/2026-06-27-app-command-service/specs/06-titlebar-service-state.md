# Spec 06: 标题栏 serviceState 指示与 IPC 下发

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: #01, #04

## Goal
把 serviceState/serviceError 经标题栏推送通道下发，并在 web app 标题栏第二行渲染 starting/running/failed/stopped 指示——用户在标题栏即可看到服务状态（含失败原因），不弹 dialog/toast。

## Acceptance criteria
- [x] 状态实时推送：openWebApp 期间 serviceState 从 starting → running/failed/stopped 经 IPC 实时推送到标题栏（mock 推送断言调用次数与 payload）— 证明 US3 反馈实时性
- [x] 四态渲染：starting=spinner、running=绿点、failed=红字简述、stopped=灰点 — 证明 PRD UI 决策
- [x] serviceError 截断：长错误简述截断（Design 钉死阈值），不顶爆标题栏 — 证明 UI 健壮
- [x] 普通型不渲染：普通型 app 标题栏不显示 serviceState 区域 — 证明向后兼容
- [x] i18n 双语：starting/running/failed/stopped 各态文案 + 错误前缀，zh-CN + en 齐全 — 证明 i18n 覆盖

## Scope
- **In**: NavigationState 扩展 serviceState/serviceError（或独立 channel——Design 钉死）；WebAppWindowService 推送；标题栏 ServiceStateIndicator 组件；i18n 文案。
- **Out**: serviceState 产生逻辑（Spec 04）；表单 UI（Spec 07）；E2E（Spec 08）。

## Context
- 领域词汇：serviceState（CONTEXT.md）。
- 现状接线：webAppWindowApi.NavigationState（appId/url/title/faviconDataUrl/canGoBack/canGoForward）；WebAppWindowService.buildNavState；viewManager.requestTo / broadcast 推送机制（codemap Capability「Web App 标题栏」）。
- i18n 约定（AGENTS.md）：src/shared/i18n/locales/{en,zh-CN}.json，按模块分组 key（`catalog.*` / `titlebar.*`）。
- **Design 须钉死**：IPC 时序——走合并 navState channel（NavigationState 加字段）还是独立 service-state channel（PRD Deepening Goal）。须给结论 + 理由，否则无法进 /tdd。

## Design

**Interface delta**：
- `NavigationState` 加 `serviceState?: ServiceState` + `serviceError?: string`。
- `WebAppWindowService.updateServiceState(state, error)` setter（Spec 04 已预埋存储，本 spec 接通 buildNavState）。
- `buildNavState()` 读取 serviceState/serviceError 加入返回。
- webapp-titlebar renderer 加 `ServiceStateIndicator` 组件（第二行 URL 区旁）。
- i18n key：`titlebar.serviceState.{starting,running,failed,stopped}` + `titlebar.serviceErrorPrefix`（zh-CN + en）。

**Internal architecture**：
- **IPC channel（钉死）：合并** —— 复用现有 `'url-changed'` 推送通道（viewManager.requestTo），NavigationState 加 serviceState/serviceError 字段。理由：标题栏已监听 'url-changed'，合并使 serviceState 与 navState 共用一 seam（design bar: fewest seams）；serviceState 独立变化时 webAppService 仍推 'url-changed'，payload 带完整 navState + serviceState。
- **serviceError 截断（钉死）**：renderer 侧截断到 60 字符（超出加省略号）；main 侧传完整简述。
- 渲染：starting=spinner、running=绿点、failed=红字（serviceError 截断文）、stopped=灰点；serviceState=undefined（普通型）不渲染该区域。
- 推送触发：webAppService 在 serviceState 变化点调 pushNavState，buildNavState 经 updateServiceState 存的状态带上新字段。

## Rework on failure

IPC + 渲染层；redo this spec only。
