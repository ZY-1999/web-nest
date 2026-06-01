# Feature Spec: 同步模板最新提交 + 重构 webAppService View 管理

> **Phase**: Execute → Review
> **Created**: 2026-06-01
> **Status**: Active

---

## Goal

1. **同步模板最新提交 `cd12e60`**：将 `preload additionalArguments` 通道配置工具引入 web-nest
2. **重构 webAppService 的 view 管理**：用已有的 `ViewManager` + `ManagedView` 替代手动 `WebContentsView` 管理

## Background

### 模板最新提交 `cd12e60`

新增 `preload additionalArguments` 工具，允许主进程通过 `additionalArguments` 向 preload 传递 channel 初始化参数：

- `src/shared/preload/args.ts`：`PRELOAD_ARGS` 常量、`PreloadOptions` 接口、`buildPreloadArgs` + `parsePreloadArgs` 对称 API
- `src/preload/index.ts`：从 `process.argv` 解析配置 → `channel.init()`
- `src/__tests__/shared/channelArgs.test.ts`：13 个单元测试

### webAppService view 管理现状

`webAppService.ts` 的 `createWindowForApp` 方法手动管理 WebContentsView 全生命周期：

```
new WebContentsView() → addChildView() → setBounds() → on('resize') → webContents.close()
```

但项目已有 `ViewManager` + `ManagedView`，提供完整的 view 生命周期管理：

- `viewManager.createView()`：创建 + channel init + loadURL
- `managedView.attachTo()`：挂载到窗口 + 自动 setBounds
- `managedView.detach()`：从窗口卸载
- `viewManager.destroyView()`：销毁 + 清理

**差距**：webAppService 未使用这套基础设施，导致 view 管理逻辑分散、重复。

---

## Plan

### Task 1: 复制模板新文件

| 操作 | 文件 |
|------|------|
| 新增 | `src/shared/preload/args.ts` |
| 新增 | `src/__tests__/shared/channelArgs.test.ts` |

### Task 2: 更新 preload/index.ts

```typescript
import { parsePreloadArgs } from '@/shared/preload/args';

// 在 main() 中：
const { channelTimeout, channelExpose } = parsePreloadArgs(process.argv);
await channel.init({ defaultTimeout: channelTimeout, expose: channelExpose });
```

### Task 3: 重构 webAppService — 使用 ViewManager

**核心变更**：`WebAppEntry` 不再持有 `webContentsView`，改为持有 `viewId`（ViewManager 管理的标识符）。

#### 3a. 更新 WebAppEntry 类型

```typescript
interface WebAppEntry {
  appId: string;
  windowId: string;
  viewId: string;       // 替代 webContentsView
  url: string;
  title: string;
  faviconUrl: string;
}
```

#### 3b. 重构 createWindowForApp

```
Before: new WebContentsView() → addChildView → setBounds → on('resize') → loadURL
After:  viewManager.createView() → view.attachTo(win)
```

关键点：
- **webAppService 的 view 传 `preload` + `channelExpose: false`**：preload 脚本运行（日志、port 注册），但 `contextBridge.exposeInMainWorld` 被跳过，外部页面无法访问 `window.__app_channel__`
- 实现方式：`additionalArguments: buildPreloadArgs({ channelExpose: false })` → preload `parsePreloadArgs(process.argv)` → `channel.init({ expose: false })`
- `page-title-updated` 通过 `view.webContents.on(...)` 监听
- bounds 自动管理：`attachTo` 设置初始 bounds，`ManagedWindow.resized` 事件更新

#### 3c. 重构 closeWebApp / deleteWebApp

```
Before: webContents.close() → windowManager.destroyWindow()
After:  viewManager.destroyView(viewId) → windowManager.destroyWindow()
```

`viewManager.destroyView` 内部会 detach + destroy channel + close webContents。

#### 3d. 重构 openWebApp

重新创建 view 和 window 时，使用 ViewManager API。

#### 3e. 窗口 resize 联动

主窗口已有 `mainWin.on('resized', ...)` 模式。子窗口也用同样方式：

```typescript
const managedWin = windowManager.getWindow(windowId)!;
managedWin.on('resized', (_bounds, contentBounds) => {
  view.webContentsView.setBounds({ ...contentBounds, x: 0, y: 0 });
});
```

### Task 4: 更新集成测试

现有集成测试通过 mock electron 模块工作。重构后 `webAppService` 引入 `viewManager`，mock 需要覆盖 viewManager 的依赖。验证现有 13 个测试用例通过。

---

## File Changes

| 文件 | 操作 |
|------|------|
| `src/shared/preload/args.ts` | 新增（从模板复制）|
| `src/__tests__/shared/channelArgs.test.ts` | 新增（从模板复制）|
| `src/preload/index.ts` | 修改（加 parsePreloadArgs）|
| `src/main/services/webAppService.ts` | 重构（使用 ViewManager）|

## In Scope

- 模板 `cd12e60` 的文件同步
- webAppService view 管理重构
- 确保现有测试通过

## Out of Scope

- webAppService 的持久化 / favicon / UI（已有 spec 覆盖）
- 模板其他历史提交（已在之前同步）
- `closeAction: 'hide'` 等窗口策略变更
- ViewOptions `skipChannel` 支持（未来优化项）

## Validation

- `pnpm run typecheck` 通过 ✅
- `pnpm run lint` 通过（0 errors, 3 pre-existing warnings）✅
- `pnpm run test` 全部通过（139 tests）✅
- `pnpm run build` 成功 ✅

## Change Log

| 时间 | 变更 |
|------|------|
| 2026-06-01 | 初始 Plan 创建 |
| 2026-06-01 | 执行完成，全部验证通过 |
| 2026-06-01 | 用户决策：webAppService view 传 preload + channelExpose:false，利用 buildPreloadArgs 新特性 |
| 2026-06-01 | 更新 codemap + spec 完成 |
