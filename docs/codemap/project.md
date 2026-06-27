# web-nest CodeMap (project)

> 这是给 agent 的**代码地形路由索引**，不是给人看的 Wiki。它指向"去哪看、为什么"，不替代源码/测试/Spec。与源码冲突时以源码为准并回写本图。
> 长期规则与架构叙述见 [AGENTS.md](../../AGENTS.md)；本图只做快速路由 + 钻取指针。

## 1. Orientation

- Last updated: `2026-06-19`
- Project: web-nest — 基于 Electron 的 Web 应用启动器（桌面产品）
- Role / responsibility: 管理 Web 应用卡片，快速打开独立窗口（带自定义标题栏），持久化配置/favicon/session，统一主题/i18n/日志
- Main languages / frameworks: TypeScript · React 18 + Zustand + Tailwind v4 + shadcn · Rust (@napi-rs native 模块，workspace 子包 `native`)
- Runtime / deployment shape: Electron 34 桌面应用，electron-builder 打包（Windows NSIS 为主）；三进程 main / preload / renderer
- Primary entry types: main 进程入口、两个 renderer 入口（管理窗 `index.html` + Web App 标题栏 `webapp-titlebar.html`）、preload 桥接、IPC ServiceRegistry 方法
- Confidence:
  - confirmed: 三进程架构、构建配置、ServiceRegistry/Channel 模式、启动 5-phase、5 个主 service 注册时序、preload 安全边界、view/window 管理双类、持久化路径、测试三层（源码 + AGENTS.md + 项目 memory 佐证）
  - inferred: `appConfigService`/`faviconService`/`shortcutService` 为内部依赖（非主 IPC service，被其他 service 直接 import）；native 模块接口边界
  - unknown: 性能基准、生产签名/公证/更新服务器实际配置

## 2. Context Tree

```text
Node: web-nest
  -> Node: Capability Index
  -> Node: Module Index
  -> Node: Entry Index
  -> Node: Domain And Data
  -> Node: External Dependencies
  -> Node: Cross-Module Flows
  -> Node: Validation
  -> Node: Risk Areas
  -> Node: Feature CodeMap Backlog
```

### Node: web-nest

- Type: `project`
- Status: `confirmed`
- Purpose: 给下一个 agent 的项目快速定位入口
- Read First:
  - [AGENTS.md](../../AGENTS.md): 架构/进程模型/销毁安全约定/禁止事项（活文档）
  - [src/main/index.ts](../../src/main/index.ts): main 进程启动 5-phase
  - [src/shared/serviceRegistry/index.ts](../../src/shared/serviceRegistry/index.ts): 通信核心抽象
- Edges / Children: 见下方各节点
- Evidence: package.json、main/index.ts、serviceRegistry/index.ts、文件树
- Next Drill-Down: 按 Capability Index 进入目标能力的入口文件

### Node: Capability Index

- Type: `capability` · Status: `confirmed`
- Purpose: 按"用户/系统能力"路由到主模块与入口
- Children:
  - **IPC 通信与 ServiceRegistry** — Main modules: [shared/serviceRegistry/](../../src/shared/serviceRegistry/), [shared/channel/](../../src/shared/channel/); Entry: `serviceRegistry.defineApi` / `implementService`; Status: confirmed; Feature CodeMap: pending（建议优先建）
  - **Web 应用管理（CRUD + 窗口/视图生命周期）** — Main: [main/services/webAppService.ts](../../src/main/services/webAppService.ts), [main/services/webAppWindowService.ts](../../src/main/services/webAppWindowService.ts); Entry: `webAppService.openWebApp`; Status: confirmed; Feature CodeMap: pending（建议优先建）
  - **窗口管理（BaseWindow）** — Main: [main/windowManager/](../../src/main/windowManager/); Entry: `windowManager.createWindow/getWindow/destroyWindow`; Status: confirmed
  - **视图管理（WebContentsView）** — Main: [main/viewManager/](../../src/main/viewManager/); Entry: `viewManager.createView/destroyView/requestTo/broadcast`; Status: confirmed
  - **主题系统** — Main: [main/services/themeService.ts](../../src/main/services/themeService.ts), [shared/theme/](../../src/shared/theme/); Entry: `themeService` (主进程 SOT) + `themeApi`; Status: confirmed; Feature CodeMap: pending
  - **i18n** — Main: [main/services/i18nService.ts](../../src/main/services/i18nService.ts), [shared/i18n/](../../src/shared/i18n/); Entry: `i18nService` + `viewManager.broadcast('locale-changed')`; Status: confirmed
  - **全局设置（proxy/GPU/autoLaunch/userAgent）** — Main: [main/services/settingsService.ts](../../src/main/services/settingsService.ts); Entry: `settingsService.init/applyRuntimeEffects`; Status: confirmed
  - **Web App 双行标题栏 + 导航** — Main: [shared/titlebar.ts](../../src/shared/titlebar.ts), [renderer/components/WebAppTitleBar/](../../src/renderer/components/WebAppTitleBar/); Status: confirmed; Feature CodeMap: pending
  - **持久化（配置/favicon/session/日志）** — Main: [main/services/appConfigService.ts](../../src/main/services/appConfigService.ts), [main/services/faviconService.ts](../../src/main/services/faviconService.ts), [main/utils/paths.ts](../../src/main/utils/paths.ts); Status: confirmed
  - **可观测性（日志 + DevTools 入口 + 加载/崩溃事件）** — Main: [shared/utils/log/](../../src/shared/utils/log/), [main/viewManager/managedView.ts](../../src/main/viewManager/managedView.ts); Status: confirmed（devtools-button-and-crash-logging spec 已闭环）
  - **自动更新** — Main: [main/updater/](../../src/main/updater/), [main/services/updaterService.ts](../../src/main/services/updaterService.ts); Status: confirmed
  - **系统托盘** — Main: [main/tray/index.ts](../../src/main/tray/index.ts); Status: confirmed
- Next Drill-Down: 各能力的 Entry 文件 + 对应 Feature CodeMap（多数 pending）

### Node: Module Index

- Type: `module` · Status: `confirmed`
- Purpose: 按"目录/包"路由，标注职责与依赖
- Children:
  - `src/main/services/` — 8 个 service：appConfig / favicon / i18n / mainWindow / settings / shortcut / theme / updater / webApp / webAppWindow。`registerMainServices()`（[index.ts](../../src/main/services/index.ts)）仅注册 5 个跨进程 IPC service：updater / webApp / theme / i18n / settings；其余为内部依赖或 per-view（webAppWindowService）。Key dep: serviceRegistry, channel, viewManager, windowManager
  - `src/main/viewManager/` — `ManagedView`（[managedView.ts](../../src/main/viewManager/managedView.ts)）封装 WebContentsView + webContents 事件订阅（含 `did-fail-load`/`render-process-gone` 日志接线）+ `toggleDevTools()`。Risk: 销毁后访问原生对象抛异常（见 Risk Areas）
  - `src/main/windowManager/` — `ManagedWindow`（[managedWindow.ts](../../src/main/windowManager/managedWindow.ts)）封装 BaseWindow + `isClosing` 标志。macOS 关闭隐藏到托盘
  - `src/shared/serviceRegistry/` — `@Singleton() ServiceRegistry` + `defineApi`/`implementService` + `serviceMetadataRegistry`（靠 `static apiName` 路由，抗 minify）。[index.ts](../../src/shared/serviceRegistry/index.ts)
  - `src/shared/channel/` — MessagePort IPC 封装，类型安全双向通信（`onRequest`/`requestTo`/`broadcast`）。[index.ts](../../src/shared/channel/index.ts)
  - `src/shared/services/` — 6 个 API 抽象类（updater/webApp/webAppWindow/theme/i18n/settings），每个带 `static apiName`。[index.ts](../../src/shared/services/index.ts)
  - `src/shared/preload/args.ts` — `buildPreloadArgs`/`parsePreloadArgs` 对称 API，控制 preload 的 `channelExpose`/`channelTimeout`
  - `src/shared/theme/` · `src/shared/i18n/` — 主题预设/locale 资源（zh-CN + en）
  - `src/preload/index.ts` — 单文件安全边界：仅 `exposeInMainWorld('electronEnv', {platform})` + `channel.init(parsePreloadArgs)` + `logManager.initLog()`
  - `src/renderer/` — React。入口 [main.tsx](../../src/renderer/main.tsx)（管理窗）/ [webapp-titlebar.tsx](../../src/renderer/webapp-titlebar.tsx)（Web App 标题栏）；stores: [webAppStore.ts](../../src/renderer/stores/webAppStore.ts) (Zustand) / [faviconStore.ts](../../src/renderer/stores/faviconStore.ts)
  - `native/` (workspace 子包) — Rust @napi-rs 模块，`pnpm run build:native` 产物 `.node`（Status: inferred，边界未深入）
- Next Drill-Down: 改某模块前先读其 service 抽象（shared/services）+ 实现（main/services）+ 对应测试

### Node: Entry Index

- Type: `entry` · Status: `confirmed`
- Purpose: 列所有"进入系统"的入口符号
- Entries:
  - 进程入口:
    - main: [src/main/index.ts](../../src/main/index.ts) `main()`（Phase 1 sessionData/log → 2 settings/GPU → 3 单实例锁 → 4 ready: `registerMainServices()` + theme/i18n init + `applyRuntimeEffects` + launch/updater → 5 window-all-closed）
    - preload: [src/preload/index.ts](../../src/preload/index.ts) `main()`
    - renderer: [src/renderer/main.tsx](../../src/renderer/main.tsx)、[src/renderer/webapp-titlebar.tsx](../../src/renderer/webapp-titlebar.tsx)
  - UI / routes: `App.tsx`（管理窗根，含 WebCatalog + SettingsDialog + TitleBar）；`WebAppTitleBar`（TitleRow + NavRow）
  - 服务注册（IPC 自动路由）: [registerMainServices](../../src/main/services/index.ts) 在 app ready、任何 window 创建之前调用（防首屏 locale/竞态）
  - CLI / 启动参数: `--open-app=<appId>`（main/index.ts `parseOpenAppArg`，快捷方式模式直开 Web App 而不开管理窗）
  - 事件 handlers: `app.on('second-instance')`（单实例二次启动分发 open-app）、`app.on('activate')`、各 `ManagedView` webContents 事件、`nativeWindow.on('close')`（置 `isClosing`）
- Next Drill-Down: 改启动时序看 main/index.ts 的 5 phase 注释

### Node: Domain And Data

- Type: `object` · Status: `confirmed`
- Purpose: 核心数据对象与落点
- Children:
  - Web App 条目（appId/windowId 分离；持久化于 `~/.web-nest/apps.config`，JSON，经 `appConfigService`）
  - favicon 缓存：`~/.web-nest/.cache/`（`faviconService`，dataURL）
  - session：`~/.web-nest/.cache/sessions/`（`app.setPath('sessionData', …)`；`closeWebApp` 保留、`deleteWebApp` 用 `session.fromPartition().clearStorageData()` 清理）
  - 日志：`~/.web-nest/log/main.log`（`paths.getLogDir()`，受 `WEB_NEST_HOME` 控制；electron-log）
  - 设置：`settingsService`（含 `disableGpu`/proxy/autoLaunch/userAgent）
  - locale 偏好：`~/.web-nest/locale.config`
  - 路径 source of truth: [src/main/utils/paths.ts](../../src/main/utils/paths.ts)，全部受 `WEB_NEST_HOME` 覆盖
  - 状态机: view/window 生命周期（alive → closing(isClosing) → destroyed）；triage `Status:` 五态（见 [docs/agents/triage-labels.md](../agents/triage-labels.md)）
- Next Drill-Down: 改持久化先读 paths.ts + appConfigService + 对应 [appConfig.test.ts](../../src/__tests__/main/services/appConfig.test.ts)

### Node: External Dependencies

- Type: `dependency` · Status: `confirmed`
- Purpose: 进程外的依赖与失败面
- Children:
  - Storage/filesystem: `~/.web-nest/`（配置/缓存/session/日志）；旧日志目录 `%APPDATA%/web-nest/logs/` 不自动迁移
  - 第三方 SDK: electron-log、electron-updater（更新服务器 URL 经 `UPDATE_SERVER_URL` 等环境变量）、i18next、zustand、Radix UI、tailwind v4
  - native: `native` workspace 子包（Rust @napi-rs，`.node` 产物，勿手改）
  - 外部 URL: Web App 内容 view 加载任意第三方页面（加载失败/崩溃经 ManagedView 记日志，不恢复）
  - failure surfaces: 外部 URL `did-fail-load`/`render-process-gone`；单实例锁失败即 quit；更新服务器不可达
- Next Drill-Down: 改更新看 [main/updater/](../../src/main/updater/) + updaterService

### Node: Cross-Module Flows

- Type: `flow` · Status: `confirmed`
- Purpose: 列主要跨模块链路（深层链路建 Feature CodeMap）
- Major Flows:
  - **打开 Web App** — Modules: WebCatalog(renderer) → webAppApi → channel/preload → webAppService → windowManager.createWindow + viewManager.createView(标题栏 view + 内容 view 双 view) → WebAppWindowService per-view `implementService`；Effect: 独立窗口 + 双行标题栏；Drill-Down: pending feature map
  - **IPC 请求路由（任意 api.method）** — Modules: renderer API 抽象 → channel.requestTo → preload bridge → main `registerChannelHandlers`(`serviceName:methodName`) → service impl；Effect: 类型安全跨进程调用；Drill-Down: 见 Capability「IPC 通信」
  - **主题切换** — Modules: ThemeToggle(renderer) → themeApi.setTheme → themeService(主进程 SOT 持久化) → viewManager.broadcast → renderer `applyThemeToRoot`；Effect: 全局换肤（防 FOUC 四层）；Drill-Down: pending
  - **持久化读写** — Modules: webAppService → appConfigService → `~/.web-nest/apps.config`；Effect: 重启后 Web App 列表恢复
  - **快捷方式启动** — Modules: OS shortcut(`--open-app=`) → `second-instance`/`parseOpenAppArg` → webAppService.openWebApp（不开管理窗）
- Next Drill-Down: 链路超过 2 跳时建 feature map

### Node: Validation

- Type: `validation` · Status: `confirmed`
- Purpose: 如何证明行为正确
- Validation Entry:
  - Test commands: `pnpm run typecheck` · `pnpm run lint` · `pnpm run test` (Vitest, ~156) · `pnpm run test:e2e` (Playwright, ~19) · `pnpm run build` · `pnpm run check` (lint+typecheck+test+build)
  - Test directories: [src/__tests__/](../../src/__tests__/)（main/preload/renderer/shared/integration 五区）、[tests/e2e/](../../tests/e2e/)
  - Vitest projects: `main`(node) / `preload`(jsdom) / `renderer`(jsdom)，setup 在 `src/__tests__/infrastructure/`
  - Smoke paths: E2E [tests/e2e/webCatalog.spec.ts](../../tests/e2e/webCatalog.spec.ts) / [webAppTitlebar.spec.ts](../../tests/e2e/webAppTitlebar.spec.ts) / [theme.spec.ts](../../tests/e2e/theme.spec.ts) / [settings.spec.ts](../../tests/e2e/settings.spec.ts) / [app.spec.ts](../../tests/e2e/app.spec.ts)
  - Logs: `~/.web-nest/log/main.log`
  - Known CI checks: `.github/workflows/ci.yml` — check(ubuntu: lint+typecheck+unit) / build(win/mac/ubuntu) / e2e(win)
- proves: 单元行为、IPC 契约、E2E 标题栏/导航/主题
- does not prove: 生产签名/更新真实链路、native 模块跨平台行为
- Next Drill-Down: 改某 service 先读其同名测试（行为即规格）

### Node: Risk Areas

- Type: `risk` · Status: `confirmed`
- Purpose: 易踩坑、需谨慎的地形
- Risks:
  - **销毁后访问原生对象抛异常** — Source: BaseWindow/WebContents 销毁后属性访问；Affected: 所有 destroy/detach/close 路径；缓解: 「Map 先 delete 再 destroy」+ 基础设施层 try-catch + `isClosing` + `isDestroyed()` 保护（见 AGENTS.md「销毁安全约定」）；Suggested Feature CodeMap: webapp-lifecycle
  - **`mockWebContents` 是模块级共享单例** — Source: [src/__tests__/infrastructure/mocks/electron.ts](../../src/__tests__/infrastructure/mocks/electron.ts) 的 handlers Map 跨测试累积，`vi.clearAllMocks` 不清；Affected: 基于 webContents 事件的单元测试；缓解: `beforeEach` `webContents.removeAllListeners()`
  - **minify 混淆 `Function.name`** — Source: 生产构建；缓解: API 抽象类声明 `static apiName`（勿依赖 constructor.name）；Suggested Feature CodeMap: ipc-and-serviceregistry
  - **fill→click 时序 flaky** — Source: Playwright `fill()` 后 React 状态未同步；缓解: submit 点击前加 `toBeEnabled()` 断言
  - **外部 URL 白屏无可观测** — Source: 第三方页面加载失败/崩溃；现状: 仅记日志 + DevTools 按钮，无恢复 UI（显式 Out-of-Scope）
- Next Drill-Down: 动原生资源生命周期前读 AGENTS.md 销毁约定 + managedView/managedWindow

### Node: Feature CodeMap Backlog

- Type: `capability` · Status: `confirmed`
- Purpose: 建议后续建的深度 Feature CodeMap（按优先级）
- Backlog:
  - **ipc-and-serviceregistry** — Why: 项目通信地基，所有 service 共用；Likely entry: [serviceRegistry/index.ts](../../src/shared/serviceRegistry/index.ts) `implementService` → `registerChannelHandlers`；Likely files: shared/channel/, shared/services/, main/services/index.ts；Priority: high
  - **webapp-lifecycle** — Why: CRUD + 双 view 窗口 + session + 销毁，链路长且踩坑多；Likely entry: `webAppService.openWebApp/closeWebApp/deleteWebApp/destroyEntry`；Likely files: webAppService.ts, webAppWindowService.ts, windowManager/, viewManager/；Priority: high
  - **webapp-titlebar** — Why: 双行标题栏 + 双 view + per-view service + 导航；Likely entry: [shared/titlebar.ts](../../src/shared/titlebar.ts), [WebAppTitleBar/](../../src/renderer/components/WebAppTitleBar/)；Priority: medium
  - **theme-system** — Why: 三层映射 + 防 FOUC 四层；Likely entry: themeService + shared/theme/；Priority: medium
  - **observability** — Why: 日志迁移 + DevTools 按钮 + 加载/崩溃事件（spec 已闭环，可存档为 map）；Priority: low
  - **i18n** / **settings** — Priority: low（架构与 theme 同构，AGENTS.md 已详述）
- Evidence: AGENTS.md + 项目 memory + 既有 spec 目录 [docs/specs/](../specs/)

## 3. Compact Indexes

### Capability Index Table

| Capability | Main Modules | Entry | Feature CodeMap | Status |
| ---------- | ------------ | ----- | --------------- | ------ |
| IPC/ServiceRegistry | shared/serviceRegistry, shared/channel | `defineApi`/`implementService` | pending | confirmed |
| Web App 管理 | main/services/webAppService, webAppWindowService | `webAppService.openWebApp` | pending | confirmed |
| 窗口管理 | main/windowManager | `windowManager.createWindow` | — | confirmed |
| 视图管理 | main/viewManager | `viewManager.createView` | — | confirmed |
| 主题 | main/services/themeService, shared/theme | `themeService`+`themeApi` | pending | confirmed |
| i18n | main/services/i18nService, shared/i18n | `i18nService`+broadcast | — | confirmed |
| 全局设置 | main/services/settingsService | `settingsService.applyRuntimeEffects` | — | confirmed |
| Web App 标题栏 | shared/titlebar, renderer/WebAppTitleBar | TitleRow+NavRow | pending | confirmed |
| 持久化 | appConfigService, faviconService, utils/paths | `paths.*` | — | confirmed |
| 可观测性 | shared/utils/log, viewManager/managedView | log + DevTools toggle | (spec 已闭环) | confirmed |
| 自动更新 | main/updater, updaterService | `initUpdater` | — | confirmed |

### Quick File Index

- [AGENTS.md](../../AGENTS.md): 项目活文档（架构/约定/禁止事项）— 改任何代码前先读
- [src/main/index.ts](../../src/main/index.ts): main 启动 5-phase
- [src/shared/serviceRegistry/index.ts](../../src/shared/serviceRegistry/index.ts): 通信核心
- [src/preload/index.ts](../../src/preload/index.ts): 安全边界
- [src/main/services/index.ts](../../src/main/services/index.ts): 主 service 注册时序
- [src/main/utils/paths.ts](../../src/main/utils/paths.ts): 持久化路径 SOT
- [docs/agents/](../agents/): SDD skills 配置（issue tracker/triage/domain）
- [docs/specs/](../specs/): 历史 feature spec

## 4. Maintenance Notes

- 模块边界、入口类型、外部依赖、验证命令变化时刷新本 Project CodeMap。
- 窄范围 feature 改动不要整图刷新——建/更新对应 Feature CodeMap（`docs/codemap/<feature>.md`），用 `/codemap` feature 或 drift-check。
- 与源码冲突时以源码为准并回写本图；`Status` 字段标 `confirmed`/`inferred`/`unknown`，勿隐藏不确定性。
