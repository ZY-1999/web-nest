# ADR-0006: 服务进程执行改用 Node child_process（替代 execa）

Date: 2026-06-27
Status: Accepted
Supersedes: ADR-0001 中"经 execa 执行"部分（command shell 字符串数据模型保留）

## Context
ADR-0001 决定 command 经 execa 执行。/tdd 阶段（Spec 03 ProcessManager）落地执行层时发现两个技术约束：

1. **ESM/CJS 兼容风险**：execa v9+ 是 pure ESM（`"type": "module"`，仅 ESM exports）。本仓库主进程经 vite 打包为 **CJS bundle**（[vite.config.main.mts](../../vite.config.main.mts)：`formats: ['cjs']` + `inlineDynamicImports: true` + `dynamicImportInCjs: false`）。execa 内部使用动态 import，rollup 将其 bundle 进 CJS 存在失败风险（顶层 await 在 CJS 输出不支持，import.meta 需特殊处理）。

2. **execa kill 不杀进程树**：execa 的 `subprocess.kill()` 默认只杀主进程。ADR-0004 要求强杀进程树（win32 `taskkill /T /F`）。因此无论 execa 还是 child_process，killTree 都必须显式 `taskkill /T /F`（win32）/ `child.kill()`（非 win32）——execa 在 kill 维度无额外价值。

Spec 03 的全部需求（spawn command 经 shell、进程树 kill、exit/error 事件回调、stderr 尾部截断）Node 内置 `child_process` 原生完全满足。

## Decision
服务进程执行改用 **Node 内置 `child_process`**（`spawn` + 自管 `killTree`）。不引入 execa 依赖。

- command 仍为 **shell 字符串**（ADR-0001 的数据模型决策不变，仅执行引擎变更）
- spawn 经 `child_process.spawn(command, { shell, ... })`，shell 由 [ADR-0002](0002-shell-per-app-auto-detect.md) 的 shellDetector 解析后传入
- killTree：win32 `taskkill /pid <pid> /T /F`（/T 杀树 /F 强制）；非 win32 `child.kill()`（默认信号杀进程）

## Consequences
- 零新生产依赖；主进程 CJS bundle 无 ESM 兼容风险
- 失去 execa 的 promise 包装与更友好的错误对象——本场景非必需，ProcessManager 自管 exit/error 事件回调
- killTree 显式实现（对齐 ADR-0004），幂等 + try-catch 保护（对齐 AGENTS.md 销毁安全约定）

## Alternatives considered
- **execa + 动态 import**：主进程 `await import('execa')` 绕过 CJS require，但仍需 rollup bundle ESM（TLA/dynamic import 风险仍在），且 `dynamicImportInCjs: false` 下处理复杂。否决。
- **execa v5（最后 CJS 版本）**：避免 ESM 问题，但 v5（2021）已停维、缺新特性、与 ADR-0001 假设的"最新 execa"不符。否决。
