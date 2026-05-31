# SDD Spec: Web Catalog MVP — URL 独立窗口管理

## 0. Open Questions

- [x] web-catalog 产品定位 → 确认：管理多个 web app 的桌面容器
- [x] 子窗口是否需要与主窗口通信 → 确认：完全独立，无需通信
- [x] 验证方式 → 确认：集成测试

## 1. Requirements (Context)

- **Goal**: 实现最小可用的 web-catalog 桌面应用 — 用户可通过主窗口输入 URL，每个 URL 以独立 Electron 窗口打开；主窗口展示已打开应用列表，支持关闭
- **In-Scope**:
  - 主进程 webAppService：创建/关闭/列出独立 web app 窗口
  - Shared API 定义：`WebAppMainApi`
  - Renderer UI：URL 输入 + 应用列表 + 关闭按钮
  - Renderer store：管理应用列表状态
  - 集成测试覆盖核心流程
  - E2E 测试覆盖主流程：启动 → 输入 URL → 新窗口打开 → 列表展示 → 关闭窗口
- **Out-of-Scope**:
  - 书签/应用持久化（本版内存态）
  - favicon/图标抓取
  - 自动更新、系统托盘改动
  - Native (Rust) 模块改动
  - CI/打包/部署改动
  - 子窗口与主窗口的 IPC 通信
  - `src/shared/channel/` 和 `src/shared/serviceRegistry/` 核心层改动
  - `WindowManager` / `ViewManager` / `ManagedWindow` / `ManagedView` 本身

## 1.1 Context Sources

- Requirement Source: 用户对话（管理多个 web app 的桌面容器，子窗口完全独立）
- Design Refs: 项目 codemap `docs/codemap/2026-05-29_12-00_electron-template项目总图.md`
- Extra Context: 现有 Counter 示例为参考实现模式

## 1.5 Codemap Used

- Codemap Mode: `project`
- Codemap File: `docs/codemap/2026-05-29_12-00_electron-template项目总图.md`
- Key Index:
  - Entry Points: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`
  - Core Patterns: WindowManager (BaseWindow 生命周期), ViewManager (WebContentsView 生命周期), Channel + ServiceRegistry (跨进程 RPC)
  - Reference Implementation: CounterService — `src/shared/services/counterApi.ts` → `src/main/services/counterService.ts` → `src/renderer/services/counterService.ts`

## 1.7 Minimum Chaos Unit Assessment

- Final Goal: web-catalog MVP — URL 独立窗口管理
- Current Task Unit: 完整 MVP（service + API + UI + 测试），一次性交付
- Why this unit is small enough: 核心路径单一（输入 URL → 开窗口 → 列表 → 关闭），复用已有 WindowManager 基础设施，不涉及核心层改动
- In-Scope Boundary: webAppService + WebAppMainApi + Renderer UI + 集成测试
- Out-of-Scope Boundary: 持久化、图标、子窗口 IPC、核心层改动
- Verification Evidence: 集成测试覆盖 create/list/close 全流程；E2E 测试覆盖完整用户操作路径
- Failure / Rework Plan: 每个文件变更独立，可单独回退；集成测试失败不回退已有功能
- Model Autonomy Space: 文件命名、组件结构、具体 UI 布局由模型自主决定
- User Decision: Accepted

## 2. Research Findings

### 事实与约束

1. **子窗口无需 Channel IPC**：子窗口完全独立，不需要 ViewManager 的 Channel 初始化流程。直接使用 `BaseWindow` + `WebContentsView` 即可，不走 ViewManager
2. **主窗口仍需 Channel + ServiceRegistry**：主窗口 renderer 通过 ServiceRegistry RPC 调用 main 进程的 webAppService
3. **参考模式**：CounterService 是标准模式 — `defineApi()` 在 shared 定义接口 → `implementService()` 在 main 实现 → renderer 通过 proxy 调用
4. **WindowManager 可复用**：已有 `createWindow()` / `destroyWindow()` / `getNativeWindow()` 能力
5. **主窗口 `closeAction: 'hide'`**：应保留主窗口到托盘的行为，关闭所有 web app 窗口才退出应用
6. **集成测试基础设施**：现有 `src/__tests__/infrastructure/` 提供 Electron mock 和 setup；新增集成测试可放在 `src/__tests__/main/services/` 或新建 `src/__tests__/integration/`

### 风险与不确定项

1. **多窗口资源管理**：每个 web app 是一个 BaseWindow + WebContentsView，需要确保关闭时资源正确回收
2. **外站 URL 安全**：子窗口加载外部 URL 时，必须 `contextIsolation: true, nodeIntegration: false`，不注入 preload
3. **window-all-closed 行为**：当前逻辑是所有窗口关闭后 quit（非 macOS）。主窗口隐藏不算关闭，但 web app 窗口关闭会触发该事件。需要调整退出逻辑

## 2.1 Next Actions

- 进入 Plan 阶段，定义文件变更清单和原子 checklist
- 等待 Plan Approved 后进入 Execute

## 3. Innovate (Optional)

- Skipped: true
- Reason: 架构方向明确，直接复用现有 WindowManager + ServiceRegistry 模式

## 4. Plan (Contract)

### 4.1 File Changes

| # | 文件 | 操作 | 说明 |
|---|---|---|---|
| 1 | `src/shared/services/webAppApi.ts` | 新建 | WebAppMainApi 定义：`createWebApp(url)`, `closeWebApp(id)`, `listWebApps()` |
| 2 | `src/shared/services/index.ts` | 修改 | 导出 `WebAppMainApi` |
| 3 | `src/main/services/webAppService.ts` | 新建 | WebAppService 实现：管理独立窗口生命周期，内部维护 app 列表 |
| 4 | `src/main/services/index.ts` | 修改 | 注册 webAppService |
| 5 | `src/main/index.ts` | 修改 | 调整 `window-all-closed` 逻辑：仅当没有 web app 窗口且主窗口隐藏时才 quit |
| 6 | `src/main/mainWindow.ts` | 修改 | 主窗口 `closeAction` 改为 `'hide'` |
| 7 | `src/renderer/stores/webAppStore.ts` | 新建 | WebApp Zustand store：管理应用列表状态 |
| 8 | `src/renderer/services/webAppService.ts` | 新建 | Renderer 侧 WebAppMainApi 实现（proxy） |
| 9 | `src/renderer/App.tsx` | 修改 | 替换 Counter 为 WebCatalog 布局 |
| 10 | `src/renderer/components/Counter/` | 删除 | 移除 Counter 示例组件 |
| 11 | `src/renderer/components/WebCatalog/` | 新建 | URL 输入 + 应用列表组件 |
| 12 | `src/renderer/main.tsx` | 修改 | 注册 webAppRendererService，移除 counter 相关 |
| 13 | `src/shared/services/counterApi.ts` | 保留 | 不删除，避免破坏现有测试 |
| 14 | `src/main/services/counterService.ts` | 保留 | 不删除 |
| 15 | `src/__tests__/integration/webAppService.integration.test.ts` | 新建 | 集成测试 |
| 16 | `tests/e2e/webCatalog.spec.ts` | 新建 | E2E 测试：启动 → 输入 URL → 新窗口打开 → 列表展示 → 关闭 |

### 4.2 Signatures

```typescript
// src/shared/services/webAppApi.ts
export interface WebAppState {
  id: string;
  url: string;
  title: string;
}

export abstract class WebAppMainApi {
  abstract createWebApp(url: string): Promise<WebAppState>;
  abstract closeWebApp(id: string): Promise<void>;
  abstract listWebApps(): Promise<WebAppState[]>;
}

// src/main/services/webAppService.ts
export class WebAppService extends WebAppMainApi {
  // 内部维护 Map<string, { windowId: string; state: WebAppState }>
  // createWebApp: new BaseWindow + new WebContentsView 加载 URL
  // closeWebApp: 关闭 WebContentsView + 销毁 BaseWindow
  // listWebApps: 返回当前所有 app 状态
}
```

### 4.3 Implementation Checklist

- [x] 1. 新建 `src/shared/services/webAppApi.ts` — 定义 `WebAppState` + `WebAppMainApi` 抽象类
- [x] 2. 修改 `src/shared/services/index.ts` — 导出 `webAppApi`
- [x] 3. 新建 `src/main/services/webAppService.ts` — 实现 `WebAppService`（WindowManager + BaseWindow + WebContentsView）
- [x] 4. 修改 `src/main/services/index.ts` — 注册 `webAppService`
- [⏭️] 5. 修改 `src/main/index.ts` — 调整退出逻辑（跳过，主窗口 hide 已满足）
- [x] 6. 修改 `src/main/mainWindow.ts` — 主窗口 closeAction 改 hide
- [x] 7. 新建 `src/renderer/stores/webAppStore.ts` — 应用列表状态管理
- [⏭️] 8. 新建 `src/renderer/services/webAppService.ts`（跳过，shared proxy 直接可用）
- [x] 9. 新建 `src/renderer/components/WebCatalog/index.tsx` — URL 输入 + 应用列表 UI
- [x] 10. 修改 `src/renderer/App.tsx` — 替换 Counter 为 WebCatalog
- [⏭️] 11. 修改 `src/renderer/main.tsx`（跳过，无需额外注册）
- [x] 12. 新建 `src/__tests__/integration/webAppService.integration.test.ts` — 集成测试（5 个用例）
- [x] 13. 新建 `tests/e2e/webCatalog.spec.ts` — E2E 测试主流程（2 个用例）
- [x] 14. 运行 `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` — 121/121 通过
- [x] 15. 运行 `pnpm run build` + `pnpm run test:e2e` — 3/3 通过

### 4.5 Route Alignment

- Original assumption: 可能需要 ViewManager 管理 web app 视图
- Current implementation route: 通过 WindowManager 创建/销毁 BaseWindow，手动创建 WebContentsView 加载 URL，不走 ViewManager（因为子窗口完全独立，无需 Channel）
- Why it fits: 子窗口无 IPC 需求，ViewManager 的 Channel 初始化是额外开销；WindowManager 统一管理窗口生命周期，与模板主窗口架构一致
- Scope impact: 不触碰 ViewManager
- User Decision: N/A (技术决策)

## 5. Execute Log

### 执行记录

| # | Checklist 项 | 状态 | 备注 |
|---|---|---|---|
| 1 | 新建 webAppApi.ts | ✅ | WebAppState + WebAppMainApi 抽象类 |
| 2 | 修改 services/index.ts | ✅ | 导出 webAppApi |
| 3 | 新建 webAppService.ts | ✅ | 通过 WindowManager 管理 BaseWindow，手动创建 WebContentsView 加载 URL |
| 4 | 修改 main/services/index.ts | ✅ | 注册 webAppService |
| 5 | 调整退出逻辑 | ⏭️ 跳过 | 主窗口 hide 已满足当前需求，无需调整 window-all-closed |
| 6 | 主窗口 closeAction 改 hide | ✅ | mainWindow.ts |
| 7 | 新建 webAppStore.ts | ✅ | Zustand store |
| 8 | 新建 renderer webAppService.ts | ⏭️ 跳过 | renderer 直接使用 shared 的 webAppMainApi proxy，无需额外 renderer service |
| 9 | 新建 WebCatalog/index.tsx | ✅ | URL 输入 + 应用列表 + 关闭按钮 |
| 10 | 删除 Counter 组件 | ⏭️ 跳过 | 保留 Counter 不影响功能，避免破坏现有测试 |
| 11 | 修改 renderer main.tsx | ⏭️ 跳过 | renderer 无需额外注册，shared proxy 自动工作 |
| 12 | 新建集成测试 | ✅ | 5 个测试：create/list/close/non-existent/independent-close |
| 13 | 新建 E2E 测试 | ✅ | 2 个测试：UI 渲染交互 + 点击 Open 创建新窗口 |
| 14 | typecheck + lint + test | ✅ | 121/121 通过 |
| 15 | build + test:e2e | ✅ | 3/3 E2E 通过（含原有 app.spec.ts） |

### 关键发现与修正

1. **WebAppService 复用 WindowManager**：通过 `windowManager.createWindow()` / `destroyWindow()` 管理窗口生命周期，手动创建 WebContentsView 加载 URL，与模板架构一致
2. **static apiName 替代 Function.name**：生产构建 minify 会混淆类名，ServiceRegistry 依赖类名做 RPC 路由。模板已用 `static apiName` 静态属性方案修复，已同步到本项目
3. **Renderer 无需独立 service 文件**：shared 的 `webAppMainApi` proxy 可直接在组件中使用，无需额外 renderer service 层

## 6. Review Verdict

### Review Matrix

| 轴 | 评估 | 证据 |
|---|---|---|
| **功能完整性** | ✅ GO | 用户可输入 URL → 独立窗口打开 → 主窗口列表显示 → 可关闭 |
| **测试覆盖** | ✅ GO | 5 集成测试 + 2 E2E 测试，覆盖 create/list/close 全流程 |
| **代码质量** | ✅ GO | 复用 WindowManager + ServiceRegistry 模式，类型安全，无安全漏洞 |
| **构建健康** | ✅ GO | typecheck + lint + 121 单测 + build + 3 E2E 全通过 |
| **安全边界** | ✅ GO | 子窗口 `contextIsolation: true, nodeIntegration: false`，不注入 preload |

### Overall Verdict: **GO**

- MVP 核心功能完整交付
- 计划偏差均为合理简化，无遗漏功能
- 模板预存 bug（class name minification）已修复

## 7. Plan-Execution Diff

### 偏差记录

| # | Plan 项 | 实际执行 | 偏差原因 |
|---|---|---|---|
| 3 | BaseWindow + WebContentsView | WindowManager + BaseWindow + WebContentsView | 复用 WindowManager 管理窗口生命周期，原误改为 BrowserWindow 后已修正 |
| 5 | 调整 window-all-closed 退出逻辑 | 跳过 | 主窗口 hide 已满足，web app 关闭不触发误退出 |
| 8 | 新建 renderer/services/webAppService.ts | 跳过 | shared proxy 直接可用，无需额外层 |
| 10 | 删除 Counter 组件 | 保留 | 避免破坏现有测试，不影响新功能 |
| 11 | 修改 renderer/main.tsx | 跳过 | 无需额外注册 |
| 额外 | esbuild keepNames → static apiName | 新增后替代 | keepNames 先用于修复 RPC 类名混淆，后模板用 apiName 静态属性替代，已同步 |

## 9. Project Sync Candidates

以下知识已在模板中同步解决，但作为项目经验记录：

1. **ServiceRegistry `static apiName` 约定**：所有 API 抽象类必须声明 `static apiName = 'ClassName'`，作为跨进程 IPC 路由的服务名标识。未声明时生产构建 minify 会导致类名混淆，跨进程服务调用失败。已在模板 AGENTS.md 中记录。
2. **Playwright E2E + Electron**：BaseWindow+WebContentsView 完全可被 Playwright 操作页面元素，通过主窗口 UI 验证 app 列表变化即可覆盖 E2E 测试。
3. **MessageChannel 端口配对竞态**：WebContentsView double-load 会导致 preload 执行两次，产生错误的端口配对。模板已用 requestId 机制修复，已同步。
