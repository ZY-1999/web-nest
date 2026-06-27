# Spec 07: 服务型 Web App 表单 UI（AddDialog/EditDialog 服务开关 + 卡片角标）

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: #01

## Goal
在 AddDialog/EditDialog 加「启动本地服务（高级）」开关 + command 文本框 + shell 下拉，AppCard 加 Terminal 角标，支持普通型↔服务型互转——让用户能配置服务型 app（command 仅落盘，真正执行在 Spec 04）。

## Acceptance criteria
- [x] 开关展开：勾选「启动本地服务」→ command 输入框 + shell 下拉显示；取消勾选 → 隐藏且保存时传 service:null（普通型）— 证明 UI 决策
- [x] 校验拒绝：勾选服务后 command 空 → 提交禁用/拒绝；service 存在但 url 空 → 拒绝（两条独立） — 证明校验在表单层也挡（与 Spec 01 持久化层双保护）
- [x] 互转：普通型 app 编辑时勾选服务 + 填 command 保存 → 变服务型；服务型清空 command 保存 → 变普通型 — 证明 US2
- [x] shell 下拉 + 回填：选项 auto/bash/cmd/powershell/自定义（选自定义弹路径输入）；EditDialog 打开时回填现有 service.command/shell — 证明 D2 per-app shell + 编辑体验
- [x] AppCard 角标：service 存在的 app favicon 角渲染 Terminal 角标；普通型不渲染 — 证明列表区分
- [x] i18n 双语：表单标签、shell 选项、错误提示 zh-CN + en 齐全 — 证明 i18n 覆盖
- [x] fill→click flaky 缓解：提交点击前加 `toBeEnabled()` 断言（项目 mock 约定）— 证明 E2E 稳定性

## Scope
- **In**: AddDialog/EditDialog service 配置区；调用 Spec 01 扩展的 create/update 传 service；AppCard Terminal 角标；i18n 文案。
- **Out**: service 真正执行（Spec 04）；标题栏状态指示（Spec 06）；持久化契约本身（Spec 01）；E2E（Spec 08）。

## Context
- 领域词汇：command / shell / 普通型 vs 服务型 web app（CONTEXT.md）。
- 现状接线：WebCatalog/index.tsx 的 AddDialog/EditDialog/AppCard（codemap Capability「Web App 标题栏」管理窗部分）；renderer webAppStore（Zustand）。
- ADR-0005：command 明文输入，不遮蔽、不加密、无首次确认。
- 组件库：Radix UI + tailwind v4 + shadcn；i18n 约定同 Spec 06。

## Design

**Interface delta**：
- AddDialog/EditDialog 加 service 配置区：Toggle「启动本地服务（高级）」+ command Input + shell Select（auto/bash/cmd/powershell/自定义）+ 自定义路径 Input（选「自定义」时显示）。
- AppCard favicon 角加 Terminal 角标（条件渲染：`app.service` 存在）。
- 调用 Spec 01 扩展的 `createWebApp(url, service)` / `updateWebApp(id, {service})`。
- i18n key：`catalog.serviceToggle` / `catalog.serviceCommand` / `catalog.serviceShell.{auto,bash,cmd,powershell,custom}` / `catalog.serviceShellCustomPath` / `catalog.errors.{serviceCommandRequired,serviceUrlRequired}`（zh-CN + en）。

**Internal architecture**：
- 表单状态（本地 React state）：serviceEnabled 开关 + command + shellSelect + customPath。开关 off → 保存传 `service:null`；开关 on → 传 `{command, shell: customPath || shellSelect}`。
- 校验（表单层，与 Spec 01 持久化层双保护）：开关 on + command 空 → 禁用提交 + 提示；service 存在 + url 空 → 禁用。
- EditDialog 回填：打开时从 `app.service` 初始化（无 service → 开关 off；有 → 开关 on + command/shell 回填）。
- AppCard 角标：favicon 容器 relative 定位 + 角标 absolute，条件渲染 Terminal 图标。
- 不涉及 service 执行（Spec 04）。

## Rework on failure

UI 层；redo this spec only。
