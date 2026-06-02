# Spec: Web App 自定义双行标题栏

Created: 2026-06-02
Status: **DONE** — 全部 MCU 完成，19/19 E2E 通过，review 修复已落地

## 1. 目标

为 Web App 独立窗口添加自定义双行标题栏，替代原生窗口框架。

```
┌──────────────────────────────────────────────────────────────────┐
│ Row 1: [AppIcon][PageIcon][PageTitle]  ←拖拽区→  [Theme][×─□]  │  35px
│ Row 2: [←][→][⟳][🔗] https://example.com/path                   │  35px
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     外部 URL 内容页面                             │
│                     (WebContentsView)                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- **第 1 行**（标题栏）：应用 favicon + 页面 favicon + 页面标题 + 拖拽区 + 主题切换 + 窗口控制安全区
- **第 2 行**（导航栏）：后退 + 前进 + 刷新 + 复制 URL + URL 只读展示

### 不做的事

1. 不改主窗口（管理页）的 TitleBar
2. 不改 WebCatalog 组件
3. 不改 viewManager / windowManager 基础设施
4. 不新开 preload 文件，复用全局 `src/preload/index.ts`
5. 不做地址栏可编辑导航（只展示 + 复制）
6. 不做书签/历史等扩展功能

## 2. 架构方案

### 双 View 架构

在同一个 `BaseWindow` 中放置两个 `WebContentsView`：

```
BaseWindow (titleBarStyle: 'hidden')
  ├── WebContentsView #1: 标题栏 renderer（本地 HTML，70px 高）
  └── WebContentsView #2: 外部 URL 内容（剩余空间）
```

**关键决策**：

| 决策点 | 方案 | 理由 |
|---|---|---|
| 标题栏实现 | 本地 renderer view | 与主窗口架构一致，进程隔离，可跨平台 |
| Preload | 复用同一个 `src/preload/index.ts` | 统一 preload 文件，通过 `channelExpose` 区分行为 |
| 构建产物 | 现有 renderer Vite 配置新增 HTML 入口（multi-page） | 共享组件/主题/Tailwind，一份配置 |
| 导航 IPC | 新增 `WebAppWindowService`（per-view instance） + `WebAppWindowApi` | 类型安全，遵循 ServiceRegistry 模式 |
| Service 注册 | 标题栏 channel 上注册全部 service | 标题栏 renderer 需要 themeApi + webAppWindowApi |

### Preload 通道区分

| View | additionalArguments | channelExpose | 行为 |
|---|---|---|---|
| 标题栏 view | `buildPreloadArgs({ channelExpose: true })` | `true` | 有 IPC 能力，可调用 ServiceRegistry API |
| 外部 URL view | `buildPreloadArgs({ channelExpose: false })` | `false` | preload 运行，不暴露 IPC（与现有逻辑相同） |

### 关系映射

主进程在 `WebAppEntry` 中维护完整关系：

```typescript
interface WebAppEntry {
  appId: string;
  windowId: string;
  viewId: string;         // 外部 URL 内容 view
  titlebarViewId: string; // 标题栏 renderer view（新增）
  url: string;
  title: string;
  faviconUrl: string;
  isClosing?: boolean;
}
```

**标题栏 renderer 不需要知道自己的 appId**。

每个标题栏 view 有独立的 channel。`WebAppWindowService` 是 per-view instance（构造时捕获 content view 引用）。标题栏 renderer 调用 API 时，请求经 channel 路由到对应的 service instance。

```
标题栏 renderer: webAppWindowApi.navigateBack()
  → channel.request('WebAppWindowApi:navigateBack', [])
  → preload MessagePort → 主进程
  → 该 titlebarChannel 上注册的 handler
  → WebAppWindowService.navigateBack()
  → this.contentView.webContents.goBack()
```

### Service 注册策略

标题栏 renderer 需要访问**全部 service**（`themeApi` 切主题、`webAppWindowApi` 导航等）。

当前 `registerMainServices()` 只在主窗口 channel 上注册 service。标题栏 view 有独立的 channel，需要把所有 service 都注册到标题栏 channel 上：

```typescript
// webAppService.ts — createWindowForApp() 中

// 标题栏 channel 上注册全部 service（与 registerMainServices() 一致）
// per-view 的 windowService 是新 instance，其余是同一个单例
serviceRegistry.implementService(
  titlebarChannel,
  themeService,    // 单例 — 标题栏可切主题
  webAppService,   // 单例 — 可选，预留
  windowService,   // per-view instance — 导航/URL/剪贴板
);
```

`implementService` 对同一单例多次注册时：
- `serviceImplementations` Map 被覆盖 → WeakRef 指向同一个单例，无影响
- 每个 channel 独立注册 handler → 标题栏请求路由到正确的 channel handler

### URL 实时同步

```
外部 URL view 导航
  → webContents 'did-navigate' / 'did-navigate-in-page' 事件
  → webAppService 通过 viewManager.requestTo(titlebarViewId, 'url-changed', payload)
  → 标题栏 renderer channel.onRequest('url-changed') 接收更新
```

## 3. 文件变更清单

### 新增文件

| 文件 | 用途 |
|---|---|
| `src/shared/services/webAppWindowApi.ts` | API 抽象类 + renderer 侧 proxy |
| `src/main/services/webAppWindowService.ts` | per-view service 实现（导航、URL、剪贴板） |
| `src/renderer/webapp-titlebar.html` | 标题栏 renderer HTML 入口 |
| `src/renderer/webapp-titlebar.tsx` | 标题栏 renderer React 入口 |
| `src/renderer/components/WebAppTitleBar/index.tsx` | 标题栏主组件（双行布局） |
| `src/renderer/components/WebAppTitleBar/TitleRow.tsx` | 第 1 行 |
| `src/renderer/components/WebAppTitleBar/NavRow.tsx` | 第 2 行 |
| `src/renderer/styles/webapp-titlebar.css` | 标题栏专用样式 |
| `tests/e2e/fixtures/pages/page-a.html` | E2E 本地测试页面 A（含跳转链接到 B） |
| `tests/e2e/fixtures/pages/page-b.html` | E2E 本地测试页面 B（含跳转链接到 A） |
| `tests/e2e/webAppTitlebar.spec.ts` | 标题栏 E2E 测试 |

### 修改文件

| 文件 | 变更 |
|---|---|
| `src/main/services/webAppService.ts` | `createWindowForApp()` 启用 `titleBarStyle: 'hidden'`，创建标题栏 view，注册全部 service 到标题栏 channel，调整布局，销毁时清理 |
| `src/main/mainWindow.ts` | `TITLE_BAR_HEIGHT` + `getTitleBarOptions()` 抽到 shared |
| `vite.config.renderer.mts` | 新增 `webapp-titlebar.html` multi-page 入口 |
| `src/main/utils/paths.ts` | 新增 `getWebAppTitlebarPath()` / `getWebAppTitlebarDevUrl()` |

## 4. API 设计

### WebAppWindowApi（新增）

```typescript
// src/shared/services/webAppWindowApi.ts

import { serviceRegistry } from '@/shared/serviceRegistry';

export interface NavigationState {
  url: string;
  title: string;
  faviconDataUrl?: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export abstract class WebAppWindowApi {
  static apiName = 'WebAppWindowApi';

  /** 获取当前导航状态 */
  abstract getNavState(): Promise<NavigationState>;
  /** 导航后退 */
  abstract navigateBack(): Promise<void>;
  /** 导航前进 */
  abstract navigateForward(): Promise<void>;
  /** 刷新页面 */
  abstract reload(): Promise<void>;
  /** 复制当前 URL 到剪贴板 */
  abstract copyUrl(): Promise<void>;
}

export const webAppWindowApi = serviceRegistry.defineApi(WebAppWindowApi, 'renderer');
```

### WebAppWindowService（per-view，非单例）

```typescript
// src/main/services/webAppWindowService.ts

import { clipboard } from 'electron';
import { WebAppWindowApi, type NavigationState } from '@/shared/services/webAppWindowApi';
import type { ManagedView } from '@/main/viewManager/managedView';

interface WebAppWindowContext {
  contentView: ManagedView;
  faviconDataUrl?: string;
}

export class WebAppWindowService extends WebAppWindowApi {
  private context: WebAppWindowContext;

  constructor(context: WebAppWindowContext) {
    super();
    this.context = context;
  }

  async getNavState(): Promise<NavigationState> {
    const wc = this.context.contentView.webContents;
    return {
      url: wc.getURL(),
      title: wc.getTitle(),
      faviconDataUrl: this.context.faviconDataUrl,
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward(),
    };
  }

  async navigateBack(): Promise<void> {
    this.context.contentView.webContents.goBack();
  }

  async navigateForward(): Promise<void> {
    this.context.contentView.webContents.goForward();
  }

  async reload(): Promise<void> {
    this.context.contentView.webContents.reload();
  }

  async copyUrl(): Promise<void> {
    clipboard.writeText(this.context.contentView.webContents.getURL());
  }

  updateFaviconDataUrl(dataUrl: string): void {
    this.context.faviconDataUrl = dataUrl;
  }
}
```

### 注册方式

在 `webAppService.ts` 的 `createWindowForApp()` 中：

```typescript
import { themeService } from './themeService';
// ...

// 1. 创建 content view（同现有逻辑）
const contentViewId = await viewManager.createView({ ... });
const contentView = viewManager.getView(contentViewId)!;

// 2. 创建标题栏 view
const titlebarViewId = await viewManager.createView({
  url: isDev()
    ? 'http://localhost:5173/webapp-titlebar.html'
    : pathToFileURL(paths.getWebAppTitlebarPath()).href,
  type: 'embedded',
  preload: paths.getPreloadPath(),
  additionalArguments: buildPreloadArgs({ channelExpose: true }),
});
const titlebarView = viewManager.getView(titlebarViewId)!;

// 3. 创建 per-view service
const windowService = new WebAppWindowService({ contentView, faviconDataUrl });

// 4. 注册全部 service 到标题栏 channel
const titlebarChannel = titlebarView.channel;
serviceRegistry.implementService(titlebarChannel, themeService, webAppService, windowService);

// 5. 布局：标题栏 70px，内容区剩余
titlebarView.attachTo(nativeWindow, { x: 0, y: 0, width: contentBounds.width, height: WEBAPP_TITLEBAR_HEIGHT });
contentView.attachTo(nativeWindow, { x: 0, y: WEBAPP_TITLEBAR_HEIGHT, width: contentBounds.width, height: contentBounds.height - WEBAPP_TITLEBAR_HEIGHT });
```

### 标题栏 renderer 侧

```typescript
// src/renderer/webapp-titlebar.tsx
import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { webAppWindowApi } from '@/shared/services/webAppWindowApi';
import { themeApi } from '@/shared/services';

serviceRegistry.setDefaultChannel(channel);

// 在 React 组件中直接调用全部已注册的 API：
const state = await webAppWindowApi.getNavState();
await webAppWindowApi.navigateBack();
await themeApi.setTheme('dark');
```

### 主进程 → 标题栏 push（URL 变化通知）

```typescript
// webAppService.ts — 在 createWindowForApp() 中

contentView.webContents.on('did-navigate', () => {
  const wc = contentView.webContents;
  viewManager.requestTo(titlebarViewId, 'url-changed', {
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  });
});

contentView.webContents.on('did-navigate-in-page', () => {
  // 同上，SPA 内路由变化
});
```

```typescript
// 标题栏 renderer:
channel.onRequest('url-changed', (payload: NavigationState) => {
  // 更新 React state
  return true; // ack
});
```

## 5. MCU 切分

### MCU-0: 构建基础设施 + 共享常量

**目标**：renderer 支持 multi-page 构建，共享常量就位。

变更：
1. 新建 `src/shared/titlebar.ts` — `TITLE_BAR_HEIGHT` + `WEBAPP_TITLEBAR_HEIGHT` + `getTitleBarOptions()` 从 `mainWindow.ts` 抽出
2. 新建 `src/renderer/webapp-titlebar.html`（空壳 HTML + CSP）
3. 新建 `src/renderer/webapp-titlebar.tsx`（最小 React 入口，渲染 placeholder）
4. `vite.config.renderer.mts` → `build.rollupOptions.input` 添加 webapp-titlebar 入口
5. `src/main/utils/paths.ts` → 新增 `getWebAppTitlebarPath()` / `getWebAppTitlebarDevUrl()`
6. `src/main/mainWindow.ts` → import 从 shared/titlebar

**验证**：
- `pnpm run typecheck` 通过
- `pnpm run build` 成功生成 `dist/renderer/webapp-titlebar.html`
- 主窗口行为不变，现有 E2E 不退化

---

### MCU-1: Web App 窗口启用双 View 布局

**目标**：打开 Web App 时，窗口顶部出现标题栏区域，内容被推到下方。

变更：
1. `webAppService.ts` → `createWindowForApp()` 设置 `titleBarStyle: 'hidden'`
2. 创建标题栏 view：加载 webapp-titlebar HTML，preload 传 `channelExpose: true`
3. 内容 view 的 bounds 从 `y: 0` 改为 `y: WEBAPP_TITLEBAR_HEIGHT`
4. 窗口 resize 时同时调整两个 view 的 bounds
5. `nativeWindow.on('closed')` 中也销毁标题栏 view
6. `WebAppEntry` 新增 `titlebarViewId` 字段

**验证**：
- E2E：打开 Web App → 标题栏 view 存在（`electronApp.windows()` 中可找到）
- E2E：关闭窗口 → 无 stale view，现有测试不退化
- `pnpm run test` 通过

---

### MCU-2: WebAppWindowService + 全部 service 注册 + 第 1 行 UI

**目标**：新增 service + API，标题栏 channel 注册全部 service，第 1 行显示信息 + 主题切换 + 拖拽移动。

变更：
1. `src/shared/services/webAppWindowApi.ts` — API 抽象类 + renderer proxy
2. `src/main/services/webAppWindowService.ts` — per-view service 实现
3. `webAppService.ts` → 创建 `WebAppWindowService` 实例，`serviceRegistry.implementService(titlebarChannel, themeService, webAppService, windowService)`
4. `src/renderer/components/WebAppTitleBar/TitleRow.tsx` — 第 1 行组件
5. `src/renderer/styles/webapp-titlebar.css` — drag + 平台安全区
6. `webapp-titlebar.tsx` → 初始化 channel + 主题 + `serviceRegistry.setDefaultChannel(channel)`

**验证**：
- E2E：标题栏第 1 行显示 favicon + 标题
- E2E：标题栏主题切换按钮可点击，点击后标题栏背景色变化
- 手动验证：拖拽空白区域可移动窗口（Playwright 难以模拟原生拖拽）
- 手动验证：macOS traffic lights / Win 窗口控制安全区正确

---

### MCU-3: 标题栏第 2 行 UI + URL 实时同步 + E2E 测试

**目标**：导航栏完整可用 + URL 实时推送 + E2E 测试覆盖。

变更：
1. `src/renderer/components/WebAppTitleBar/NavRow.tsx` — 第 2 行组件
2. `webAppService.ts` → 监听 content view 的 `did-navigate` / `did-navigate-in-page`，通过 `viewManager.requestTo()` push URL 变化
3. `webapp-titlebar.tsx` → 注册 `channel.onRequest('url-changed')` 接收推送
4. 复制使用 `WebAppWindowService.copyUrl()` → Electron `clipboard.writeText()`
5. 新增本地 E2E 测试页面 + 标题栏 E2E 测试文件

**验证**：
- E2E：导航后退/前进按钮可用，canGoBack/canGoForward 状态正确
- E2E：刷新按钮重新加载页面
- E2E：URL 展示随页面导航实时更新
- E2E：复制按钮将 URL 写入系统剪贴板
- `pnpm run typecheck` + `pnpm run test` 通过

## 6. E2E 测试设计

### 本地测试页面

E2E 使用本地静态 HTML 页面（`file://`），无外部网络依赖，稳定快速：

```
tests/e2e/fixtures/pages/
  ├── page-a.html  — 标题 "Page A"，包含 <a href="page-b.html">Go to B</a>
  └── page-b.html  — 标题 "Page B"，包含 <a href="page-a.html">Go to A</a>
```

标题栏 E2E 使用 `page-a.html` 的绝对路径作为 web app URL，通过点击页面内链接触发导航，验证后退/前进/URL 更新。

### 标题栏 E2E 测试用例

`tests/e2e/webAppTitlebar.spec.ts`：

| 测试 | 方法 | 断言 |
|---|---|---|
| 标题栏双行渲染 | 创建 web app → 找到标题栏 page | `[data-testid="titlebar-row-1"]` 和 `[data-testid="titlebar-row-2"]` 可见 |
| 标题栏显示页面标题 | 创建 web app（page-a.html） | `[data-testid="titlebar-title"]` 包含 "Page A" |
| 主题切换 | 点击标题栏主题按钮 | 标题栏背景色/图标变化 |
| URL 展示 | 创建 web app | `[data-testid="titlebar-url"]` 显示 `page-a.html` 的完整路径 |
| 导航后退/前进 | 内容页面点击链接跳 B → 点后退按钮 | URL 变回 page-a，后退按钮 disabled，前进按钮 enabled |
| 刷新 | 点刷新按钮 | 页面重载（可以检测页面元素闪烁或重置状态） |
| 复制 URL | 点复制按钮 | `electronApp.evaluate(() => clipboard.readText())` 验证剪贴板内容 |

### Playwright 访问标题栏 view

标题栏是 BaseWindow 中的 WebContentsView。Playwright 通过 `electronApp.windows()` 获取所有窗口，每个窗口的 pages 包含该窗口下的所有 WebContentsView。标题栏 view 的 `data-testid` 用于定位。

```typescript
// 找到包含标题栏的 page
const appWindow = electronApp.windows().find(w =>
  w.locator('[data-testid="webapp-titlebar"]').count() > 0
);
```

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Multi-page Vite 构建配置不兼容现有插件 | 低 | 中 | MCU-0 先验证构建通过 |
| `implementService` 多次注册同名单例时 `serviceImplementations` Map 覆盖 | 低 | 低 | WeakRef 指向同一个单例，无影响；per-view handler 在各自 channel 上独立 |
| 标题栏 channel push（main→renderer request）可能超时 | 中 | 低 | 标题栏 handler 同步返回 ack，设短超时 |
| 双 View 布局在 macOS traffic lights 区域可能遮挡 | 中 | 中 | MCU-2 中验证 macOS 平台安全区 |
| WebContents `canGoBack()` 在初始页面可能不准确 | 低 | 低 | 用 `did-navigate` 事件计数判断 |
| Playwright 难以区分同一 BaseWindow 下的多个 WebContentsView | 中 | 中 | 利用 `data-testid` 定位，先验证 Playwright 能枚举所有 page |

## 8. 验证清单

### 自动化（每个 MCU 必须）

- [ ] `pnpm run typecheck` — 零错误
- [ ] `pnpm run lint` — 零错误
- [ ] `pnpm run test` — 所有现有测试通过 + 新增测试
- [ ] `pnpm run build` — 生产构建成功，含 `webapp-titlebar.html`

### E2E 覆盖

- [ ] 标题栏双行渲染（row-1 + row-2 可见）
- [ ] 标题栏显示 favicon + 页面标题
- [ ] 主题切换影响标题栏背景色
- [ ] 导航后退/前进按钮状态和功能正确
- [ ] 刷新按钮重新加载页面
- [ ] URL 展示随导航实时更新
- [ ] 复制按钮写入系统剪贴板
- [ ] 现有 E2E（12 tests）不退化

### 仅手动验证

- [ ] 拖拽标题栏空白区域可移动窗口（Playwright 无法模拟原生拖拽）
- [ ] macOS traffic lights / Windows 窗口控制安全区不被遮挡
