# web-nest

基于 Electron 的 Web 应用启动器，将常用 Web 应用统一管理在一个桌面应用中。

## 功能

- **Web 目录管理** — 添加、编辑、删除 Web 应用，自动获取 favicon
- **独立窗口运行** — 每个 Web 应用在独立窗口中打开，互不干扰、独立 session
- **明暗主题切换** — 支持 light / dark 双主题，跟随系统或手动切换
- **自定义标题栏** — 双行标题栏：标题 + 导航按钮/URL 展示，macOS 保留原生 traffic lights
- **应用持久化** — 关闭后重新打开，已添加的应用自动恢复
- **国际化** — 支持中文/英文，通过 i18next 管理多语言
- **桌面快捷方式** — 一键创建/删除桌面快捷方式（Windows）

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
| 框架 | Electron 34 + React 19 + TypeScript |
| 构建 | Vite 5（main / preload / renderer 多页面） |
| 样式 | Tailwind CSS v4 |
| 国际化 | i18next |
| 通信 | MessagePort IPC + 声明式服务注册表 |
| 测试 | Vitest（三环境）+ Playwright E2E |
| 打包 | electron-builder（Windows NSIS） |

## 架构

```
src/main/          → 主进程：窗口/视图管理、服务实现、托盘
src/preload/       → 预加载：Channel 初始化、contextBridge 暴露
src/renderer/      → 渲染进程：React UI（主页 TitleBar + WebCatalog + WebApp标题栏）
src/shared/        → 跨进程共享：Channel IPC、Service Registry、API 定义、类型
native/            → Rust native 模块 (@napi-rs)
```

## License

MIT
