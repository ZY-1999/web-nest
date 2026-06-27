# ADR-0005: command 来源 = 仅本地手动填写（安全闸）

Date: 2026-06-27
Status: Accepted

## Context
command 是被 web-nest 执行的本地 shell 字符串（见 [ADR-0001](0001-command-shell-string-via-execa.md)）——等同用户在终端敲命令。若 command 来自不可信源（导入、云同步、远程下发），构成提权执行风险。需框定 command 的合法来源。

## Decision
第一版 command **仅来自用户在 AddDialog / EditDialog 的本地手动填写**。不提供配置导入、云同步、远程下发。

**为未来留的安全闸**：若后续版本引入"配置导入 / 云同步"，导入得到的服务型 app（含 `service`）**必须经用户二次确认**才允许执行其 command——不能导入即执行。

其余安全决策（本地单用户威胁模型下）：
- command 明文存储于 `apps.config`（加密无增益，钥匙也存本地）
- 编辑表单明文显示（用户自填自看，遮蔽反不便编辑）
- 不在添加 / 打开时额外弹执行确认（用户主动配置即意图，类比 IDE launch.json）
- command 完整入日志，stderr 尾部入日志（本地日志，用户自主风险）
- 不做 `apps.config` 篡改防护（本地应用固有特性）

## Consequences
- 第一版无不可信 command 路径，注入 / 提权风险关在门外
- 明确记录"未来导入需二次确认"约束，防止后续遗忘安全闸
- 用户截图 / 共享屏幕时 command（可能含 token）会暴露——接受，后续可加遮蔽切换

## Alternatives considered
- **加密静止存储**：本地单用户无增益（钥匙也得存本地）。否决。
- **首次执行弹确认**：每次开 app 都确认很烦，且用户配置即意图。否决。
- **遮蔽显示**：不便编辑，边缘场景。第一版否决，留作后续增强。
