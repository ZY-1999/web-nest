# Feature Spec: 应用持久化 + Favicon 缓存 + 卡片 UI 重构

> **Phase**: Research → Plan
> **Created**: 2026-06-01
> **Status**: Active

---

## Goal

将 web-nest 从"会话级应用管理"升级为"持久化应用启动器"：
1. 应用列表以 JSON 持久化到 `~/.web-nest/apps.config`
2. Favicon 抓取后转 dataURL 缓存到 `~/.web-nest/.cache/`
3. 卡片 UI 重构为正方形 + favicon 两层展示 + hover 配置菜单

## Current State

- `webAppService.ts` 仅内存 Map 维护应用，关闭窗口即删除
- 无 favicon 获取能力
- 卡片为横向矩形，点击打开编辑弹窗，手动 Close 按钮关闭

## Target State

- 应用数据持久化，重启不丢失
- `closeWebApp` = 关闭窗口（不删记录）；`deleteWebApp` = 删除记录
- `openWebApp` = 为已存在的应用打开新窗口
- `faviconUrl` 作为应用配置的一部分持久化；dataURL 缓存到 `~/.web-nest/.cache/`，运行时加载
- 缓存丢失时可从 `faviconUrl` 重新拉取
- 卡片正方形、favicon 白底圆框、hover 显示编辑/删除

---

## MCU Breakdown

### MCU-1: 路径工具 + 持久化存储层
- `paths.ts`: `getConfigDir()`, `getCacheDir()`
- `appConfigService.ts`: `loadApps()`, `saveApps(apps)`
- 单元测试

### MCU-2: API + Service 重构
- `webAppApi.ts`: 新增 `deleteWebApp`, `openWebApp`；`WebAppState` 增加 `faviconUrl` + `faviconDataUrl`
- `webAppService.ts`: 集成持久化 + 语义分离
- Store: 启动时加载

### MCU-3: Favicon 获取与缓存
- `faviconService.ts`: Google Favicon API → dataURL → 缓存
- `faviconUrl` 随应用配置持久化，dataURL 仅运行时从缓存加载
- 缓存丢失时从 `faviconUrl` 重新拉取
- 集成到 createWebApp 流程

### MCU-4: 卡片 UI 重构
- 正方形卡片 + favicon 两层展示 + hover 菜单

---

## Out of Scope

- 主题系统修改（色值已一致）
- 应用分组/搜索
- Favicon 智能多尺寸选择
- 自动 favicon 刷新
- 数据加密/压缩

## Risks

1. Favicon 获取不稳定 → 用 Google Favicon API 兜底
2. close/delete 语义混淆 → API 显式命名 + 严格分离
3. 跨平台目录创建 → 用 Electron `app.getPath('home')` 统一

## Validation

- `pnpm run typecheck` 通过
- `pnpm run test` 通过（含新增持久化/favicon 单元测试）
- `pnpm run build` 通过
- `pnpm run test:e2e` 通过（含新增 E2E 覆盖）：
  - 添加应用 → 关闭窗口 → 重启 → 应用仍在列表（持久化）
  - favicon 正确渲染（验证 `<img>` src 为 dataURL）
  - 点击卡片直接打开应用（验证新窗口出现）
  - hover 显示编辑/删除操作按钮
