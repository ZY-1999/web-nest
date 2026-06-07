# AGENTS.md

> 给 AI Coding Agent、协作开发者、自动化脚本维护者的项目协作说明书。
> 本文档随项目演进逐步更新。

- `已确定` = 已确定，当前生效
- `当前约定` = 当前约定，后续可能调整
- `待补充` = 待补充

## 项目概览

- **项目名称**: web-nest
- **项目类型**: 基于 Electron 的 Web 应用启动器（桌面产品）
- **定位**: 用户通过 web-nest 管理和快速打开常用 Web 应用，支持持久化、favicon 缓存、卡片式 UI
- **模板来源**: 基于 `electron-template` 模板初始化，架构和基础设施与模板保持同步
- **核心能力**:
  - MessagePort IPC 双向类型安全通信
  - 声明式跨进程服务注册表 (ServiceRegistry / RPC)
  - 多窗口生命周期管理 (WindowManager)
  - WebContentsView 子窗口管理 (ViewManager)，支持嵌入式/独立/离屏三种模式
  - Web 应用管理 (WebAppService)：创建/打开/关闭/删除 Web 应用，持久化到本地 JSON
  - Web App 独立窗口自定义双行标题栏（导航栏 + 标题栏），per-view ServiceRegistry 服务注册
  - Preload additionalArguments 通道配置 (buildPreloadArgs / parsePreloadArgs)
  - Light/Dark 主题系统，主进程 single source of truth，IPC 同步到 renderer
  - 应用持久化 + favicon 缓存 (`~/.web-nest/`)
  - 自动更新、系统托盘、统一日志
  - Rust native 模块集成 (@napi-rs)
- **主要语言**: TypeScript, Rust (native 模块)
- **运行形态**: 桌面应用，electron-builder 打包（Windows NSIS 为主）
- **路径约定**: 配置通过 `WEB_NEST_HOME` 环境变量覆盖，默认 `~/.web-nest/`

## 当前项目阶段

`已确定` **功能开发阶段** — 核心架构已定型，基础功能（窗口/视图管理、WebApp CRUD、持久化、主题）已完成。后续以完善 UI 体验、边界情况处理、E2E 覆盖为主。

## Agent 工作原则

1. **先读后改**: 修改任何代码前，先读本文档和对应模块的源码及测试，理解其设计意图
2. **保持一致性**: 新增能力必须与现有模式保持一致（Singleton 装饰器、Channel IPC、ServiceRegistry 注册流程等）
3. **不破坏模板通用性**: 这是一个模板项目，不要引入特定业务逻辑；所有改动应面向"模板使用者"而非"最终用户"
4. **三进程意识**: 始终清楚当前代码运行在 main / preload / renderer 哪个进程，不要在错误进程调用不适用的 API
5. **类型安全优先**: 所有跨进程通信必须经过类型约束，不允许 `any` 逃逸
6. **测试覆盖**: 每个新增能力或 bug 修复都要有对应的测试用例

## 架构与进程模型

### 三进程架构

```
┌─────────────────────────────────────────────────┐
│  Main Process (Node.js)                         │
│  Electron 主进程，管理窗口/视图/托盘/更新/系统    │
│  构建配置: vite.config.main.mts → dist/main/     │
├─────────────────────────────────────────────────┤
│  Preload (隔离沙箱)                             │
│  桥接层，暴露有限的 API 给 renderer              │
│  构建配置: vite.config.preload.mts → dist/pre/   │
├─────────────────────────────────────────────────┤
│  Renderer Process (Chromium)                    │
│  React 18 + Zustand + Tailwind CSS v4 + shadcn  │
│  构建配置: vite.config.renderer.mts (Vite dev)   │
└─────────────────────────────────────────────────┘
```

### 进程间通信路径

- **Main ↔ Renderer**: 通过 `MessageChannelMain` 建立 Port，经 preload 桥接
- **ServiceRegistry**: 声明式 API 定义 → 自动路由（同进程直调，跨进程走 Channel）
- **环境变量 `PROCESS_TYPE`**: 运行时标识当前进程类型 (`main` / `preload` / `renderer`)

### 关键设计模式

- **`@Singleton()` 装饰器** (`src/shared/utils/singleton.ts`): 进程内单例，支持按进程类型限制
- **Service Export 统一约定** (`当前约定`): 所有 service 使用 `class + export const xxService = new XxxService()` 模式导出，消费方通过 `xxService.method()` 调用。per-view service（如 `WebAppWindowService`）保持 class export 不变
- **`Channel` 类** (`src/shared/channel/`): MessagePort IPC 封装，类型安全双向通信
- **`ServiceRegistry`** (`src/shared/serviceRegistry/`): 服务注册/发现/RPC，`defineApi()` + `implementService()`
- **`WindowManager`** (`src/main/windowManager/`): 多窗口生命周期，macOS 关闭隐藏到托盘
- **`ViewManager`** (`src/main/viewManager/`): WebContentsView 管理，内置通道通信和广播
- **Preload Args** (`src/shared/preload/args.ts`): 主进程通过 `buildPreloadArgs()` 构建 `additionalArguments`，preload 通过 `parsePreloadArgs()` 解析，对称 API

## 修改代码前必须阅读

按优先级排列，Agent 在修改对应模块前**必须**先读这些文件：

### 全局必读

| 文件                 | 理由                     |
| -------------------- | ------------------------ |
| `AGENTS.md`          | 本文档，项目协作规范     |
| `docs/code-style.md` | 代码风格完整参考         |
| `package.json`       | 依赖、脚本、包管理器版本 |

### 理解全貌

| 文件                                          | 理由             |
| --------------------------------------------- | ---------------- |
| `docs/codemap/*_electron-template项目总图.md` | 项目总览 CodeMap |
| `README.md`                                   | 模板使用说明     |

### 构建流程

`pnpm run build` 执行步骤：

1. `pnpm run build:native` → Rust 编译 (Cargo → `.node` 文件)
2. `scripts/build.mjs` → 清理 dist → 依次构建 main / preload / renderer
3. 各自使用独立 Vite 配置: `vite.config.{main,preload,renderer}.mts`

## 测试与验证要求

### 测试体系

`已确定` **三层测试架构**:

| 层级     | 工具           | 配置                       | 位置                                  |
| -------- | -------------- | -------------------------- | ------------------------------------- |
| 单元测试 | Vitest         | `vitest.config.mts`        | `src/__tests__/`                      |
| E2E 测试 | Playwright     | `playwright.config.ts`     | `tests/e2e/`                          |
| CI 验证  | GitHub Actions | `.github/workflows/ci.yml` | lint → typecheck → test → build → e2e |

### 单元测试

Vitest 配置三个 project 环境：

| project    | 环境  | 包含路径                                   | setup 文件                         |
| ---------- | ----- | ------------------------------------------ | ---------------------------------- |
| `main`     | node  | `src/__tests__/{main,shared,integration}/` | `infrastructure/setup.ts`          |
| `preload`  | jsdom | `src/__tests__/preload/`                   | `infrastructure/setup.preload.ts`  |
| `renderer` | jsdom | `src/__tests__/renderer/`                  | `infrastructure/setup.renderer.ts` |

测试文件命名: `*.test.ts`

### 验证要求

Agent 完成代码修改后，必须按以下顺序验证：

1. `pnpm run typecheck` — 类型检查通过
2. `pnpm run lint` — 无 lint 错误
3. `pnpm run test` — 所有现有测试 + 新增测试通过（当前 139 tests）
4. `当前约定` 如涉及构建/打包相关改动，运行 `pnpm run build`
5. `当前约定` 如涉及 UI 改动，运行 `pnpm run dev` 目视确认
6. `当前约定` 如涉及跨进程通信，运行 `pnpm run test:e2e`（当前 19 E2E tests）
4. `当前约定` 如涉及构建/打包相关改动，运行 `pnpm run build`
5. `当前约定` 如涉及 UI 改动，运行 `pnpm run dev` 目视确认
6. `当前约定` 如涉及跨进程通信，运行 `pnpm run test:e2e`

### CI 流水线

GitHub Actions CI 包含三个 job：

1. **check** (ubuntu): lint → typecheck → unit test
2. **build** (windows/macos/ubuntu 三平台): build
3. **e2e** (windows): Playwright E2E 测试

## 销毁安全约定

`已确定` 原生资源（BaseWindow、WebContents）销毁后访问属性会抛异常。所有 destroy/detach 方法必须遵循：

1. **Map 先 delete 再 destroy**：`viewManager.destroyView()` 和 `windowManager.destroyWindow()` 先从 Map 删除再调 `destroy()`，防止重入
2. **基础设施层 try-catch**：`ManagedView.detach()`/`destroy()` 和 `ManagedWindow.destroy()` 内部 try-catch 保护原生访问，保证不向上抛异常
3. **调用层不叠加 try-catch**：基础设施层保证安全后，调用方（如 webAppService）直接调用，无需冗余 try-catch
4. **stale entry 检测**：检查存活时必须同时检查 window 和 view（Playwright `w.close()` 可能只销毁 webContents 而 BaseWindow 仍存活）
5. **isClosing 标志**：`nativeWindow.on('close')` 同步标记，早于异步 `closed` 事件，确保 `openWebApp` 能及时感知

## 代码风格与约束

完整代码风格见 [docs/code-style.md](docs/code-style.md)

## 禁止事项

1.  **不要引入业务逻辑** — 这是模板项目，不要添加特定业务功能
2.  **不要绕过 IPC 通信** — renderer 和 main 之间必须通过 Channel / ServiceRegistry 通信，不允许直接使用 `ipcMain`/`ipcRenderer`
3.  **不要在 preload 中暴露过多 API** — preload 是安全边界，只暴露必要的桥接
4.  **不要使用 `any`** — 用 `unknown` + 类型收窄
5.  **不要跳过测试** — 每个改动必须有对应测试覆盖
6.  **不要提交 `.env`、`*.node`、`dist/`、`release/`** — 见 `.gitignore`
7.  **不要直接改动 `native/*.node`、`native/index.cjs`、`native/index.d.ts`** — 这些是 `pnpm run build:native` 的产物
8.  **不要删除或修改 `native/target/`** — Rust 编译缓存，已在 `.gitignore`
9.  **不要在测试中硬编码端口或超时时间** — 使用配置常量
10. **不要忽略 `PROCESS_TYPE` 环境变量** — 它决定了单例和 Channel 的行为

## 不确定问题处理方式

1. **信息不足时**: 先阅读源码和测试，理解现有模式。如果仍然不确定，在代码注释中标注 `// TODO: 待确认` 并说明原因
2. **设计决策不确定时**: 遵循项目已有模式（已有 counterService 作为参考实现），不要引入新模式
3. **API 行为不确定时**: 查看对应测试用例，测试是行为规格的最佳文档
4. **跨进程调用不确定时**: 检查 `@Singleton()` 装饰器的进程参数和 `PROCESS_TYPE` 的使用方式
5. **无法确定是否属于模板范围**: 保守处理，不添加，记录问题让项目维护者决定

## 文档维护规则

** 用户进行总结或更新或维护文档时 更新维护本文档及关联文档 **

1. **本文档是活文档** — 随项目演进更新，不要等到"完美"才写
2. **架构变更时同步更新** — 新增模块、修改通信模式、更换依赖时，更新对应章节
3. **标注状态** — 使用 `已确定`/`当前约定`/`待补充` 标注每项的确信度
4. **不重复** — 已有独立文档的内容（如 `docs/code-style.md`），本文档只引用不复制
5. **CodeMap 维护** — `docs/codemap/` 下的文档应与代码同步更新，可用 `/codemap` skill 生成

## 待补充事项

- `待补充` **性能基准**: 各核心模块的性能指标和阈值
- `待补充` **部署流程**: 生产发布流程 (代码签名、公证、更新服务器配置)
- `待补充` **多语言/国际化**: 模板是否需要内置 i18n 支持
- `待补充` **无障碍 (a11y)**: 是否需要 WCAG 合规要求
- `待补充` **安全审计清单**: Electron 安全最佳实践检查项
- `待补充` **模板使用者的迁移指南**: 版本升级时如何处理 breaking change
- `当前约定` **macOS 签名/公证**: `electron-builder.config.mjs` 中已预留但未配置
- `当前约定` **Linux 打包**: CI 中有构建但无打包 job
