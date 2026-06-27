# Context: Web-Nest 领域语言（Ubiquitous Language）

> 本文件定义 web-nest 项目的核心领域术语。SDD skills 在 issue 标题、假设、测试名、重构提案中提到领域概念时，优先用这里的词汇，不要漂移到同义词。
> 决策记录见 [docs/adr/](docs/adr/)；长期规则与踩坑见 [AGENTS.md](AGENTS.md)。

## 核心概念

### Web App
用户添加到 web-nest 的一个"应用"条目，打开后以独立 BaseWindow + WebContentsView 呈现一个外部 URL。持久化于 `~/.web-nest/apps.config`（结构 `PersistedApp`）。分两类（隐式，由是否有 `service` 字段区分）：

### 普通型 Web App（Plain Web App）
仅有 URL 的 web app。打开 = 加载 URL，无本地命令执行。默认形态。

### 服务型 Web App（Service-backed Web App）
同时配置 URL 和 `service` 的 web app。打开时先 spawn 一条本地命令（command）启动后台服务，再加载 URL；关闭时 kill 服务进程。本功能（2026-06-27）引入。

### command
服务型 web app 配置的一行 **shell 字符串**，经指定 shell 执行（Node `child_process.spawn`，见 [ADR-0006](docs/adr/0006-executor-child-process-not-execa.md)），用于在打开 app 前启动一个本地后台服务。
- 形态：shell 字符串（如 `npm start`、`python -m http.server 8000`）
- 存储于 `PersistedApp.service.command`（明文）
- 仅来自用户本地手动填写（见 [ADR-0005](docs/adr/0005-command-source-local-manual-only.md)）

### shell（per-app）
执行 command 所用的 shell，**per-app 配置**。
- 取值：`'auto' | 'bash' | 'cmd' | 'powershell'` 或自定义 shell 路径
- 默认 `'auto'`
- `'auto'` = 全局探测一次并缓存（Git Bash → PowerShell → cmd），兜底 cmd（见 [ADR-0002](docs/adr/0002-shell-per-app-auto-detect.md)）

### service
`PersistedApp` 的嵌套字段 `{ command: string; shell: string }`。**存在即表示服务型 web app**（隐式类型区分，无 `type` 字段）。

### service state（serviceState）
后台服务进程在标题栏可见的状态机：
- `idle` — 未启动（普通型 app 永远 idle）
- `starting` — command 已 spawn，URL 自适应重试中
- `running` — URL 加载成功，服务在跑
- `failed` — spawn 失败 / 加载成功前进程退出 / 重试超时
- `stopped` — 运行中崩溃（进程 exit）

### auto shell 探测（auto shell detection）
`shell='auto'` 时，主进程探测系统可用 shell 的全局一次性过程，结果缓存供所有 `auto` app 共用。

## 生命周期术语

### 后台服务进程（background service process）
execa spawn 的子进程（含其进程树），生命周期绑定到对应 web app 窗口——窗口 `closed` 时 kill，`app.before-quit` 兜底扫杀（见 [ADR-0004](docs/adr/0004-process-cleanup-force-kill-tree.md)）。

## 就绪术语

### URL 自适应重试（URL adaptive retry）
服务型 app 打开时，spawn command 后立即 `loadURL`，`did-fail-load` 触发重试（500ms→2s 退避，30s 超时），直到服务就绪或超时（见 [ADR-0003](docs/adr/0003-readiness-parallel-url-retry.md)）。
