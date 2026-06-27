# PRD: 服务型 Web App —— 打开前启动本地后台服务，关闭后停止

Type: prd
Status: ready-for-agent
Date: 2026-06-27
Feature dir: `.scratch/2026-06-27-app-command-service/`

## Problem Statement

web-nest 现在只支持**普通型 web app**：一个 URL，打开 = 加载 URL。但有一类真实场景未被覆盖——用户想包装的是**本地后台服务**驱动的应用：本地 dev server、自托管 dashboard、需要先 `npm start` / `docker run` / `python -m http.server` 起服务的工具。

这类应用需要：① 打开 app **之前**先执行一条本地命令把服务拉起来；② 服务起来后再加载 URL；③ 关闭 app 时把服务进程也停掉。

现有持久化模型只有四个字段（id / url / title / faviconUrl），无处挂这条启动命令；web app 服务层也没有 spawn / kill 子进程的能力。结果：用户要么手动在终端起服务再回来点图标（体验割裂），要么干脆没法用 web-nest 包装这类应用。

## Solution

引入**服务型 web app**：在 web app 配置里新增可选的「服务定义」——一条 shell 命令加上执行它的 shell。

- **打开**服务型 app 时：先 spawn 这条命令把后台服务拉起来，同时并行加载 URL；URL 自适应重试直到服务就绪或超时。用户看到的是窗口秒开、标题栏从「启动中」变「运行中」。
- **关闭**该 app 窗口时，kill 对应的后台服务进程（含进程树）；退出整个 web-nest 时兜底扫杀所有仍在运行的服务进程。
- **配置**上普通型与服务型可互转：填了启动命令就是服务型，清空就回到普通型。
- 执行命令的 shell 可选，支持自动探测（Git Bash → PowerShell → cmd）。
- 失败（命令拼错、服务秒退、长时间起不来）经标题栏状态指示呈现，不弹窗、不自动重启。

向后兼容：旧配置文件零迁移，原有普通型 app 不受影响。

## User Stories

1. **作为开发者**，我想把 `http://localhost:3000`（一个需要 `npm run dev` 启动的本地服务）加成 web-nest 应用，配置启动命令 `npm run dev`，这样点开图标就自动起服务并打开页面，关掉窗口服务也停。
2. **作为开发者**，我想在编辑应用时改它的启动命令或 shell，或把一个普通型 app 改成服务型（反之亦然）。
3. **作为用户**，当启动命令失败（命令拼错 / 服务秒退 / 长时间起不来），我想在标题栏清楚看到原因，而不是面对一个空白或无意义的错误页。
4. **作为用户**，我不想被命令里可能带的 token / 路径细节打扰——配置就是一行我熟悉的终端命令。

## Implementation Decisions

> 每条决策的背景、后果、被否决备选见对应 ADR；这里只列结论。代码现状指针见 Further Notes。

| # | 决策 | ADR |
|---|---|---|
| D1 | `command` = 单个 shell 字符串，经 **execa** 执行 | [0001](../../docs/adr/0001-command-shell-string-via-execa.md) |
| D2 | `shell` = **per-app** 字段，取值 `'auto'\|'bash'\|'cmd'\|'powershell'\|<自定义路径>`，默认 `'auto'`；auto = 全局探测一次缓存（Git Bash→PowerShell→cmd），兜底 cmd + warn | [0002](../../docs/adr/0002-shell-per-app-auto-detect.md) |
| D3 | 就绪判断 = **并行开窗 + URL 自适应重试**（spawn 后立即 `loadURL`，`did-fail-load` 触发重试 500ms→2s 退避，30s 超时；超时仍加载一次） | [0003](../../docs/adr/0003-readiness-parallel-url-retry.md) |
| D4 | 清理 = 窗口 `closed` kill 对应服务 + `before-quit` 兜底扫杀；**强杀进程树**（win32 `taskkill /T /F` 或 execa 等价）；不做看门狗 | [0004](../../docs/adr/0004-process-cleanup-force-kill-tree.md) |
| D5 | command **仅本地手动填写**；明文存储 / 明文显示 / 不额外确认；未来导入需二次确认 | [0005](../../docs/adr/0005-command-source-local-manual-only.md) |

**失败处理矩阵**（反馈统一走标题栏，不弹 dialog / toast，不自动重启）：

| 场景 | 处理 | serviceState |
|---|---|---|
| spawn 失败（ENOENT/EACCES） | 停止重试，窗口保留 | `failed`（附 execa 错误简述） |
| 加载成功前进程 exit | 提前结束重试（不等 30s） | `failed`（附 exit code） |
| 运行中崩溃（已 running 后 exit） | 不重启，窗口保留最后页面 | `stopped`（附 exit code） |
| 重试超时（30s） | 仍加载 URL 一次 | `failed`（"服务可能未就绪"） |

**数据模型形状**（编码决策的 type shape，按模板 schema 例外保留；具体文件归属与精确签名留给 `/to-spec`）：

- 持久化的 app 配置新增可选 `service` 字段；**`service` 存在即代表服务型 app**（隐式区分，不引入 `type` 字段）；旧配置无此字段读出为 `undefined` → 普通型，零迁移。
- `service` 形状 = `{ command: string; shell: string }`（command = shell 字符串，D1；shell = `'auto'|'bash'|'cmd'|'powershell'|自定义路径`，D2）。
- `service` 存在但 `shell` 为空 → 读取兜底视为 `'auto'`（不污染存储）。
- 校验：`service` 存在 → `command` 非空 **且** `url` 非空，违反则拒绝并提示。

**IPC 扩展**（决策性描述，精确签名留给 `/to-spec`）：

- `createWebApp` / `updateWebApp` 扩展 `service` 入参：传 `{command,shell}` = 设/改；传 `null` = 清除（回到普通型）；`undefined` = 不动。其余方法签名不变，返回值带上 `service`。
- renderer 侧 app state 透传 `service`，供列表区分与编辑回填。
- 服务状态（`serviceState` / `serviceError`）经标题栏推送通道下发，复用现有 navState 推送机制；走合并 channel 还是独立 channel 留给 `/to-spec`（见 Deepening Goals）。

**UI 决策**（组件级改动与行号留给 `/to-spec`）：

- 新增 / 编辑 app 的表单加「启动本地服务（高级）」开关，勾选后展开 `command` 文本框 + `shell` 下拉（auto / bash / cmd / powershell / 自定义，选「自定义」弹路径输入）；command 空 = 普通型。保存时校验 service → command + url 必填。支持普通型↔服务型互转。
- app 卡片在 favicon 角加小 Terminal 角标标识服务型。
- web app 标题栏第二行（URL 区旁）显示 `serviceState` 指示：`starting`(spinner) / `running`(绿点) / `failed`(红字简述) / `stopped`(灰点)。
- 新增对应 i18n 文案（服务相关标签 + 错误提示）。

## Testing Decisions

- **配置持久化**：带 `service` 的 load / save；旧配置（无 service）向后兼容；shell 空值读取兜底 auto。
- **shell auto 探测**（新模块）：mock 探测函数，验证 Git Bash→PowerShell→cmd 优先级、全局缓存命中、全失败兜底 cmd + warn。
- **web app 服务生命周期**：`createWebApp(url, service)` / `openWebApp` 带 service → mock execa → 验证 spawn 调用、URL 重试退避、`closed` 触发 kill、`before-quit` 扫杀；失败矩阵四场景的 serviceState 迁移。
- **进程管理**：mock execa 子进程对象，验证 kill 走进程树（win32 `taskkill /T` 语义）。
- **UI**：表单开关展开 + 校验拒绝空 command；卡片服务型角标渲染。
- **E2E**（Playwright）：添加服务型 app（指向测试用本地 server 脚本）→ 打开 → 标题栏 starting→running → 关窗 → 断言服务进程被 kill（poll 进程列表或测试用 pid 文件）。
- 沿用项目 mock 约定（webContents 模块级共享单例，`beforeEach` 清 listener；`apiName` 静态属性；per-view service 注册时序）。

## Out of Scope

YAGNI，留作后续：

- health endpoint / 端口轮询 / stdout 就绪信号匹配——第一版用 URL 重试替代（[ADR-0003](../../docs/adr/0003-readiness-parallel-url-retry.md)）。
- 进程优雅关闭（SIGTERM 宽限期）、崩溃孤儿看门狗（[ADR-0004](../../docs/adr/0004-process-cleanup-force-kill-tree.md)）。
- 配置导入 / 云同步 / 远程下发（[ADR-0005](../../docs/adr/0005-command-source-local-manual-only.md)）。
- command 加密存储 / 遮蔽显示 / 首次执行确认——本地单用户威胁模型（[ADR-0005](../../docs/adr/0005-command-source-local-manual-only.md)）。
- WSL bash 探测（Git Bash 优先即可，WSL 后续加）。

## Further Notes

### Acceptance Criteria

1. 添加一个服务型 app（填 url + command），打开后窗口秒开、标题栏先 `starting`、服务就绪后内容加载成功且状态变 `running`。
2. 关闭该 app 窗口，对应后台服务进程（含子进程）被 kill，无孤儿。
3. 退出整个 web-nest（quit），所有运行中的服务进程被扫杀。
4. command 故意拼错（如 `nonexistent-cmd-xyz`）→ 标题栏 `failed` + 简述，不无限重试。
5. 服务运行中手动 kill 服务进程 → 标题栏变 `stopped`，窗口不崩。
6. 编辑 app 能在普通型↔服务型互转，service 校验（空 command + 有 url 等）正确拒绝。
7. 旧配置（无 service 字段）打开后所有 app 仍按普通型正常工作。
8. `pnpm run typecheck` / `lint` / `test` / `build` / `test:e2e` 全绿。

### Deepening Goals（留给 `/to-spec` 分解为 spec 时细化）

- execa 当前版本在 win32 的 `shell`（接受程序名 / 路径的具体行为）与 `kill`（是否默认杀进程树）—— spec 阶段用 context7 核版本，必要时显式 `taskkill /T /F`。
- Git Bash 路径探测的具体实现策略（注册表 `GitForWindows` InstallPath / 常见安装路径枚举 / `which bash`），及其跨平台回退。
- stderr 尾部入日志 / 标题栏的截断策略（行数 or 字节数上限）。
- `serviceState` / `serviceError` 推送的 IPC 时序（与现有 navState 推送合并还是独立 channel）。
- 进程对象在 app entry 的存放与销毁 handler 的清理顺序（对齐现有「content view 先销毁、titlebar 后销毁」约定）。
- shell auto 探测模块的归属（独立 `shellDetector` service vs 挂在某现有 service）。

### 代码现状指针

- [app 配置持久化层](../../src/main/services/appConfigService.ts) — `PersistedApp` 模型与 load / save。
- [web app 服务层](../../src/main/services/webAppService.ts) — app 窗口创建 / `nativeWindow.on('closed')` / entry 销毁生命周期。
- [web app IPC 契约](../../src/shared/services/webAppApi.ts) — `WebAppMainApi` / `WebAppState`。
- [web app 列表 UI](../../src/renderer/components/WebCatalog/index.tsx) — 新增 / 编辑对话框、app 卡片。
- [web app 标题栏 per-view 服务](../../src/main/services/webAppWindowService.ts) — navState 构建与推送。

### 依赖

- 新增生产依赖 `execa`。

### Open Questions

- 无。grill 阶段的决策已全部 resolved，依据见 [CONTEXT.md](../../CONTEXT.md) 与 [docs/adr/](../../docs/adr/)。

## Comments

- 2026-06-27 — PRD 由 `/idea-to-prd` 经 7 轮 grill 合成，9 项决策全部用户确认。
- 2026-06-27 — 按 `to-prd` 模板重构：状态 `ready-for-agent` → `ready-for-human`（Gate 0 未过、spec 未分解）；移除 Implementation Decisions 里的文件路径 / 行号 / 非决策性代码片段，`type shape` 作为 schema 例外保留并去文件路径注释；补 `## Solution`；section 命名与顺序对齐模板（Problem Statement / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope / Further Notes），Acceptance / Deepening Goals / 代码指针 / Open Questions 归入 Further Notes。Gate 0 待人工审阅。
