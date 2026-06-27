# ADR-0002: shell 选择 = per-app 配置 + auto 全局探测

Date: 2026-06-27
Status: Accepted

## Context
command 是 shell 字符串（见 [ADR-0001](0001-command-shell-string-via-execa.md)），执行需指定一个 shell。Windows 默认 `cmd.exe` 无法处理 `&&`、`$VAR`、`.sh`；用户系统可能装了 Git Bash / WSL / PowerShell。需要决定"shell 由谁选、配在哪"。

## Decision
shell 作为 **per-app 配置字段**（`PersistedApp.service.shell`），取值：
- `'auto'`（默认）— 主进程**全局探测一次并缓存**，所有 `auto` app 共用
- `'bash'` / `'cmd'` / `'powershell'` — service 翻译成 execa 的 `shell` 参数（解析真实路径）
- 自定义路径字符串 — 直接喂给 execa `shell`

**auto 探测优先级**：Git Bash → PowerShell → cmd.exe；全部探测失败回落 `cmd.exe`（execa `shell: true`）+ 日志 warn。探测结果缓存复用，auto 不重探。

## Consequences
- 不同 app 可用不同 shell（罕见但灵活）
- Windows 用户零配置（auto）即可用 Git Bash，`&&` / `.sh` 可用
- 探测逻辑集中在主进程一处，可单测
- execa 在 win32 的 `shell` 接受程序名或绝对路径；Git Bash 路径解析（注册表 / 常见安装位置）落到 spec 阶段，用 context7 核 execa 当前版本行为

## Alternatives considered
- **全局 shell 偏好**（settings 里一项）：shell 是环境属性，多数 app 共用一个。被否决——用户明确选择 per-app，保留每 app 独立选 shell 的灵活性。
- **纯自动不暴露**：零配置但无逃生口（非标准路径的 bash 没法指）。否决，保留自定义路径项。
