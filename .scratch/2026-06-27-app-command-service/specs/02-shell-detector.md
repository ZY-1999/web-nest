# Spec 02: Shell 自动探测模块（shellDetector）

Type: spec
Status: completed
Parent: .scratch/2026-06-27-app-command-service/prd.md
Blocked by: None — can start immediately

## Goal
实现 `'auto'` shell 的全局一次性探测 + 缓存模块（Git Bash → PowerShell → cmd，全失败兜底 cmd + warn），为服务型 app 的 command 执行提供可用的 shell——独立纯主进程模块，可独立单测。

## Acceptance criteria
- [x] 探测优先级：mock Git Bash 存在 → 返回 Git Bash 路径；mock Git Bash 缺、PowerShell 在 → 返回 PowerShell；全缺 → 兜底 cmd + warn — 证明 D2 优先级链
- [x] 全局缓存：第二次 resolveShell('auto') 不重探（mock 探测函数断言只调用一次）— 证明「全局一次性」
- [x] 显式取值直通：`'bash'`/`'cmd'`/`'powershell'`/自定义路径 四种非 auto 取值，不触发 auto 探测，翻译成 execa 可消费的真实 shell 值 — 证明非 auto 不探测
- [x] 跨平台回退：非 win32 平台行为合理（走默认 shell，不抛异常）— 证明不只在 win 跑
- [x] 下游消费 sanity：resolveShell 产物能被服务型 app 打开流程（Spec 04）消费——Spec 04 在 spawn 前调 resolveShell，至少类型导入 + 一次 mock 调用打通 — 证明模块不是孤岛
- [x] 失败兜底与探测结果均入日志 — 证明可观测

## Scope
- **In**: shellDetector 模块（独立 service 或工具函数，归属 design 定）；Git Bash 路径解析；PowerShell/cmd 解析；全局缓存；日志。
- **Out**: execa spawn 本身（Spec 03）；任何 UI；配置存储（Spec 01）。

## Context
- 领域词汇：shell / auto shell 探测（CONTEXT.md）。
- ADR-0002：per-app shell，`'auto'` = 全局探测一次缓存，兜底 cmd + warn。
- Deepening Goal：Git Bash 路径策略（注册表 GitForWindows InstallPath / 常见路径枚举 / `which bash`）—— Design 钉死主策略。
- Deepening Goal：execa win32 `shell` 参数接受程序名/路径的具体行为 —— Design 用 context7 核版本。

## Design

**Interface delta**：
- 新模块 shellDetector（内部依赖，非 IPC service，类比 appConfigService/faviconService 模式）。
- `resolveShell(shell: string): Promise<string>` —— 入口：接收 `service.shell` 值，返回 execa 可消费的真实 shell。
  - `'auto'` → `detectAndCache()` 探测结果
  - `'bash'` → Git Bash 探测（同 auto 的 Git Bash 路径解析）
  - `'cmd'` → `'cmd.exe'`
  - `'powershell'` → `'powershell.exe'`（或 pwsh 若存在）
  - 自定义路径 → 原样返回
- `detectAndCache(): Promise<string>` —— 全局一次性探测，结果缓存于模块级变量。

**Internal architecture**：
- **Git Bash 探测主策略（钉死）**：win32 ① 注册表 `HKLM\SOFTWARE\GitForWindows\InstallPath`（+ wow6432node 兜底）② 常见路径枚举（`C:\Program Files\Git\bin\bash.exe`、`C:\Program Files (x86)\Git\bin\bash.exe`）③ `which bash`（child_process）。三步择优，任一命中即返回 bash.exe 路径。
- PowerShell：`where pwsh`（pwsh 优先）→ `where powershell` → 系统 path 解析。
- 探测结果 + 兜底（全失败 → cmd + warn）均入日志。
- **跨平台**：非 win32 直接返回 `process.env.SHELL || '/bin/bash'`，不探测 Git Bash。
- 纯 Node（不依赖 Electron API），可独立单测（mock child_process / fs / 注册表访问）。

## Rework on failure

模块独立；redo this spec only。
