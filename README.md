# web-nest

基于 Electron 的 Web 应用启动器，将常用 Web 应用统一管理在一个桌面应用中。

## 功能

- **Web 目录管理** — 添加、编辑、删除 Web 应用，自动获取 favicon
- **独立窗口运行** — 每个 Web 应用在独立窗口中打开，互不干扰
- **明暗主题切换** — 支持 light / dark 双主题，跟随系统或手动切换
- **自定义标题栏** — macOS 保留原生 traffic lights，Windows/Linux 使用原生 overlay 控件
- **应用持久化** — 关闭后重新打开，已添加的应用自动恢复

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
| `pnpm run test`          | 运行测试              |
| `pnpm run lint -- --fix` | 代码检查与修复        |
| `pnpm run package:win`   | 打包 Windows 安装程序 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Electron 34 + React 18 + TypeScript |
| 构建 | Vite 5（main / preload / renderer 三配置） |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 状态 | Zustand |
| 通信 | MessagePort IPC + 声明式服务注册表 |
| 测试 | Vitest（三环境）+ Playwright E2E |
| 打包 | electron-builder（Windows NSIS） |

## 架构

```
src/main/          → 主进程：窗口/视图管理、服务实现、托盘、更新
src/preload/       → 预加载：Channel 初始化、contextBridge 暴露
src/renderer/      → 渲染进程：React UI（TitleBar + WebCatalog + ThemeToggle）
src/shared/        → 跨进程共享：Channel IPC、Service Registry、API 定义、类型
native/            → Rust native 模块 (@napi-rs)
```

## License

MIT
