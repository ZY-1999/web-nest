# Spec 01: 服务型 Web App 数据模型与 IPC 契约扩展

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: None — can start immediately

## Goal
为服务型 web app 建立数据契约：在持久化模型上新增可选 `service` 字段（`{command, shell}`），扩展 createWebApp/updateWebApp 的 service 入参语义与返回值透传，并保证旧配置零迁移——为所有下游 spec（进程管理、就绪流程、UI）提供共享的契约形状。

## Acceptance criteria
- [x] 持久化往返：带 `service` 的 app 经 save → load 后字段无损（command/shell 原样）— 证明 service 字段正确进出存储
- [x] 向后兼容：旧配置（无 `service` 字段）load 后 `service === undefined`（普通型），零迁移 — 证明 AC7 在持久化层成立
- [x] shell 空值兜底：存储里 `service.shell` 为空字符串，读取时兜底视为 `'auto'`，且不污染存储文件（写回仍是空字符串）— 证明 D2 默认 auto 语义
- [x] service 三态入参语义：`createWebApp(url, {command,shell})` 设值；`updateWebApp(id, {service: null})` 清除（返回 service=undefined）；`updateWebApp(id, {})`（service undefined）不动现有 service — 证明普通型↔服务型互转的契约基础（US2）
- [x] 透传：`listWebApps` 与单个 app 的 `WebAppState` 返回值携带 `service`（服务型带对象 / 普通型 undefined）— 证明 renderer 列表区分与编辑回填的数据来源
- [x] 校验拒绝（持久化层独立保护）：`service` 存在但 `command` 为空 → 拒绝；`service` 存在但 `url` 为空 → 拒绝（两条独立断言，不依赖表单层）— 证明校验不只在 UI 挡

## Scope
- **In**: PersistedApp 模型 + appConfigService load/save；WebAppMainApi 的 createWebApp/updateWebApp 签名 + 实现；WebAppState 透传 service；service 校验。
- **Out**: 真正 spawn/kill 进程（Spec 03/04）；URL 重试（Spec 04）；任何 renderer UI（Spec 06/07）；shell 探测实现（Spec 02）；E2E（Spec 08）。本 spec 的 service 只落盘不执行。

## Context
- 领域词汇：service / command / shell / 普通型 vs 服务型 web app（CONTEXT.md）；service 存在即服务型，隐式区分，无 type 字段（ADR-0005 + PRD）。
- 现状契约：PersistedApp 当前 4 字段（无 service）；WebAppMainApi 的 createWebApp(url) / updateWebApp(id, {title?,url?})；WebAppState 当前 5 字段。见 codemap Capability「Web 应用管理」「持久化」。
- mock 约定：appConfigService 是内部依赖（非 IPC service），直接单测，沿用现有 appConfig 测试范式。
- ADR-0005：command 明文存储/显示，不加密、不遮蔽。

## Design

**Interface delta**（编码决策的 type shape）：
- `AppServiceConfig`（新增 shared 类型，main + renderer 共享）：`{ command: string; shell: string }`
- `PersistedApp` 加 `service?: AppServiceConfig`
- `WebAppMainApi.createWebApp(url: string, service?: AppServiceConfig | null)` —— `service` 传对象=设/改、`null`=清除、`undefined`/缺省=不动（仅 url 普通型创建）
- `WebAppMainApi.updateWebApp(id, data: { title?; url?; service?: AppServiceConfig | null })`
- `WebAppState` 加 `service?: AppServiceConfig`

**Internal architecture**：
- service 三态语义在 webAppService.createWebApp/updateWebApp 编排层处理（设值 / 清除 / 不动），落盘经 `persist()` 合并时带上 service。
- shell 空值兜底：在组装 `WebAppState`（renderer 消费侧）时，`service.shell` 为空字符串 → 兜底 `'auto'`；存储层（apps.config）保持原值不污染。
- service 校验：service 存在 → command 非空 **且** url 非空，在 createWebApp/updateWebApp 入口校验，违反抛 `i18nService.t('errors.*')`（沿用现有错误模式）。

## Rework on failure

失败隔离在数据契约层；redo this spec only。
