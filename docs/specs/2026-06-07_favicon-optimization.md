# Feature Spec: Favicon 异步化 + 全局管理服务 + 专用组件

> **Phase**: Review ✅ Done
> **Created**: 2026-06-07
> **Status**: Active

---

## 背景

当前 favicon 获取是**同步阻塞式**：`listWebApps` / `openWebApp` / `createWebApp` 全部 `await fetchFaviconDataUrl()` 后才返回 IPC 响应。Google favicon 服务 (`google.com/s2/favicons`) 在国内不可达，导致每个未缓存 app 阻塞 30-120 秒。

## Goal

1. **优化速度**：IPC 不等 favicon 网络请求，立即返回缓存值；未缓存的由 Renderer 主动轮询获取
2. **全局 favicon 管理服务**：Renderer 侧 zustand store 管理所有 favicon 状态（loading / loaded），轮询 `getFavicon(appId)` IPC
3. **专用 FaviconImg 组件**：统一渲染——默认显示转圈动画，获取到内容后显示 favicon 图片
4. **Main 进程 5s 超时**：`net.fetch` 加 `AbortSignal.timeout(5000)`，避免无限等待

## Target State

### 主进程（非阻塞化）

- `faviconService.ts`：`net.fetch` 加 5s 超时
- `webAppService.ts`：
  - `listWebApps`：用 `getCachedFaviconDataUrlSync` 读缓存（<1ms），不等网络；未缓存的触发 `fetchFaviconDataUrl` 异步获取
  - `createWebApp` / `openWebApp` / `updateWebApp`：同理，同步缓存 + 异步触发
  - 新增 `getFavicon(id): Promise<string>`：返回缓存值（空串=未就绪），触发异步获取供下次轮询
- **页面真实 favicon 更新缓存**：`createWindowForApp` 中监听 content view 的 `page-favicon-updated` 事件，获取页面真实 favicon URL → 调用 `fetchFaviconDataUrl` 下载并缓存 → 下次轮询即命中
  - 优于 Google favicon 服务（国内不可达）
  - 与 Google fallback 并行：先尝试 Google，页面加载后用真实 favicon 覆盖

### Renderer（轮询 + 组件）

- **`faviconStore.ts`**（新建）：zustand store
  - `favicons: Record<string, { status: 'loading'|'loaded', dataUrl?: string }>`
  - `requestFavicon(appId)`：立即 IPC 获取，未命中则加入轮询队列
  - 全局 2s 轮询：遍历 loading 状态的 appId，调用 `getFavicon` IPC
  - 所有 loading 完成后自动停止轮询
- **`FaviconImg/index.tsx`**（新建）：专用组件
  - `appId` 模式（catalog）：走 store 轮询
  - `faviconDataUrl` 模式（titlebar）：直接渲染（titlebar 已有 `url-changed` 推送）
  - 两种状态：loading → spinner 动画；loaded → `<img>`
- **消费方替换**：
  - `WebCatalog AppCard`：替换内联 favicon 为 `<FaviconImg appId={app.id} fallback={app.title} />`
  - `TitleRow`：替换为 `<FaviconImg faviconDataUrl={faviconDataUrl} />`

---

## MCU Breakdown

### MCU-1: 主进程非阻塞化 + getFavicon API + 超时 + 页面真实 favicon

**改动文件**：
- `src/main/services/faviconService.ts` — `net.fetch` 加 `AbortSignal.timeout(5000)`
- `src/shared/services/webAppApi.ts` — 新增 `getFavicon(id: string): Promise<string>`
- `src/main/services/webAppService.ts` —
  - 实现 `getFavicon`；`listWebApps` / `createWebApp` / `openWebApp` / `updateWebApp` 改为同步缓存 + 异步触发
  - `createWindowForApp` 新增 `page-favicon-updated` 监听：获取页面真实 favicon URL → 下载缓存 → 覆盖 Google fallback

**验证**：主窗口启动不再卡顿；页面加载后 favicon 缓存自动更新

### MCU-2: faviconStore + FaviconImg 组件

**新建文件**：
- `src/renderer/stores/faviconStore.ts` — zustand store + 2s 轮询
- `src/renderer/components/FaviconImg/index.tsx` — spinner / image 两种状态

**验证**：store 能通过轮询获取 favicon 并更新状态

### MCU-3: 替换消费方

**改动文件**：
- `src/renderer/components/WebCatalog/index.tsx` — AppCard favicon 区域
- `src/renderer/components/WebAppTitleBar/TitleRow.tsx` — 标题栏 favicon 区域

**验证**：卡片先显示 spinner，缓存命中时立即显示 favicon，未缓存时 2-5s 内异步更新

---

## Out of Scope

- 不做主进程推送（`viewManager.requestTo`）—— 改为 Renderer 主动轮询
- 不做 `url` 到 favicon 的通用解析（如爬 HTML `<link rel="icon">`）
- 不做 favicon 持久缓存淘汰策略
- 不改 titlebar 的 `url-changed` 推送机制（仅替换展示组件）
- 不做跨窗口 store 共享（主窗口和 titlebar 是独立 webContents）
- 不做 favicon 备用源（如 `favicon.im`）—— 仅加超时

## Risks

1. **首次无缓存时全部 spinner**：`listWebApps` 仍返回磁盘缓存（读文件 <1ms），仅全新 app 走异步
2. **轮询开销**：N 个 app × 2s 一次 IPC，N < 20 时可忽略
3. **Google favicon 仍不可达**：超时只解决"卡住"，不解决"拿不到"；后续可加备用源

## Validation

- `pnpm run typecheck` 通过
- `pnpm run lint` 通过
- `pnpm run test` 140+ tests 通过
- `pnpm run build` 通过
- 手动验证：添加全新 app → 卡片立即出现 + spinner → 2-5s 内 favicon 更新
- 手动验证：已有缓存 app → 卡片立即显示 favicon（无 spinner 闪烁）

---

## E2E Tests

基于现有 `tests/e2e/` 模式（Playwright + Electron），在 `webCatalog.spec.ts` 和 `webAppTitlebar.spec.ts` 中新增/调整用例。

### FaviconImg 组件 data-testid 约定

组件内部设置：
- `data-testid="favicon-spinner"` — 转圈状态
- `data-testid="favicon-image"` — 图片已加载
- `data-testid="favicon-fallback"` — 首字母 fallback

### 新增/调整用例

#### webCatalog.spec.ts

| 用例 | 验证点 |
|---|---|
| `favicon shows spinner for uncached app` | 创建 `about:blank` app → 卡片出现后立即可见 spinner（`favicon-spinner`） |
| `favicon shows image when cached` | 预写 favicon 缓存文件到临时 `WEB_NEST_HOME` → 启动 app → 卡片直接显示 `favicon-image`（无 spinner 闪烁） |
| `favicon transitions from spinner to image` | mock 一个可解析的 favicon URL → 创建 app → spinner 可见 → 等待轮询 → 变为 `favicon-image` |

#### webAppTitlebar.spec.ts

| 用例 | 验证点 |
|---|---|
| `titlebar shows favicon via FaviconImg` | 打开 web app → titlebar 中 `favicon-image` 或 `favicon-spinner` 可见 |

### 现有用例适配

现有 `'favicon shows in card'` 用例需更新选择器：
- 旧：`webapp-favicon` / `webapp-favicon-fallback`
- 新：`favicon-image` / `favicon-spinner` / `favicon-fallback`

### 预写缓存 fixture 示例

```typescript
// 在临时 WEB_NEST_HOME/.cache/favicons/{appId}.txt 预写 data URL
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-nest-e2e-'));
const cacheDir = path.join(tmpDir, '.cache', 'favicons');
fs.mkdirSync(cacheDir, { recursive: true });
// 写入一个 1x1 PNG data URL 作为已知缓存
fs.writeFileSync(
  path.join(cacheDir, 'webapp-test-id.txt'),
  'data:image/png;base64,...'
);
// 写入 apps.config 引用该 appId
```

---

## 3. Plan（原子 Checklist）

### File Changes & Signatures

| # | File | Change | Signatures |
|---|---|---|---|
| 1 | `src/main/services/faviconService.ts` | `net.fetch` 加 5s 超时 | `fetchFaviconDataUrl(appId, faviconUrl): Promise<string>` — 增加 `signal: AbortSignal.timeout(5000)` |
| 2 | `src/shared/services/webAppApi.ts` | 新增 API 方法 | `abstract getFavicon(id: string): Promise<string>` |
| 3 | `src/main/services/webAppService.ts` | 实现 `getFavicon`；4 个方法改为非阻塞 | `getFavicon(id): Promise<string>` 返回缓存值或空串，触发异步获取 |
| 4 | `src/main/services/webAppService.ts` | `createWindowForApp` 监听 `page-favicon-updated` | content view `webContents.on('page-favicon-updated', ...)` → 获取真实 favicon URL → `fetchFaviconDataUrl` → 更新 titlebar + 窗口图标 |
| 5 | `src/renderer/stores/faviconStore.ts` | **新建** zustand store | `requestFavicon(appId): void`, `setLoaded(appId, dataUrl): void`, `dispose(): void`, 2s 轮询逻辑 |
| 6 | `src/renderer/components/FaviconImg/index.tsx` | **新建** 专用组件 | `FaviconImg({ appId?, faviconDataUrl?, fallback? })` — `data-testid: favicon-spinner / favicon-image / favicon-fallback` |
| 7 | `src/renderer/components/WebCatalog/index.tsx` | AppCard 替换为 FaviconImg | `<FaviconImg appId={app.id} fallback={app.title} />` |
| 8 | `src/renderer/components/WebAppTitleBar/TitleRow.tsx` | TitleRow 替换为 FaviconImg | `<FaviconImg faviconDataUrl={faviconDataUrl} />` |

### Implementation Checklist

#### MCU-1: 主进程非阻塞化

- [x] 1.1 `faviconService.ts` — `net.fetch` 添加 `signal: AbortSignal.timeout(5000)`
- [x] 1.2 `webAppApi.ts` — `WebAppMainApi` 新增 `abstract getFavicon(id: string): Promise<string>`
- [x] 1.3 `webAppService.ts` — 实现 `getFavicon(id)`：`getCachedFaviconDataUrlSync` 读缓存返回，未命中返回空串；同时 `fetchFaviconDataUrl(appId, faviconUrl)` 异步触发（fire-and-forget，需从 persisted config 读取 `faviconUrl`）
- [x] 1.4 `webAppService.ts` — `listWebApps()`：每个 app 用 `getCachedFaviconDataUrlSync(app.id)` 替代 `await fetchFaviconDataUrl()`；未缓存的 fire-and-forget `fetchFaviconDataUrl()`
- [x] 1.5 `webAppService.ts` — `createWebApp(url)`：先 `getCachedFaviconDataUrlSync` 生成结果返回（新 app 无缓存所以为 undefined），fire-and-forget `fetchFaviconDataUrl`
- [x] 1.6 `webAppService.ts` — `openWebApp(id)`：同上模式
- [x] 1.7 `webAppService.ts` — `updateWebApp(id, data)`：同上模式
- [x] 1.8 `webAppService.ts` — `createWindowForApp`：content view 添加 `webContents.on('page-favicon-updated', (event, urls) => { ... })`，用 `urls[0]` 调用 `fetchFaviconDataUrl(appId, urls[0])` → 更新缓存 → 更新 titlebar 图标 + 窗口图标

#### MCU-2: faviconStore + FaviconImg

- [x] 2.1 新建 `src/renderer/stores/faviconStore.ts`
  - State: `favicons: Record<string, { status: 'loading' | 'loaded'; dataUrl?: string }>`
  - `requestFavicon(appId)`: IPC `getFavicon(appId)`，命中 → `setLoaded`；未命中 → 加入 loading 队列
  - 轮询：`setInterval(2000)` 遍历 loading 条目调 `getFavicon`，全部 loaded 后 `clearInterval`
  - `dispose()`: 清理定时器
- [x] 2.2 新建 `src/renderer/components/FaviconImg/index.tsx`
  - Props: `appId?: string; faviconDataUrl?: string; fallback?: string`
  - `appId` 模式（catalog）：mount 时 `requestFavicon(appId)`，订阅 store 状态渲染
  - `faviconDataUrl` 模式（titlebar）：直接渲染，不走 store
  - 三种渲染状态：`favicon-spinner`（CSS 旋转动画）/ `favicon-image`（`<img>`）/ `favicon-fallback`（首字母）

#### MCU-3: 替换消费方

- [x] 3.1 `WebCatalog/index.tsx` — AppCard 替换内联 favicon 为 `<FaviconImg appId={app.id} fallback={app.title} />`，移除 AppCard props 中 `faviconDataUrl` 的内联判断逻辑
- [x] 3.2 `WebAppTitleBar/TitleRow.tsx` — 替换内联 favicon 为 `<FaviconImg faviconDataUrl={faviconDataUrl} />`

#### 验证

- [x] V1 `pnpm run typecheck` 通过
- [x] V2 `pnpm run lint` 通过
- [x] V3 `pnpm run test` 140+ tests 通过
- [x] V4 `pnpm run build` 通过
- [x] V5 E2E 测试选择器适配（现有 `webapp-favicon` / `webapp-favicon-fallback` → `favicon-image` / `favicon-spinner` / `favicon-fallback`）

### Constraints

- **ZERO DEVIATION**：按 checklist 顺序执行，每项完成后立即持久化
- 偏差处理：执行中遇到 Spec 未覆盖的问题 → STOP → 记录 → 回到 Plan 修正
- `WebAppState.faviconDataUrl` 字段保留，由 sync cache 填充（已有缓存时仍直接可用）

---

## 6. Review Verdict

**Overall**: ✅ PASS | **Date**: 2026-06-07

| Axis | Verdict | Notes |
|---|---|---|
| Requirement Completion | ✅ PASS | 全部 4 个 Goal 达成 |
| Spec-Code Fidelity | ✅ PASS | 零偏差 |
| Code Quality | ✅ PASS | 无高风险项 |

**Plan-Execution Diff**: 无。

**验证证据**: typecheck ✅ | lint ✅ | 140 tests ✅ | build ✅
