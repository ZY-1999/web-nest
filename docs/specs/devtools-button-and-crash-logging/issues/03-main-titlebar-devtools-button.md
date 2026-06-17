# Issue 03: 主窗口标题栏 DevTools 按钮

Status: ready-for-agent

## Parent

[PRD — 标题栏 DevTools 按钮 + 加载/崩溃事件日志](../PRD.md)

## What to build

在主窗口 TitleBar（Settings / ThemeToggle 旁）增加一个 DevTools 切换按钮，点击切换主内容 view 的 DevTools。在主 channel（updater / theme / i18n / settings 等 service 注册处）暴露一个 `toggleDevTools()` 能力，后端取主内容 view 调用其 `ManagedView.toggleDevTools()`。图标 / tooltip / `data-testid` / i18n 约定与 Web App 按钮（issue 02）一致。dev 与生产均启用。

## Design rationale

- **切分**：PRD「Implementation Decisions > 标题栏 DevTools 按钮」+ 确认决策（按钮非快捷键、生产启用）。本片与 issue 02 平行但位于主 channel；API 契约（`toggleDevTools(): Promise<void>`、ServiceRegistry 模式、`data-testid`）由 PRD Implementation Decisions 固定，本片无需重新决策 issue 02 已定之事。
- **一致性**：`registerMainServices` 在主 channel 注册 service——在此暴露 `toggleDevTools()` 与现有主窗口 service 注册方式一致。
- **覆盖**：PRD user story 11 + 共享 13/14/15/16/18/19/20。
- **被否决的替代方案**：
  - 与 issue 02 合并为单一"DevTools 按钮"片——否决，两种窗口管道独立（per-view service vs 主 channel）、E2E 独立，更薄的切片更受偏好。
  - 两种窗口共用同一个 API class——否决，per-view 的 `WebAppWindowApi` 与主 channel 能力本就不同，分离避免窗口类型耦合。

## Out of scope

- Web App 标题栏按钮（见 issue 02）。
- 键盘快捷键 / `before-input-event`。
- 环境门控（仅 dev 显示）。
- dev 模式自动 openDevTools（`mainWindow.ts` 现有行为）——保持不动。
- 主窗口 loadURL 失败处理 / show-after-ready。

## Acceptance criteria

- [ ] 主窗口 TitleBar 出现 DevTools 图标按钮，与现有 Settings / ThemeToggle 按钮风格一致，带 `data-testid`。
- [ ] 点击打开主内容 view 的 DevTools（`isDevToolsOpened()` 为 true）；再次点击关闭。
- [ ] 单元：主 channel 的 `toggleDevTools()` 能力调用主内容 view 的 `toggleDevTools()`；view 已销毁时调用不抛异常——守住销毁安全路径。
- [ ] 按钮 label 经 i18n 管理（zh-CN + en）。
- [ ] `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` 全绿；现有 E2E 不退化。

## Blocked by

None - can start immediately

## Comments

### 2026-06-17 — 实现完成（TDD：服务层 RED → GREEN，UI + E2E 验证）

改动文件：
- `src/shared/services/mainWindowApi.ts`（新增）— `MainWindowApi` abstract + `defineApi(MainWindowApi, 'main')`。
- `src/main/services/mainWindowService.ts`（新增）— `MainWindowService` 持主 view，`toggleDevTools()` 守卫 + 委托 `mainView.toggleDevTools()`。
- `src/main/mainWindow.ts` — 主 view 创建 attach 后 `serviceRegistry.implementService(channel, new MainWindowService({ mainView: view }))`，与 `registerMainServices` 主 channel 注册一致。
- `src/renderer/components/TitleBar/index.tsx` — Settings 旁加 DevTools 按钮（shadcn `Button ghost icon h-7 w-7`，lucide `Terminal`，`data-testid="titlebar-devtools"`，`aria-label`+`title` 走 i18n，点击调 `mainWindowApi.toggleDevTools()`）。与 Web App 按钮（issue 02）样式/契约一致。
- `src/__tests__/main/services/mainWindowService.test.ts`（新增）— 2 用例（存活委托；销毁跳过不抛）。
- `tests/e2e/app.spec.ts` — 新增 E2E：点击主窗口 `[data-testid="titlebar-devtools"]` → `electronApp.evaluate` 断言主 view（URL 含 `index.html`）`isDevToolsOpened()` 由 false→true→false。

说明：主窗口是单 view（TitleBar 与内容同一 page），故按钮与目标 view 同页；i18n 复用 issue 02 的 `titlebar.devtools`，无需新增 key。

验证：`pnpm run typecheck` ✓ / `pnpm run lint` ✓（0 errors；2 warning 为既有）/ `pnpm run test` ✓ 19 files / 160 tests / `pnpm exec playwright test app.spec.ts webAppTitlebar.spec.ts` ✓ 10 passed（含新增主窗口 DevTools，既有无退化）。
