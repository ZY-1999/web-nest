# web-nest

基于 Electron 的 Web 应用启动器，将常用 Web 应用统一管理在一个桌面应用中。

## 功能

- **Web 目录管理** — 添加、编辑、删除 Web 应用，自动获取 favicon
- **独立窗口运行** — 每个 Web 应用在独立窗口中打开，互不干扰、独立 session
- **明暗主题切换** — 支持 light / dark 双主题，跨窗口实时同步
- **自定义标题栏** — 双行标题栏：标题 + 导航按钮/URL 展示，macOS 保留原生 traffic lights
- **应用持久化** — 关闭后重新打开，已添加的应用自动恢复；删除应用时清理对应 session
- **全局设置** — 主题、语言、开机自启、关闭 GPU 加速、自定义 User-Agent、代理（HTTP/SOCKS5，可在线测试）
- **国际化** — 支持中文/英文，通过 i18next 管理多语言，首次启动跟随系统语言
- **桌面快捷方式** — 一键创建/删除桌面快捷方式（Windows）
- **自动更新** — 通过 electron-updater 支持后台检查更新

## 快速开始

```bash
pnpm install
pnpm run dev
```

## 常用命令

| 命令                     | 说明                  |
| ------------------------ | --------------------- |
| `pnpm run dev`           | 启动开发环境          |
| `pnpm run build`         | 生产构建              |
| `pnpm run typecheck`     | 类型检查              |
| `pnpm run test`          | 运行单元测试          |
| `pnpm run test:e2e`      | build + Playwright E2E |
| `pnpm run lint -- --fix` | 代码检查与修复        |
| `pnpm run package:win`   | 打包 Windows 安装程序 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Electron 34 + React 18 + TypeScript |
| 构建 | Vite 5（main / preload / renderer 多页面） |
| 样式 | Tailwind CSS v4 |
| 国际化 | i18next |
| 通信 | MessagePort IPC + 声明式服务注册表 |
| 测试 | Vitest（三环境）+ Playwright E2E |
| 打包 | electron-builder（Windows NSIS） |

## 架构

```
src/main/          → 主进程：窗口/视图管理、服务实现（i18n/settings/theme/webApp/favicon/appConfig/shortcut/updater）、托盘
src/preload/       → 预加载：Channel 初始化、contextBridge 暴露
src/renderer/      → 渲染进程：React UI（主页 TitleBar + WebCatalog + SettingsDialog + WebApp 标题栏）
src/shared/        → 跨进程共享：Channel IPC、Service Registry、API 定义、i18n 资源、Settings 类型、主题
native/            → Rust native 模块 (@napi-rs)
```

### 进程通信

采用 MessagePort + 声明式服务注册表：

- `defineApi()` 声明跨进程服务接口（如 `SettingsApi`、`I18nApi`）
- `implementService()` 在主进程注册实现
- renderer 通过代理透明调用 `settingsApi.getSettings()`，框架自动序列化、超时、错误传递

### 配置与持久化

| 内容 | 路径 |
| --- | --- |
| 全局设置 | `~/.web-nest/settings.json` |
| Web App 列表 | `~/.web-nest/apps.config` |
| Favicon / Session 缓存 | `~/.web-nest/.cache/` |

可通过 `WEB_NEST_HOME` 环境变量覆盖根目录。

## License

MIT
