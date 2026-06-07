# Favicon 系统健壮性修复

> **层级**: Feature Spec
> **状态**: Plan（修正中）
> **关联**: [[favicon-async]] 原始实现 `b73a514`

## 目标

修复 `b73a514` 代码审查中发现的 2 个实质问题，提升 favicon 加载系统的健壮性。

## 修正后方案

### Fix 1: faviconStore 失败上限（✅ 已实现）

- `FaviconState.status` 增加 `'error'` 状态，`retryCount` 字段
- 轮询回调中 fetch 返回空 → `failRetry()` 累计计数，超 10 次（20s）降级为 `error`
- `requestFavicon` 对 `loading` 态幂等跳过，对 `error` 态允许重试
- `FaviconImg` 在 `error` 状态渲染 `<Fallback />`

**文件**: `src/renderer/stores/faviconStore.ts`, `src/renderer/components/FaviconImg/index.tsx`

### Fix 2: page-favicon-updated debounce（🔄 待修正）

- 新增通用 `debounce` 工具函数到 `src/main/utils/debounce.ts`
- `page-favicon-updated` handler 用 `debounce(fn, 100)` 包装，只有最后一次事件发起 fetch
- 闭包随窗口销毁自动回收，无需手动清理

**文件**: `src/main/utils/debounce.ts`（新增）, `src/main/services/webAppService.ts`

### 已移除的方案（不需要）

- ~~Fix 3: `getFaviconUrlForApp` 缓存~~ — `failRetry` 上限已控制磁盘读取频次（最多 10 次），加缓存层收益不足反而引入一致性问题
- ~~`faviconFetchSeq` 类级 Map~~ — 作用域属于单个窗口闭包，不应提升到类级别；且序号去重不如直接 debounce 回调简洁
- ~~`faviconUrlCache`~~ — 过度设计，已移除

## Validation

- `pnpm run typecheck` ✅
- `pnpm run lint` ✅（1 warning，pre-existing）
- `pnpm run test` ✅（140 passed）
