# ADR-0003: 服务就绪判断 = 并行开窗 + URL 自适应重试

Date: 2026-06-27
Status: Accepted

## Context
服务型 web app 打开时，command 启动的后台服务需要时间就绪。需决定"何时加载 URL"——这决定核心交互（用户点击后的反馈时序）与 service 接口形态。

## Decision
采用**并行 + URL 自适应重试**：
1. spawn command 后**立即**创建窗口并 `loadURL`
2. 监听 webContents `did-fail-load`（连接拒绝）→ 触发重试，间隔 500ms 起步、退避到 2s，总超时 30s
3. 重试期间标题栏显示"服务启动中…"（`serviceState: 'starting'`）
4. 超时后仍加载 URL 一次（让用户看到浏览器"无法连接"页自判）+ 标题栏提示"服务可能未就绪"
5. 加载成功 → `serviceState: 'running'`

第一版**不做** health endpoint 轮询、stdout 信号匹配等进阶就绪检测（YAGNI）。

## Consequences
- 零额外配置（用户只填 url + command），不引入 health endpoint / port 字段
- 窗口秒开（用户立即知道点击生效），内容就绪自动填入
- 复用现有 webContents 事件体系（webAppService 已在用 `did-fail-load` 等）
- 不同启动速度的服务无需调参（自适应）
- 代价：服务极慢启动（>30s）时用户最终看到错误页（可接受，超时已提示）

## Alternatives considered
- **严格串行 + health check**：spawn → 轮询 `http://localhost:PORT/health` → 就绪才开窗。精确，但要求用户额外配 health endpoint / port，违背"只填 url + command"哲学；且点击后有空 spinner 等待。否决。
- **固定延迟**（sleep 2s）：简单但 delay 难定（不同服务启动时间差异大）。否决。
- **stdout 信号匹配**：精确但要求用户知道服务输出什么。否决。
