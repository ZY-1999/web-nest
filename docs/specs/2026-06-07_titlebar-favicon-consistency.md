# Feature Spec: 独立页面标题栏 Favicon 行为与主页面一致

> **Phase**: Review ✅ Done
> **Created**: 2026-06-07
> **Status**: Active
> **Parent Spec**: [[2026-06-07_favicon-optimization]]

---

## 背景

主页面 `WebCatalog` 的应用卡片使用 `<FaviconImg appId={app.id} fallback={app.title} />`，有完整的 Spinner → Fallback → Image 三态渲染。独立页面标题栏 `TitleRow` 使用 `<FaviconImg faviconDataUrl={faviconDataUrl} />`（直接模式），无 Spinner、无 Fallback，favicon 未到达前标题栏图标区域为空白。

用户要求：**独立页面图标行为应与主页面应用图标保持一致**。

## Goal

标题栏 favicon 在加载中显示 Spinner，无 favicon 时显示首字母 Fallback，加载完成后显示 Image——与主页面行为完全一致。

## Target State

### 行为一致

- **Loading**: 标题栏 favicon 显示 Spinner（转圈动画）
- **Fallback**: 无 favicon 时显示标题首字母
- **Loaded**: favicon 就绪后显示 `<img>`
- **尺寸**: 标题栏保持 16×16 (`h-4 w-4`)，不变

### 技术方案

1. `FaviconImg` 组件新增 `size` prop（`'sm'` | `'md'`），控制图标/Spinner/Fallback 统一尺寸
2. `NavigationState` 新增 `appId` 字段
3. `WebAppWindowService` 上下文新增 `appId`，`buildNavState()` 返回 `appId`
4. `TitleRow` 切换为 `<FaviconImg appId={appId} fallback={title} size="sm" />`
5. 保留 `faviconDataUrl` 在 `NavigationState`（主进程窗口图标仍需要），但标题栏渲染不再依赖它

---

## MCU Breakdown

### MCU-1: FaviconImg 新增 size prop

**改动文件**：
- `src/renderer/components/FaviconImg/index.tsx` — 新增 `size?: 'sm' | 'md'`，默认 `'md'`

**size 映射**：

| 状态 | `sm` (标题栏) | `md` (卡片, 默认) |
|---|---|---|
| Image | `h-4 w-4 rounded-sm` | `h-6 w-6 rounded` |
| Spinner 容器 | `h-4 w-4` | `h-6 w-6` |
| Spinner 内圈 | `h-3 w-3` | `h-4 w-4` |
| Fallback | `h-4 w-4 text-[10px]` | `h-6 w-6 text-xs` |

### MCU-2: NavigationState 携带 appId

**改动文件**：
- `src/shared/services/webAppWindowApi.ts` — `NavigationState` 新增 `appId?: string`
- `src/main/services/webAppWindowService.ts` — `WebAppWindowContext` 新增 `appId`，`buildNavState()` 返回 `appId`
- `src/main/services/webAppService.ts` — `createWindowForApp` 传入 `appId` 到 `WebAppWindowService` 构造参数

### MCU-3: TitleRow 切换为 appId 模式

**改动文件**：
- `src/renderer/components/WebAppTitleBar/TitleRow.tsx` — props 改为 `appId + title`，使用 `<FaviconImg appId={appId} fallback={title} size="sm" />`
- `src/renderer/components/WebAppTitleBar/index.tsx` — 从 `navState` 取 `appId` 传给 `TitleRow`

---

## Out of Scope

- 不改主页面 FaviconImg 行为（已一致）
- 不移除 `faviconDataUrl` 模式（保留向后兼容）
- 不改主进程 IPC 推送机制（`url-changed` 仍推送完整 NavigationState）
- 不改窗口任务栏图标逻辑（仍用 `faviconDataUrl` + `nativeImage`）

## Risks

1. **首次打开无缓存时标题栏先显示 Spinner**：与主页面行为一致，可接受
2. **轮询延迟**：faviconStore 首次 IPC 调用 `getFavicon(appId)` 通常命中缓存（窗口打开前已异步获取），未命中时 2s 轮询间隔
3. **appId 在 NavigationState 可选**：`appId?: string`，首次 `getNavState()` 可能未就绪；TitleRow 需容错

## Validation

- `pnpm run typecheck` 通过
- `pnpm run lint` 通过
- `pnpm run test` 全部通过
- `pnpm run build` 通过
- 手动验证：打开 web app → 标题栏 favicon 先显示 Spinner → 加载完成后显示图标
- 手动验证：已有缓存 → 标题栏直接显示图标（无 Spinner 闪烁）

---

## Plan（原子 Checklist）

### File Changes & Signatures

| # | File | Change |
|---|---|---|
| 1 | `src/renderer/components/FaviconImg/index.tsx` | 新增 `size` prop，`sm`/`md` 控制图标/Spinner/Fallback 尺寸 |
| 2 | `src/shared/services/webAppWindowApi.ts` | `NavigationState` 新增 `appId?: string` |
| 3 | `src/main/services/webAppWindowService.ts` | `WebAppWindowContext` + `buildNavState()` 新增 `appId` |
| 4 | `src/main/services/webAppService.ts` | `createWindowForApp` 传入 `appId` |
| 5 | `src/renderer/components/WebAppTitleBar/TitleRow.tsx` | props 改 `appId + title`，用 `FaviconImg` appId 模式 |
| 6 | `src/renderer/components/WebAppTitleBar/index.tsx` | 传 `appId` 给 `TitleRow` |

### Implementation Checklist

#### MCU-1: FaviconImg size prop

- [x] 1.1 `FaviconImg/index.tsx` — 新增 `size?: 'sm' | 'md'` prop，默认 `'md'`
- [x] 1.2 按上表映射：Image / Spinner / Fallback 的 className 根据 size 切换

#### MCU-2: NavigationState 携带 appId

- [x] 2.1 `webAppWindowApi.ts` — `NavigationState` 新增 `appId?: string`
- [x] 2.2 `webAppWindowService.ts` — `WebAppWindowContext` 新增 `appId: string`
- [x] 2.3 `webAppWindowService.ts` — `buildNavState()` 返回 `appId: this.context.appId`
- [x] 2.4 `webAppService.ts` — `createWindowForApp` 中 `new WebAppWindowService({ contentView: view, faviconDataUrl, appId })` 传入 appId

#### MCU-3: TitleRow 切换为 appId 模式

- [x] 3.1 `TitleRow.tsx` — props 改为 `{ appId?: string; title: string }`，渲染 `<FaviconImg appId={appId} fallback={title} size="sm" />`
- [x] 3.2 `WebAppTitleBar/index.tsx` — 传 `appId={navState.appId}` 给 `TitleRow`

#### 验证

- [x] V1 `pnpm run typecheck` 通过
- [x] V2 `pnpm run lint` 通过
- [x] V3 `pnpm run test` 全部通过（140 tests）
- [x] V4 `pnpm run build` 通过

---

## Review Verdict

**Overall**: ✅ PASS | **Date**: 2026-06-07

| Axis | Verdict | Notes |
|---|---|---|
| Requirement Completion | ✅ PASS | 标题栏 favicon 现在使用 appId 模式，三态行为与主页面一致 |
| Spec-Code Fidelity | ✅ PASS | 零偏差 |
| Code Quality | ✅ PASS | 复用已有 faviconStore，新增 size prop 最小改动 |

**Plan-Execution Diff**: 无。

**验证证据**: typecheck ✅ | lint ✅ | 140 tests ✅ | build ✅
