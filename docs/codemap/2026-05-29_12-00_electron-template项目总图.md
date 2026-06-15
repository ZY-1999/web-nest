# web-nest CodeMap (project)

Updated: 2026-06-11 — i18n + Settings + WebApp Titlebar + Favicon async + AppConfig 持久化 + Shortcut + 启动时序修复
Renamed from: electron-template → web-nest

## 1. Orientation

- Project: web-nest
- Role / responsibility: Electron 34 + React 18 + TypeScript 桌面应用（多 Web App 管理器），提供 MessagePort IPC、服务注册表、窗口/视图管理、i18n、Settings、自动更新等开箱即用能力
- Main languages / frameworks: TypeScript, React 18, Electron 34, Vite 5, Tailwind CSS v4, Rust (@napi-rs)
- Runtime / deployment shape: 桌面应用 (electron-builder 打包，Windows NSIS)
- Primary entry types: Electron main process → preload → renderer 三进程架构（renderer 多页：main + webapp-titlebar）
- Confidence:
  - confirmed: 三进程架构、Channel IPC 通信、Service Registry 服务注册、窗口/视图管理、日志系统、构建/测试体系、标题栏系统、i18n、Settings、WebApp Titlebar、Favicon、AppConfig 持久化、启动时序
  - inferred: CI pipeline 细节 (.github/)
  - unknown: 生产部署配置、auto-update 实际更新服务器

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
- Purpose: 项目全局入口索引，路由到各能力子图
- Read First:
  - `src/main/index.ts`: 主进程入口
  - `src/preload/index.ts`: preload 入口
  - `src/renderer/main.tsx`: renderer 主页入口
  - `src/renderer/webapp-titlebar.tsx`: renderer WebApp 标题栏入口
- Edges / Children:
  - `Capability Index`: IPC 通信、服务注册、窗口管理、视图管理、自动更新、系统托盘、日志、Rust native、Theme System、Preload Args、Titlebar System、i18n、Settings、WebApp Titlebar、Favicon、AppConfig、Shortcut
  - `Module Index`: src/main, src/preload, src/renderer, src/shared (含 utils), native/
  - `Entry Index`: 三进程入口点 + 多页 renderer
  - `Domain And Data`: 服务定义、窗口/视图状态、序列化、i18n 类型、Settings 类型
  - `External Dependencies`: electron, electron-log, electron-updater, @napi-rs, React, Zustand, i18next
  - `Cross-Module Flows`: IPC 请求流、服务调用流、i18n 初始化流、Settings 读写流
  - `Validation`: Vitest 三环境 + Playwright E2E
  - `Risk Areas`: 跨进程状态同步、Port 生命周期、Singleton 跨进程限制、IPC handler 注册时序
  - `Feature CodeMap Backlog`: Channel 深度流、ServiceRegistry 完整生命周期
- Evidence: 源码结构 + package.json + README.md
- Unknowns: CI 详细配置
- Next Drill-Down: `Capability Index` → 各能力模块

### Node: Capability Index

- Type: `capability`
- Status: `confirmed`
- Purpose: 项目核心能力路由索引
- Children:
  - `Channel IPC 通信`:
    - Main modules: `src/shared/channel/`
    - Entry: `Channel.init()` (各进程调用)
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Service Registry 服务注册`:
    - Main modules: `src/shared/serviceRegistry/`, `src/shared/services/`
    - Entry: `serviceRegistry.defineApi()` + `implementService()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Window Management`:
    - Main modules: `src/main/windowManager/`
    - Entry: `windowManager.createWindow()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `View Management`:
    - Main modules: `src/main/viewManager/`
    - Entry: `viewManager.createView()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Auto Update`:
    - Main modules: `src/main/updater/`, `src/main/services/updaterService.ts`
    - Entry: `initUpdater()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `System Tray`:
    - Main modules: `src/main/tray/`
    - Entry: `appTray.create()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Unified Logging`:
    - Main modules: `src/shared/utils/log/`
    - Entry: `logManager.initLog()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Rust Native Module`:
    - Main modules: `native/`, `src/main/nativeExample.ts`
    - Entry: `native/build.rs` → `greet()`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `WebApp Service`:
    - Main modules: `src/shared/services/webAppApi.ts`, `src/main/services/webAppService.ts`, `src/renderer/stores/webAppStore.ts`, `src/renderer/components/WebCatalog/`
    - Entry: `webAppMainApi.createWebApp()` / `WebAppService.createWebApp()`
    - Note: 使用 ViewManager + ManagedView 管理 view 生命周期，preload + channelExpose:false 防止外部页面访问 IPC
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Service Timeout`:
    - Main modules: `src/shared/serviceRegistry/decorators.ts`, `src/shared/serviceRegistry/serviceMetadataRegistry.ts`
    - Entry: `@Timeout(ms)` / `@MethodTimeout(ms)` 装饰器
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Frontend UI`:
    - Main modules: `src/renderer/` (React + Zustand + Tailwind + shadcn/ui)
    - Entry: `src/renderer/main.tsx`
    - Note: App.tsx flex 纵向布局（TitleBar 固定顶部 + WebCatalog flex-1），ThemeToggle 嵌入 TitleBar，SettingsDialog 全局弹窗
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Theme System`:
    - Main modules: `src/shared/theme/`, `src/shared/services/themeApi.ts`, `src/main/services/themeService.ts`, `src/renderer/components/ThemeToggle/`, `src/renderer/styles/index.css`
    - Entry: `ThemeApi` (IPC) → `ThemeService` (主进程状态) → `applyThemeToRoot()` (CSS 变量)
    - Note: light/dark 两态，主进程 single source of truth，CSS 变量直接用 hex；防闪烁：离屏创建 (x:-10000) + window/view backgroundColor + renderer 渲染前 applyThemeToRoot + 50ms 后居中定位
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Preload Args`:
    - Main modules: `src/shared/preload/args.ts`
    - Entry: `buildPreloadArgs()` (main) / `parsePreloadArgs()` (preload)
    - Note: 通过 `additionalArguments` 从主进程向 preload 传递 channel 初始化参数（timeout、expose），对称 build/parse API
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Titlebar System`:
    - Main modules: `src/main/mainWindow.ts`, `src/renderer/components/TitleBar/`, `src/renderer/styles/index.css`
    - Entry: `getTitleBarOptions()` (main) + `<TitleBar />` (renderer)
    - Note: BaseWindow `titleBarStyle: 'hidden'`，macOS 保留 traffic lights，Windows/Linux 用 titleBarOverlay。主窗口 TitleBar 35px drag region，平台预留安全区。CSP: img-src 支持 data: blob:
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `i18n System`:
    - Main modules: `src/shared/i18n/`, `src/shared/services/i18nApi.ts`, `src/main/services/i18nService.ts`, `src/renderer/i18n.ts`
    - Entry: `I18nService.init()` (main) + `initI18n()` (renderer)
    - Note: 主进程初始化 i18next，renderer 通过 IPC 获取 locale 后初始化自己的 i18next 实例。优先级：settings.json > 迁移的 locale.config > app.getLocale() > 'en'。setLocale 通过 IPC 广播到所有 view
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Settings System`:
    - Main modules: `src/shared/settings.ts`, `src/shared/services/settingsApi.ts`, `src/main/services/settingsService.ts`, `src/renderer/components/SettingsDialog/`
    - Entry: `SettingsService.init()` (main, Phase 2) + `settingsApi.getSettings()` (renderer IPC)
    - Note: 全局 JSON 配置 (`~/.web-nest/settings.json`)，theme/locale/autoLaunch/disableGpu/proxy/userAgent。setSettings 触发 runtime effects (autoLaunch + userAgent + proxy)。支持代理测试 (testProxy)
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `WebApp Titlebar`:
    - Main modules: `src/renderer/components/WebAppTitleBar/`, `src/renderer/webapp-titlebar.tsx`, `src/shared/titlebar.ts`, `src/main/services/webAppWindowService.ts`
    - Entry: `webapp-titlebar.tsx` (独立 renderer 页面) + `WebAppWindowService` (per-view service)
    - Note: 双行标题栏 — TitleRow (favicon + title + theme + 窗口控制, 35px) + NavRow (导航 + URL, 35px)。multi-page Vite 构建。WebAppWindowService 是 per-view 非 Singleton，通过 implementService 注册，构造时捕获 content view 引用
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Favicon Service`:
    - Main modules: `src/main/services/faviconService.ts`, `src/renderer/components/FaviconImg/`, `src/renderer/stores/faviconStore.ts`
    - Entry: `faviconService.fetchFaviconDataUrl()` (主进程 async) + `<FaviconImg>` (renderer 轮询)
    - Note: sync 缓存 + fire-and-forget + renderer 轮询模式。缓存目录 `~/.web-nest/.cache/`
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `AppConfig Service`:
    - Main modules: `src/main/services/appConfigService.ts`
    - Entry: `appConfigService.load()` / `save()` / `getApp()` / `upsertApp()` / `removeApp()`
    - Note: Web App 列表持久化 (`~/.web-nest/apps.config`)，存储 id/url/title/faviconUrl/createdAt
    - Feature CodeMap: pending
    - Status: `confirmed`
  - `Shortcut Service`:
    - Main modules: `src/main/services/shortcutService.ts`
    - Entry: `shortcutService.createShortcut()`
    - Note: 创建桌面快捷方式，`--open-app=<appId>` 参数启动
    - Feature CodeMap: pending
    - Status: `confirmed`
- Evidence: 源码目录结构
- Unknowns: 无
- Validation: `pnpm run test` + `pnpm run test:e2e`
- Next Drill-Down: 按 capability 进入各子模块

### Node: Module Index

- Type: `module`
- Status: `confirmed`
- Purpose: 顶层模块边界和职责
- Children:
  - `src/main/`:
    - Path: `src/main/`
    - Responsibility: Electron 主进程：应用入口、窗口/视图管理、服务实现（i18n/settings/theme/webApp/favicon/appConfig/shortcut/updater）、托盘、更新
    - Key dependencies: electron, electron-updater, electron-log, native, i18next
    - Risk notes: 持有所有 native 资源引用；IPC handler 注册时序敏感（必须在窗口创建前）
  - `src/preload/`:
    - Path: `src/preload/`
    - Responsibility: 初始化 Channel（含 parsePreloadArgs 解析 additionalArguments）、contextBridge 暴露 electronEnv（platform）+ 条件性 channel API
    - Key dependencies: electron (contextBridge, ipcRenderer)
    - Risk notes: 安全边界，contextIsolation 启用
  - `src/renderer/`:
    - Path: `src/renderer/`
    - Responsibility: React UI 层：组件（TitleBar + WebCatalog + ThemeToggle + SettingsDialog + WebAppTitleBar + FaviconImg）、状态(Zustand stores: webApp + favicon)、i18n 初始化、renderer 侧服务
    - Key dependencies: react, react-dom, zustand, tailwindcss, lucide-react, i18next, react-i18next
    - Risk notes: 多页构建（main + webapp-titlebar）
  - `src/shared/`:
    - Path: `src/shared/`
    - Responsibility: 跨进程共享代码：Channel IPC、Service Registry、服务 API 定义（updater/webApp/webAppWindow/theme/i18n/settings）、i18n 类型/资源、Settings 类型、Theme、Preload Args、titlebar 常量、通用工具
    - Key dependencies: (内部), i18next
    - Risk notes: 核心通信层，变更影响所有进程
  - `src/shared/utils/`:
    - Path: `src/shared/utils/`
    - Responsibility: 通用工具：Singleton 装饰器、日志、序列化、TypedEmitter、promise 工具、类型工具
    - Key dependencies: electron-log
    - Risk notes: Singleton 装饰器限制进程类型
  - `src/shared/preload/`:
    - Path: `src/shared/preload/`
    - Responsibility: Preload 参数工具：buildPreloadArgs / parsePreloadArgs 对称 API，PRELOAD_ARGS 常量注册
    - Key dependencies: (无)
    - Risk notes: 新增参数只需扩展 PRELOAD_ARGS + PreloadOptions
  - `native/`:
    - Path: `native/`
    - Responsibility: Rust native 模块示例 (@napi-rs)，pnpm workspace 独立包
    - Key dependencies: napi, napi-derive
    - Risk notes: 平台特定二进制，需单独构建
  - `src/__tests__/`:
    - Path: `src/__tests__/`
    - Responsibility: Vitest 单元测试：三套环境 (main/preload/renderer)、integration、shared、mock 基础设施
    - Key dependencies: vitest, jsdom, @testing-library/react, msw
    - Risk notes: 无
  - `tests/e2e/`:
    - Path: `tests/e2e/`
    - Responsibility: Playwright E2E 测试：启动真实 Electron 进程，覆盖 app/theme/settings/webCatalog/webAppTitlebar
    - Key dependencies: @playwright/test
    - Risk notes: 依赖完整构建
- Evidence: 目录结构 + 源码
- Unknowns: 无
- Validation: 目录遍历确认
- Next Drill-Down: `src/shared/channel/` 和 `src/shared/serviceRegistry/` 为核心模块

### Node: Entry Index

- Type: `entry`
- Status: `confirmed`
- Purpose: 列出所有运行时入口点
- Entries:
  - Main process:
    - `src/main/index.ts` → Phase 1 (基础设施) → Phase 2 (settingsService.init) → Phase 3 (单实例锁) → Phase 4 (`registerMainServices()` → themeService.init → i18nService.init → settingsService.applyRuntimeEffects → 条件分支：正常模式 launchManagementWindow / 快捷方式模式 openWebApp)
  - Preload:
    - `src/preload/index.ts` → `contextBridge.exposeInMainWorld('electronEnv', { platform })` → `parsePreloadArgs(process.argv)` → `channel.init({ defaultTimeout, expose })` + `logManager.initLog()`
  - Renderer (main page):
    - `src/renderer/main.tsx` → serviceRegistry setup + `i18nApi.getLocale()` + `themeApi.getTheme()` (并行) + `initI18n(locale)` + `applyThemeToRoot(theme)` + `channel.onRequest('locale-changed')` + ReactDOM.render → `App.tsx` → `<TitleBar />` + `<WebCatalog />`
  - Renderer (webapp-titlebar page):
    - `src/renderer/webapp-titlebar.tsx` → serviceRegistry setup + `i18nApi.getLocale()` + `themeApi.getTheme()` (并行) + `initI18n(locale)` + `applyThemeToRoot(theme)` + `channel.onRequest('locale-changed')` + ReactDOM.render → `<WebAppTitleBar />`
  - Vite builds:
    - `vite.config.main.mts` (main process)
    - `vite.config.preload.mts` (preload)
    - `vite.config.renderer.mts` (renderer, multi-page: index.html + webapp-titlebar.html)
  - Build scripts:
    - `scripts/dev.mjs` (开发模式，concurrently 启动三构建)
    - `scripts/build.mjs` (生产构建)
  - Native module:
    - `native/build.rs` → Cargo cdylib → .node binary
- Evidence: package.json scripts + 源码入口文件
- Unknowns: 無
- Validation: `pnpm run dev` / `pnpm run build` 验证构建
- Next Drill-Down: `src/main/index.ts` 为主线

### Node: Domain And Data

- Type: `object`
- Status: `confirmed`
- Purpose: 核心数据对象和类型
- Children:
  - Core domain objects:
    - `UpdaterApi` / `WebAppMainApi` / `WebAppWindowApi` / `ThemeApi` / `I18nApi` / `SettingsApi`: 抽象服务 API 类 (`src/shared/services/`)
    - `ChannelAPI` / `ChannelLike` / `ChannelCenter`: 通信接口 (`src/shared/channel/types.ts`)
    - `ServiceRegistry`: 服务注册/路由 (`src/shared/serviceRegistry/`)
  - State objects:
    - `WindowState`: `{ id, visible, focused, bounds }` (`src/shared/window.ts`)
    - `ViewState`: `{ id, type, url, bounds, visible, focused, loaded }` (`src/shared/view.ts`)
    - `WebAppState`: `{ id, url, title, faviconUrl, faviconDataUrl }` (API 类型, `src/shared/services/webAppApi.ts`)
    - `WebAppEntry`: `{ appId, windowId, viewId, url, title, faviconUrl }` (main 进程内部状态, `src/main/services/webAppService.ts`)
    - `NavigationState`: `{ canGoBack, canGoForward, url }` (`src/shared/services/webAppWindowApi.ts`)
    - `WebCatalogState`: `{ apps, addApp, removeApp, updateApp }` (Zustand store, `src/renderer/stores/webAppStore.ts`)
    - `ServiceMetadata`: `{ serviceName, processType, classTimeout, methodTimeouts }` (`src/shared/serviceRegistry/serviceMetadataRegistry.ts`)
  - Config objects:
    - `AppSettings`: `{ theme, locale, autoLaunch, disableGpu, proxyMode, proxyHost, proxyPort, userAgent }` (`src/shared/settings.ts`)
    - `SupportedLocale`: `'en' | 'zh-CN'` (`src/shared/i18n/types.ts`)
    - `PreloadOptions`: `{ channelTimeout?, channelExpose? }` (`src/shared/preload/args.ts`)
    - `PRELOAD_ARGS`: `{ CHANNEL_TIMEOUT, CHANNEL_EXPOSE }` (常量注册, `src/shared/preload/args.ts`)
    - `PersistedApp`: `{ id, url, title, faviconUrl, createdAt }` (`src/main/services/appConfigService.ts`)
  - i18n resources:
    - `en.json` / `zh-CN.json`: 翻译资源 (`src/shared/i18n/locales/`)
  - Environment objects:
    - `ElectronEnv`: `{ platform: NodeJS.Platform }` (`src/global.d.ts`) — preload 通过 contextBridge 暴露给 renderer
  - Message types:
    - `ChannelRequest` / `ChannelResponse` / `ChannelMessage`: IPC 消息 (`src/shared/channel/types.ts`)
  - Config namespaces:
    - `UpdateConfig`: `{ updateServerURL, autoCheckOnStartup, autoDownload, checkInterval }` (`src/main/updater/types.ts`)
    - `LogConfig`: `{ level, maxSize, logDir, resolveLogPath, format }` (`src/shared/utils/log/index.ts`)
    - `WindowOptions` / `ViewOptions`: 创建选项 (`src/shared/window.ts`, `src/shared/view.ts`)
  - Error types:
    - `ChannelTimeoutError` (`src/shared/channel/error.ts`)
    - `ServiceTimeoutError` (`src/shared/serviceRegistry/error.ts`)
  - Important patterns:
    - `@Singleton()` / `@Singleton('preload', 'renderer')`: 进程感知单例装饰器
    - `@Timeout(ms)` / `@MethodTimeout(ms)`: 服务超时装饰器 (priority: method > class > global > built-in 10s)
    - `buildPreloadArgs()` / `parsePreloadArgs()`: 对称 API，主进程构建 additionalArguments，preload 解析
    - `per-view service`: 非 Singleton 类（如 WebAppWindowService）通过 `implementService(channel, instance)` 注册，每个 view 独立 channel handler
- Evidence: 源码类型定义
- Unknowns: 无
- Validation: TypeScript 编译 (`pnpm run typecheck`)
- Next Drill-Down: `src/shared/channel/types.ts` + `src/shared/serviceRegistry/types.ts`

### Node: External Dependencies

- Type: `dependency`
- Status: `confirmed`
- Purpose: 关键外部依赖及其故障面
- Children:
  - electron@34.0.0:
    - used by: main process (BaseWindow, WebContentsView, ipcMain, MessageChannelMain), preload (contextBridge, ipcRenderer)
    - failure surfaces: API 版本兼容性、WebContentsView 较新 API
  - electron-log@~5.2.0:
    - used by: main process 日志持久化
    - failure surfaces: 版本升级 breaking change
  - electron-updater@~6.8.3:
    - used by: 自动更新
    - failure surfaces: 更新服务器不可达
  - React 18 + ReactDOM:
    - used by: renderer UI
    - failure surfaces: 无
  - Zustand@^5.0.12:
    - used by: renderer 状态管理 (webAppStore, faviconStore)
    - failure surfaces: 无
  - @napi-rs (native):
    - used by: Rust native 模块
    - failure surfaces: 平台二进制兼容性，需 native build
  - Tailwind CSS v4 + shadcn/ui:
    - used by: renderer UI 样式
    - failure surfaces: 无
  - i18next + react-i18next:
    - used by: 主进程 i18next (main) + renderer i18next (独立实例) + react-i18next hooks
    - failure surfaces: 无
- Evidence: package.json dependencies
- Unknowns: 无
- Validation: `pnpm install` + `pnpm run build`
- Next Drill-Down: electron API 版本关注点

### Node: Cross-Module Flows

- Type: `flow`
- Status: `confirmed`
- Purpose: 主要跨模块数据流
- Major flows:
  - Flow: IPC Channel 初始化
    - Modules: main → preload → renderer
    - Entry: `viewManager.createView()` → `Channel.init()` (main) → preload `parsePreloadArgs()` → `channel.init({ expose })` → `contextBridge.exposeInMainWorld` (条件) → renderer 通过 `window.__app_channel__` 接收
    - Effect: 建立 MessagePort 双向通道，preload args 控制 timeout 和 expose 行为
    - Drill-Down: `src/shared/channel/portManager.ts` → `src/shared/channel/impl.ts` → `src/shared/preload/args.ts`
  - Flow: Service RPC 调用 (renderer → main)
    - Modules: renderer (proxy) → channel → main (handler)
    - Entry: `apiDefinitions.invokeRemote()` → `channel.request("ApiName:method")` → main handler
    - Effect: 跨进程方法调用，带超时和错误序列化
    - Drill-Down: `src/shared/serviceRegistry/apiDefinitions.ts`
  - Flow: App 启动
    - Modules: main/index.ts
    - Entry: Phase 1 (paths/log) → Phase 2 (`settingsService.init()`) → Phase 3 (单实例锁) → Phase 4 (`registerMainServices()` → `themeService.init()` → `i18nService.init()` → `settingsService.applyRuntimeEffects()` → 正常模式 `launchManagementWindow()` / 快捷方式模式 `webAppService.openWebApp()`)
    - Effect: `registerMainServices()` 在 `app.whenReady()` 最前面调用，确保所有 IPC handler 在任何窗口创建前注册，避免 renderer IPC 调用竞争
    - Drill-Down: `src/main/index.ts`
  - Flow: Window 创建
    - Modules: main/index.ts → windowManager → viewManager → managedWindow + managedView
    - Entry: `createMainWindow()` → `themeService.getTheme()` → `windowManager.createWindow({ backgroundColor, ...getTitleBarOptions() })` + `viewManager.createView({ backgroundColor })` + `view.attachTo()` + (dev) `view.webContents.openDevTools()`
    - Effect: 创建 BaseWindow (离屏 x:-10000 + backgroundColor + titleBarStyle 平台适配) + WebContentsView (setBackgroundColor)，绑定 resize 事件，50ms 后居中定位
    - Drill-Down: `src/main/mainWindow.ts`
  - Flow: WebApp 创建与窗口管理
    - Modules: renderer (WebCatalog) → channel → main (WebAppService) → viewManager + windowManager
    - Entry: `webAppMainApi.createWebApp(url)` → `WebAppService.createWebApp()` → `windowManager.createWindow()` + `viewManager.createView({ preload, additionalArguments: buildPreloadArgs({ channelExpose: false }) })` × 2 (titlebar view + content view) + `view.attachTo(win)`
    - Effect: 为每个 web app 创建独立 BaseWindow，双 View 布局（titlebar view 本地 renderer + content view 外部 URL），共享 preload
    - Note: 销毁顺序 — content view 先销毁，titlebar view 后销毁。`WebAppWindowService` 是 per-view service，在 `fetchFaviconDataUrl` 之前必须 `implementService`
    - Drill-Down: `src/main/services/webAppService.ts` → `src/renderer/components/WebCatalog/index.tsx`
  - Flow: i18n 初始化与切换
    - Modules: main (i18nService) → IPC → renderer (initI18n / changeLocale)
    - Entry: `I18nService.init()` → 主进程 i18next 初始化 (priority: settings.json > migrated locale.config > app.getLocale() > 'en') → renderer `i18nApi.getLocale()` → `initI18n(locale)`
    - Effect: renderer 获取 locale 后初始化独立 i18next 实例。`setLocale()` 通过 `viewManager.broadcast('locale-changed')` 推送到所有 view
    - Drill-Down: `src/main/services/i18nService.ts` → `src/renderer/i18n.ts`
  - Flow: Settings 读写与 Runtime Effects
    - Modules: renderer (SettingsDialog) → IPC → main (SettingsService) → settings.json + runtime effects
    - Entry: `settingsApi.getSettings()` / `settingsApi.setSettings(patch)` → `settingsService.setSettingsSync()` → `save()` + `applyRuntimeEffects()` (autoLaunch + userAgent + proxy)
    - Effect: 全局 JSON 配置变更即时生效。proxy 三层覆盖：session.defaultSession + Node env vars + per-app sessions
    - Drill-Down: `src/main/services/settingsService.ts` → `src/renderer/components/SettingsDialog/index.tsx`
  - Flow: Service Timeout 生效
    - Modules: decorator → serviceMetadataRegistry → apiDefinitions (Proxy handler)
    - Entry: `@Timeout(500)` class decorator → `serviceMetadataRegistry.setClassTimeout()` → Proxy handler 中 `getEffectiveTimeout()` → `Promise.race` / `channel.request({ timeout })`
    - Effect: 同进程 Promise.race，跨进程传递 timeout 到 channel.request
    - Drill-Down: `src/shared/serviceRegistry/decorators.ts` → `src/shared/serviceRegistry/serviceMetadataRegistry.ts`
  - Flow: 平台感知标题栏
    - Modules: preload → renderer (main.tsx → App.tsx → TitleBar)
    - Entry: `contextBridge.exposeInMainWorld('electronEnv', { platform })` → `document.body.classList.add('platform-${platform}')` → TitleBar 根据 CSS class 预留安全区
    - Effect: macOS 左侧预留 traffic lights (80px)，Windows/Linux 右侧预留窗口控制 (138px)
    - Drill-Down: `src/renderer/components/TitleBar/index.tsx` → `src/renderer/styles/index.css`
  - Flow: WebApp 标题栏导航
    - Modules: main (webAppWindowService) → IPC → renderer (WebAppTitleBar)
    - Entry: 主进程监听 content view `did-navigate` / `did-navigate-in-page` → `viewManager.requestTo()` push 到标题栏 view → `<NavRow>` 显示 URL + 导航状态
    - Effect: 实时同步外部 URL 导航状态到独立标题栏 renderer
    - Drill-Down: `src/main/services/webAppWindowService.ts` → `src/renderer/components/WebAppTitleBar/`
- Evidence: 源码调用链追踪
- Unknowns: 无
- Validation: `pnpm run test` (channel.test.ts, registry.test.ts)
- Next Drill-Down: Channel IPC 流 和 Service Registry 流 值得深度 Feature CodeMap

### Node: Validation

- Type: `validation`
- Status: `confirmed`
- Purpose: 测试和验证入口
- Validation Entry:
  - Test commands:
    - `pnpm run test` — Vitest 全量单元测试 (151 tests, 16 files)
    - `pnpm run test:main` — main 环境测试 (node)
    - `pnpm run test:preload` — preload 环境测试 (jsdom)
    - `pnpm run test:renderer` — renderer 环境测试 (jsdom)
    - `pnpm run test:e2e` — Playwright E2E (需先 build, ~19 tests 含 7 个标题栏)
  - Test directories:
    - `src/__tests__/main/` — main 进程测试 (channel, services [registry/timeout/settings/appConfig/favicon], viewManagerChannel, serialize, nativeExample, singleton)
    - `src/__tests__/preload/` — preload 测试 (singleton)
    - `src/__tests__/renderer/` — renderer 测试 (singleton)
    - `src/__tests__/shared/` — 共享类型测试 (type.test.ts, apiType.test.ts, channelArgs.test.ts)
    - `src/__tests__/integration/` — 集成测试 (webAppService.integration.test.ts)
    - `src/__tests__/infrastructure/` — 测试基础设施 (mocks, helpers, setup)
    - `tests/e2e/` — Playwright E2E (app, theme, settings, webCatalog, webAppTitlebar)
  - Smoke paths:
    - `src/__tests__/main/channel.test.ts` — Channel IPC 核心测试
    - `src/__tests__/main/services/registry.test.ts` — Service Registry 测试
    - `src/__tests__/main/services/timeout.test.ts` — Timeout 装饰器 + 优先级测试
    - `src/__tests__/main/services/settings.test.ts` — Settings 持久化 + runtime effects
    - `src/__tests__/main/services/appConfig.test.ts` — AppConfig 持久化测试
    - `src/__tests__/main/services/favicon.test.ts` — Favicon 缓存 + fetch 测试
    - `src/__tests__/shared/channelArgs.test.ts` — Preload Args build/parse + round-trip (13 tests)
    - `src/__tests__/integration/webAppService.integration.test.ts` — WebApp 集成测试
    - `tests/e2e/webAppTitlebar.spec.ts` — WebApp 标题栏 E2E (7 tests)
    - `tests/e2e/settings.spec.ts` — Settings UI E2E
  - Local run: `pnpm run dev` 启动开发环境
  - Known CI checks: lint + typecheck + test + build (见 AGENTS.md `pnpm run check`)
- Edges / Children:
  - proves: Channel IPC 消息收发、Service 注册和路由、窗口/视图管理、序列化/反序列化、Preload Args 对称 API、Settings 持久化、AppConfig 持久化、Favicon 缓存
  - does not prove: 自动更新实际流程、Rust native 模块完整功能、多窗口交互、i18n locale detection 在各平台的实际行为
- Evidence: vitest.config.mts + tests/ 目录 + package.json scripts
- Unknowns: CI 具体配置 (.github/)
- Next Drill-Down: `src/__tests__/infrastructure/mocks/electron.ts` 了解 Electron mock 策略

### Node: Risk Areas

- Type: `risk`
- Status: `confirmed`
- Purpose: 需要关注的风险区域
- Risks:
  - Risk: Port 生命周期管理
    - Source: `src/shared/channel/portManager.ts` — MessagePort 创建/传输/关闭
    - Affected capabilities: Channel IPC, 所有跨进程通信
    - Suggested Feature CodeMap: Channel 生命周期深度图
  - Risk: Singleton 跨进程限制
    - Source: `src/shared/utils/singleton.ts` — `@Singleton()` 装饰器按 PROCESS_TYPE 决定是否单例
    - Affected capabilities: 所有 @Singleton 标注的服务 (Channel, ServiceRegistry, WindowManager, ViewManager)
    - Suggested Feature CodeMap: Singleton 模式验证
  - Risk: 序列化/反序列化边界
    - Source: `src/shared/utils/serialize/index.ts` — Error/function/undefined 序列化处理
    - Affected capabilities: Channel IPC 消息、日志
    - Suggested Feature CodeMap: 序列化边界测试覆盖
  - Risk: ViewManager channel 复用
    - Source: `src/main/viewManager/managedView.ts:22` — `channel ?? new Channel()`，视图可能共享或独立 channel
    - Affected capabilities: View Management, IPC 隔离
    - Suggested Feature CodeMap: View channel 隔离模型
  - Risk: Playwright 关闭子窗口与 BaseWindow 生命周期不同步
    - Source: `src/main/services/webAppService.ts` — Playwright `w.close()` 只销毁 webContents (view)，BaseWindow 可能仍存活；stale entry 需同时检查 window + view 存活状态
    - Affected capabilities: WebApp Service, E2E 测试稳定性
    - Mitigation: `isClosing` 标志 + `isNativeAlive` 双重检查 + viewManager/windowManager 先 delete map 再 destroy
  - Risk: BaseWindow titleBarStyle: 'hidden' 兼容性
    - Source: `src/main/mainWindow.ts` — titleBarStyle/titleBarOverlay 通常在 BrowserWindow 文档中描述，BaseWindow 行为需跨平台验证
    - Affected capabilities: Titlebar System, 主窗口布局
    - Mitigation: 已在 Windows 上验证，macOS 待验证
  - Risk: IPC handler 注册时序
    - Source: `src/main/index.ts` — `registerMainServices()` 必须在任何窗口创建前调用，否则 renderer IPC 调用会失败回退到默认值
    - Affected capabilities: 所有 IPC 服务 (i18n, theme, settings, updater, webApp)
    - Mitigation: 已在 Phase 4 最前面调用 registerMainServices()
  - Risk: Favicon 异步竞态
    - Source: `src/main/services/faviconService.ts` — fire-and-forget 模式，renderer 轮询可能读到未完成状态
    - Affected capabilities: WebApp 标题栏 favicon 显示
    - Mitigation: FaviconImg 组件轮询机制
- Unknowns: 无
- Validation: 现有 channel.test.ts + registry.test.ts 覆盖部分
- Next Drill-Down: `src/shared/channel/portManager.ts` 为最高风险

### Node: Feature CodeMap Backlog

- Type: `capability`
- Status: `confirmed`
- Purpose: 待深度绘制 Feature CodeMap 的能力
- Backlog:
  - `Channel IPC 深度流`:
    - Why: 核心 IPC 层，含 Port 生命周期、超时、错误处理
    - Likely entry: `Channel.init()` → `PortManager` → `ChannelApiImpl`
    - Likely files: `src/shared/channel/*`, `src/__tests__/main/channel.test.ts`
    - Priority: high
  - `Service Registry 生命周期`:
    - Why: 声明式 RPC 的核心，含 Proxy 生成、同/跨进程路由
    - Likely entry: `defineApi()` → `implementService()` → Proxy handler
    - Likely files: `src/shared/serviceRegistry/*`, `src/shared/services/*`
    - Priority: high
  - `WebApp Service 深度流`:
    - Why: 独立窗口管理，双 View 布局 + per-view service + session 持久化
    - Likely entry: `webAppMainApi.createWebApp()` → `WebAppService` → `viewManager.createView()` × 2 + `view.attachTo()` + `implementService(WebAppWindowService)`
    - Likely files: `src/main/services/webAppService.ts`, `src/main/services/webAppWindowService.ts`, `src/renderer/components/WebCatalog/index.tsx`, `src/renderer/components/WebAppTitleBar/`
    - Priority: high
  - `i18n 初始化与切换流`:
    - Why: 跨进程 locale 管理，主进程初始化 + renderer 独立实例 + broadcast 切换
    - Likely entry: `I18nService.init()` → `i18nApi.getLocale()` → `initI18n()` → `setLocale()` → broadcast
    - Likely files: `src/main/services/i18nService.ts`, `src/renderer/i18n.ts`, `src/shared/i18n/`
    - Priority: medium
  - `Settings 全链路`:
    - Why: 全局配置读写 + runtime effects + 代理测试
    - Likely entry: `settingsService.init()` → `settingsApi.getSettings()` / `setSettings()` → `applyRuntimeEffects()`
    - Likely files: `src/main/services/settingsService.ts`, `src/shared/settings.ts`, `src/renderer/components/SettingsDialog/`
    - Priority: medium
  - `Service Timeout 机制`:
    - Why: @Timeout/@MethodTimeout 装饰器链、优先级策略、同/跨进程生效方式
    - Likely entry: `@Timeout()` → `serviceMetadataRegistry` → Proxy handler → `getEffectiveTimeout()`
    - Likely files: `src/shared/serviceRegistry/decorators.ts`, `src/shared/serviceRegistry/serviceMetadataRegistry.ts`, `src/shared/serviceRegistry/apiDefinitions.ts`
    - Priority: medium
  - `Window/View 管理模型`:
    - Why: 多窗口/视图架构，含生命周期、事件、channel 绑定
    - Likely entry: `createMainWindow()` → WindowManager + ViewManager
    - Likely files: `src/main/windowManager/*`, `src/main/viewManager/*`, `src/shared/window.ts`, `src/shared/view.ts`
    - Priority: medium
  - `日志系统`:
    - Why: 三进程统一日志，renderer 转发到 main
    - Likely entry: `logManager.initLog()` → `logger()` → `logSender`
    - Likely files: `src/shared/utils/log/*`
    - Priority: low

## 3. Compact Indexes

### Capability Index Table

| Capability | Main Modules | Entry | Feature CodeMap | Status |
| --- | --- | --- | --- | --- |
| Channel IPC | `src/shared/channel/` | `Channel.init()` | pending | confirmed |
| Service Registry | `src/shared/serviceRegistry/`, `src/shared/services/` | `defineApi()` + `implementService()` | pending | confirmed |
| Service Timeout | `src/shared/serviceRegistry/decorators.ts`, `serviceMetadataRegistry.ts` | `@Timeout()` / `@MethodTimeout()` | pending | confirmed |
| Window Management | `src/main/windowManager/` | `windowManager.createWindow()` | pending | confirmed |
| View Management | `src/main/viewManager/` | `viewManager.createView()` | pending | confirmed |
| WebApp Service | `src/shared/services/webAppApi.ts`, `src/main/services/webAppService.ts` | `webAppMainApi.createWebApp()` | pending | confirmed |
| WebApp Window | `src/shared/services/webAppWindowApi.ts`, `src/main/services/webAppWindowService.ts` | `WebAppWindowService` (per-view) | pending | confirmed |
| WebApp Titlebar | `src/renderer/components/WebAppTitleBar/`, `src/shared/titlebar.ts` | `webapp-titlebar.tsx` + `<WebAppTitleBar />` | pending | confirmed |
| Auto Update | `src/main/updater/`, `src/main/services/updaterService.ts` | `initUpdater()` | pending | confirmed |
| System Tray | `src/main/tray/` | `appTray.create()` | pending | confirmed |
| Unified Logging | `src/shared/utils/log/` | `logManager.initLog()` | pending | confirmed |
| Rust Native | `native/`, `src/main/nativeExample.ts` | `greet()` | pending | confirmed |
| Frontend UI | `src/renderer/` (React + Zustand + Tailwind) | `main.tsx` | pending | confirmed |
| Theme System | `src/shared/theme/`, `src/main/services/themeService.ts`, `src/renderer/components/ThemeToggle/` | `ThemeApi` (IPC) + `applyThemeToRoot()` | pending | confirmed |
| Preload Args | `src/shared/preload/args.ts` | `buildPreloadArgs()` / `parsePreloadArgs()` | pending | confirmed |
| Titlebar System | `src/main/mainWindow.ts`, `src/renderer/components/TitleBar/` | `getTitleBarOptions()` + `<TitleBar />` | pending | confirmed |
| i18n System | `src/shared/i18n/`, `src/main/services/i18nService.ts`, `src/renderer/i18n.ts` | `I18nService.init()` + `initI18n()` | pending | confirmed |
| Settings System | `src/shared/settings.ts`, `src/main/services/settingsService.ts`, `src/renderer/components/SettingsDialog/` | `settingsService.init()` + `settingsApi` | pending | confirmed |
| Favicon Service | `src/main/services/faviconService.ts`, `src/renderer/components/FaviconImg/` | `fetchFaviconDataUrl()` + `<FaviconImg>` | pending | confirmed |
| AppConfig | `src/main/services/appConfigService.ts` | `load()` / `save()` / `upsertApp()` | pending | confirmed |
| Shortcut | `src/main/services/shortcutService.ts` | `createShortcut()` | pending | confirmed |

### Module Index Table

| Module / Package | Path | Responsibility | Key Dependencies | Risk Notes |
| --- | --- | --- | --- | --- |
| main | `src/main/` | 主进程入口、窗口/视图管理、服务实现 (i18n/settings/theme/webApp/favicon/appConfig/shortcut/updater) | electron, electron-updater, native, i18next | 持有 native 资源；IPC handler 注册时序敏感 |
| preload | `src/preload/` | Channel 初始化（含 parsePreloadArgs）、contextBridge 暴露 electronEnv + channel API | electron (contextBridge) | 安全边界 |
| renderer | `src/renderer/` | React UI（TitleBar + WebCatalog + ThemeToggle + SettingsDialog + WebAppTitleBar + FaviconImg）、Zustand stores、i18n | react, zustand, tailwind, i18next | 多页构建 |
| shared | `src/shared/` | 跨进程共享：Channel、Service Registry、API 定义、i18n 类型/资源、Settings 类型、Theme、Preload Args、titlebar 常量 | (内部), i18next | 核心通信层 |
| shared/preload | `src/shared/preload/` | Preload 参数工具：build/parse 对称 API | (无) | 新增参数扩展 PRELOAD_ARGS |
| utils | `src/shared/utils/` | Singleton、日志、序列化、TypedEmitter、promise | electron-log | Singleton 进程限制 |
| native | `native/` | Rust @napi-rs 模块 | napi | 平台特定二进制 |
| __tests__ | `src/__tests__/` | Vitest 单元测试 + 集成测试 | vitest, jsdom, msw | 无 |
| e2e | `tests/e2e/` | Playwright E2E (app/theme/settings/webCatalog/webAppTitlebar) | @playwright/test | 依赖完整构建 |

### Cross-Module Flow Table

| Flow | Modules | Entry | Effect | Drill-Down |
| --- | --- | --- | --- | --- |
| IPC Channel Init | main → preload → renderer | `Channel.init()` + `parsePreloadArgs()` | 建立 MessagePort 双向通道 | `src/shared/channel/portManager.ts` |
| Service RPC (renderer→main) | renderer proxy → channel → main handler | `apiDefinitions.invokeRemote()` | 跨进程方法调用 | `src/shared/serviceRegistry/apiDefinitions.ts` |
| App Startup | main/index.ts Phase 1-4 | `registerMainServices()` → `themeService.init()` → `i18nService.init()` → `launchManagementWindow()` | IPC handler 先注册，再创建窗口 | `src/main/index.ts` |
| Window Create | main → windowManager → viewManager | `createMainWindow()` | 离屏 BaseWindow + backgroundColor + titleBarStyle + 50ms 居中 | `src/main/mainWindow.ts` |
| WebApp Create | renderer → channel → main → viewManager × 2 | `webAppMainApi.createWebApp()` | 双 View (titlebar + content)，per-view WebAppWindowService | `src/main/services/webAppService.ts` |
| i18n Init + Switch | main (i18nService) → IPC → renderer | `I18nService.init()` → `i18nApi.getLocale()` → `initI18n()` | 主进程 single source，renderer 独立实例，broadcast 切换 | `src/main/services/i18nService.ts` |
| Settings CRUD + Effects | renderer → IPC → main (settingsService) | `settingsApi.setSettings(patch)` | settings.json 持久化 + runtime effects (autoLaunch/userAgent/proxy) | `src/main/services/settingsService.ts` |
| WebApp Titlebar Nav | main (content view events) → IPC → renderer (titlebar view) | `did-navigate` → `viewManager.requestTo()` → `<NavRow>` | URL 实时同步 | `src/main/services/webAppWindowService.ts` |
| Service Timeout | decorator → metadataRegistry → Proxy handler | `@Timeout(500)` | Promise.race / channel timeout | `src/shared/serviceRegistry/decorators.ts` |
| Platform Titlebar | preload → renderer | `contextBridge` → `platform-${platform}` class | macOS traffic lights / Win 窗口控制预留 | `src/renderer/components/TitleBar/index.tsx` |

### Quick File Index

- `src/main/index.ts`: 主进程入口（Phase 1-5，registerMainServices 前置）
- `src/main/mainWindow.ts`: 主窗口创建
- `src/main/services/index.ts`: registerMainServices — 实现 updater/webApp/theme/i18n/settings
- `src/main/services/i18nService.ts`: 主进程 i18next 初始化 + locale 解析 + broadcast
- `src/main/services/settingsService.ts`: 全局 Settings 持久化 + runtime effects + proxy 测试
- `src/main/services/themeService.ts`: 主进程主题状态管理
- `src/main/services/webAppService.ts`: WebApp 主进程服务（双 View 布局 + session 持久化）
- `src/main/services/webAppWindowService.ts`: WebApp 窗口 per-view service（导航/URL/剪贴板）
- `src/main/services/appConfigService.ts`: Web App 列表持久化
- `src/main/services/faviconService.ts`: Favicon 异步获取 + 缓存
- `src/main/services/shortcutService.ts`: 桌面快捷方式创建
- `src/main/utils/paths.ts`: 路径管理（WEB_NEST_HOME 覆盖）
- `src/main/utils/debounce.ts`: 防抖工具
- `src/preload/index.ts`: preload 入口（contextBridge electronEnv + parsePreloadArgs → channel.init）
- `src/renderer/main.tsx`: renderer 主页入口（theme + i18n 初始化 + locale-changed listener）
- `src/renderer/webapp-titlebar.tsx`: WebApp 标题栏独立 renderer 入口
- `src/renderer/i18n.ts`: renderer i18next 初始化 + changeLocale
- `src/renderer/App.tsx`: 主页面布局（TitleBar + WebCatalog）
- `src/renderer/components/TitleBar/index.tsx`: 主窗口标题栏
- `src/renderer/components/WebAppTitleBar/index.tsx`: WebApp 双行标题栏（TitleRow + NavRow）
- `src/renderer/components/WebAppTitleBar/TitleRow.tsx`: 第 1 行 favicon + 标题 + ThemeToggle + 窗口控制
- `src/renderer/components/WebAppTitleBar/NavRow.tsx`: 第 2 行 导航按钮 + URL 展示
- `src/renderer/components/WebCatalog/index.tsx`: Web 目录 UI
- `src/renderer/components/ThemeToggle/index.tsx`: 主题切换按钮
- `src/renderer/components/SettingsDialog/index.tsx`: 设置对话框
- `src/renderer/components/FaviconImg/index.tsx`: Favicon 异步图片组件
- `src/renderer/stores/webAppStore.ts`: WebApp Zustand store
- `src/renderer/stores/faviconStore.ts`: Favicon 状态 store
- `src/shared/i18n/index.ts`: resources + normalizeLocale
- `src/shared/i18n/types.ts`: SupportedLocale / DEFAULT_LOCALE / SUPPORTED_LOCALES
- `src/shared/i18n/locales/en.json`: 英文翻译资源
- `src/shared/i18n/locales/zh-CN.json`: 中文翻译资源
- `src/shared/settings.ts`: AppSettings / DEFAULT_SETTINGS 类型
- `src/shared/titlebar.ts`: TITLE_BAR_HEIGHT / WEBAPP_TITLEBAR_HEIGHT / getTitleBarOptions()
- `src/shared/theme/index.ts`: applyThemeToRoot + themeTokensToCssVars
- `src/shared/theme/presets.ts`: lightTheme/darkTheme 色板常量
- `src/shared/services/index.ts`: 所有 API 导出桶
- `src/shared/services/i18nApi.ts`: I18nApi IPC 接口
- `src/shared/services/settingsApi.ts`: SettingsApi IPC 接口 + ProxyTestConfig/Result
- `src/shared/services/webAppWindowApi.ts`: WebAppWindowApi (NavigationState + 导航/URL 方法)
- `src/shared/channel/index.ts`: Channel 核心实现
- `src/shared/channel/impl.ts`: ChannelApiImpl 消息收发
- `src/shared/channel/portManager.ts`: MessagePort 管理 (高风险)
- `src/shared/preload/args.ts`: Preload 参数 build/parse 对称 API + PRELOAD_ARGS 常量
- `src/shared/serviceRegistry/index.ts`: ServiceRegistry 实现
- `src/shared/serviceRegistry/apiDefinitions.ts`: Proxy 生成 + 远程调用
- `src/shared/utils/singleton.ts`: Singleton 装饰器
- `src/shared/utils/serialize/index.ts`: 序列化/反序列化
- `src/shared/utils/log/index.ts`: 统一日志
- `src/global.d.ts`: `__SOURCE_FILE__` + `ElectronEnv` + `Window.electronEnv` 类型声明
- `src/vitePlugins/sourceFilePlugin.ts`: Vite __SOURCE_FILE__ 注入插件
- `vitest.config.mts`: 三环境测试配置
- `src/__tests__/infrastructure/mocks/electron.ts`: Electron mock

## 4. Maintenance Notes

- Refresh this Project CodeMap when module boundaries, entry types, external dependencies, or validation commands change.
- Do not refresh the whole map for a narrow feature edit; update the relevant Feature CodeMap instead.
- Last terrain change: i18n + Settings + WebApp Titlebar + Favicon + AppConfig + Shortcut + 启动时序修复 (2026-06-11)
