# Issue 02: Web App 标题栏 DevTools 按钮

Status: ready-for-agent

## Parent

[PRD — 标题栏 DevTools 按钮 + 加载/崩溃事件日志](../PRD.md)

## What to build

在 Web App 标题栏第 1 行（ThemeToggle 旁）增加一个 DevTools 切换按钮。点击切换该窗口**内容 view**（加载外部 URL 的 WebContentsView）的 DevTools，而非标题栏 view 的。

通过现有 per-view 的 `WebAppWindowApi` 暴露能力（新增 `toggleDevTools()`），由 `WebAppWindowService` 实现（已持有 content view 引用），内部调用 `ManagedView.toggleDevTools()`。按钮与现有标题栏图标按钮风格一致，带 tooltip / aria-label 与 `data-testid`；label 走 i18n（zh-CN + en）。dev 与生产均启用。

## Design rationale

- **切分与契约**：PRD「Implementation Decisions > 标题栏 DevTools 按钮」+ 本会话确认的决策——用按钮而非 `before-input-event` 快捷键，生产环境也启用（"目前版本只使用标题栏按钮打开"、"生产可用"）。
- **复用现有管道**：`WebAppWindowService` 是 per-view 且已持有 content view 引用（见 webapp-custom-titlebar spec / 本会话探查），`ManagedView.toggleDevTools()` 已存在——复用使本片保持纵向完整，避免新 IPC 管道。
- **目标对象**：PRD user story 12/17——按钮必须作用于内容 view（外部 URL），标题栏本地 renderer 不是调试对象。
- **约定**：AGENTS.md / 自动 memory——ServiceRegistry `static apiName` 约定、类型安全 IPC（禁裸 `ipcRenderer`）、销毁安全（toggle 前 `isDestroyed()` 检查）。
- **被否决的替代方案**：
  - `before-input-event` 键盘快捷键——本轮用户否决。
  - 切换标题栏 view 的 DevTools——否决，需调试的是外部 URL 内容 view（story 17）。

## Out of scope

- 主窗口 DevTools 按钮（见 issue 03）。
- 键盘快捷键 / `before-input-event`。
- 环境门控（仅 dev 显示）。
- 改动 `ManagedView.toggleDevTools()` 内部行为。
- Web App 内容区加载占位 / 错误占位。

## Acceptance criteria

- [ ] Web App 标题栏第 1 行出现 DevTools 图标按钮，使用现有 ghost/icon 样式，带 `data-testid`——E2E 与用户可定位。
- [ ] 点击按钮打开内容 view 的 DevTools（`webContents.isDevToolsOpened()` 变 true）——验证目标为外部 URL view 而非标题栏 view。
- [ ] 再次点击关闭 DevTools（toggle 行为）。
- [ ] 单元：`WebAppWindowService.toggleDevTools()` 调用 content view 的 `toggleDevTools()`；view 已销毁时调用不抛异常——守住销毁安全路径。
- [ ] 按钮 label 经 i18n 管理（zh-CN + en）。
- [ ] `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` 全绿；现有 E2E 不退化。

## Blocked by

None - can start immediately

## Comments

### 2026-06-17 — 实现完成（TDD：服务层 RED → GREEN，UI + E2E 验证）

改动文件：
- `src/shared/services/webAppWindowApi.ts` — 新增 `abstract toggleDevTools(): Promise<void>`。
- `src/main/services/webAppWindowService.ts` — 实现 `toggleDevTools()`：`isDestroyed()` 守卫 + 委托 `contentView.toggleDevTools()`（与 navigateBack/reload 同模式）。
- `src/shared/i18n/locales/{en,zh-CN}.json` — `titlebar.devtools`（en: "DevTools" / zh: "开发者工具"）。
- `src/renderer/components/WebAppTitleBar/TitleRow.tsx` — 第 1 行右侧加 DevTools 按钮（shadcn `Button ghost icon h-7 w-7`，lucide `Terminal`，`data-testid="titlebar-devtools"`，`aria-label`+`title` 走 i18n，点击调 `webAppWindowApi.toggleDevTools()`）。样式与相邻 ThemeToggle 一致。
- `src/__tests__/main/services/webAppWindowService.test.ts` — 新增 2 用例（存活时委托 contentView.toggleDevTools；销毁时跳过且不抛）。
- `tests/e2e/webAppTitlebar.spec.ts` — 新增 E2E：点击 `[data-testid="titlebar-devtools"]` → 用 `electronApp.evaluate` 精确断言**内容 view** 的 `isDevToolsOpened()` 由 false→true→false（toggle 两次）。

验证：`pnpm run typecheck` ✓ / `pnpm run lint` ✓（0 errors；2 warning 为既有）/ `pnpm run test` ✓ 18 files / 158 tests / `pnpm exec playwright test tests/e2e/webAppTitlebar.spec.ts` ✓ 8 passed（7 既有 + 1 新增，无退化）。
