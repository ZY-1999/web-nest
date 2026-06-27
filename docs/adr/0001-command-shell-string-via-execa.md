# ADR-0001: command 采用 shell 字符串，经 execa 执行

Date: 2026-06-27
Status: Accepted

## Context
服务型 web app 需要一个"启动本地后台服务"的配置。该配置的形态决定了输入数据模型、service 接口、UI 输入框的全部下游设计，必须先定。

## Decision
command 采用**单个 shell 字符串**形态（如 `npm start`、`python -m http.server 8000`、`TOKEN=xxx ./serve`），使用 [execa](https://github.com/sindresorhus/execa) 经用户指定的 shell（见 [ADR-0002](0002-shell-per-app-auto-detect.md)）执行。

## Consequences
- 用户的心智模型 = "终端里敲的那行命令"，配置最直观
- 支持管道、`&&`、环境变量展开（取决于所选 shell）
- Windows 上需选对 shell，否则 `.sh` / `&&` / `$VAR` 在 cmd 下失效
- shell 字符串有注入面，但 command 仅来自用户本地手动填写（见 [ADR-0005](0005-command-source-local-manual-only.md)），风险可控

## Alternatives considered
- **程序 + 参数分离**（`{ program, args }`）：安全、跨平台一致，但 UI 要两个输入框、写起来啰嗦，偏离用户"一行命令"心智。否决。
- **可执行脚本路径**（`./start.sh`）：把复杂逻辑挪到脚本，配置最干净，但要求用户额外维护脚本文件，门槛高。否决（用户可自行把命令封装成脚本，再用 shell 字符串调用）。
