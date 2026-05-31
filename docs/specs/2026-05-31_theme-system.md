# Archive: 明暗色系体系

Archived: 2026-06-01
Status: **PASS** — 全部完成，无遗留

## Goal

为 renderer 主窗口建立明/暗色系体系，用 Slate Blue 色板替换 shadcn 默认色板，支持主题切换，删除 Counter 遗留代码。

## Final Architecture

**模板 IPC 方案**（useTheme hook 方案在重构中被完全替换）：

- `ThemeTokens` (shared) → CSS vars (`--bg`/`--surface`...) → Tailwind `@theme inline` → 组件语义 token
- 主进程 `ThemeService` 是 single source of truth，renderer 通过 `ThemeApi` IPC 获取/切换
- `applyThemeToRoot()` 直接 `style.setProperty` 到 `:root`，无需 `.dark` class
- CSS 变量用原始 hex，不经过 HSL 转换
- **防闪烁三层**：① 窗口离屏创建 (x:-10000) ② window + view backgroundColor 设为 tokens.bg ③ renderer 渲染前 applyThemeToRoot ④ 50ms 后居中定位窗口

## Key Files

| Role | Path |
|---|---|
| Theme 类型 + presets | `src/shared/theme/` (types.ts, presets.ts, index.ts) |
| ThemeApi IPC | `src/shared/services/themeApi.ts` |
| ThemeService (主进程) | `src/main/services/themeService.ts` |
| ThemeToggle 组件 | `src/renderer/components/ThemeToggle/index.tsx` |
| CSS 色板 | `src/renderer/styles/index.css` |
| 窗口创建 (防闪烁) | `src/main/mainWindow.ts` |
| View backgroundColor | `src/main/viewManager/index.ts`, `src/shared/view.ts` |
| E2E 测试 | `tests/e2e/theme.spec.ts` (3 tests) |

## Deleted Files (Counter 全链路)

10 个文件已删除：Counter 组件/store/service (renderer + shared + main) + 4 个测试文件

## Validation Evidence

- `pnpm run typecheck` — 0 error
- `pnpm run build` — 通过
- `pnpm run test` — 108 passed
- `pnpm run test:e2e` — 8 passed
- `pnpm run lint` — 0 error

## Plan-Execution Diff

- 删除文件：Plan 9 个，实际 10 个（`src/main/services/counterService.ts` 后补删）
- renderer/main.tsx：需保留 `serviceRegistry.setDefaultChannel(channel)`（WebApp RPC 依赖）
- **方案替换**：useTheme hook (localStorage + matchMedia + .dark class) → ThemeApi + ThemeService (IPC + hex CSS vars + style.setProperty)
- **防闪烁替换**：index.html 内联脚本 → Electron 级离屏渲染 + backgroundColor
- CSS：HSL → hex 直传，`.dark` class → `applyThemeToRoot()`，`@custom-variant dark` 移除

## Synced Knowledge

已沉淀到 auto memory：
- Theme 三层映射架构
- 防闪烁三层机制
- 主进程 ThemeService single source of truth
- E2E 断言 CSS 变量值而非 `.dark` class
