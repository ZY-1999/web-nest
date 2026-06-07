# SDD Spec: Service Export 格式统一

## 0. Open Questions

- None

## 1. Requirements (Context)

- **Goal**: 将散装函数导出的 service 统一为 `class + export const xxService = new XxxService()` 模式
- **In-Scope**:
  1. `appConfigService.ts` — `loadApps` / `saveApps` → class `AppConfigService` + `export const appConfigService`
  2. `faviconService.ts` — `getCachedFaviconDataUrlSync` / `clearAppFaviconCache` / `fetchFaviconDataUrl` → class `FaviconService` + `export const faviconService`
  3. `shortcutService.ts` — `isShortcutSupported` / `createDesktopShortcut` / `removeDesktopShortcut` / `hasDesktopShortcut` → class `ShortcutService` + `export const shortcutService`
  4. 更新所有消费方调用方式
- **Out-of-Scope**:
  - 不改 `themeService` / `updaterService` / `webAppService`（已符合模式 A）
  - 不改 `webAppWindowService`（模式 C，per-view 实例，保持 class export）
  - 不改 `registerMainServices` 入口
  - 不改行为逻辑，纯格式重构

## 1.7 Minimum Chaos Unit Assessment

- **Final Goal**: service 导出风格统一
- **Current Task Unit**: 3 个文件重构 + 消费方适配
- **Why small enough**: 纯机械重构，无逻辑变更，无架构影响
- **Verification Evidence**: `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` + `pnpm run build`
- **User Decision**: Accepted

## 3. Innovate — Skipped

- Skipped: true
- Reason: 纯格式重构，无方案分歧

## 4. Plan (Contract)

### 4.1 File Changes

- `src/main/services/appConfigService.ts`: 函数 → class AppConfigService + `export const appConfigService`
- `src/main/services/faviconService.ts`: 函数 → class FaviconService + `export const faviconService`
- `src/main/services/shortcutService.ts`: 函数 → class ShortcutService + `export const shortcutService`
- `src/main/services/webAppService.ts`: 更新 import 和调用方式
- `src/main/services/index.ts`: 无需改动（只注册已有的 A 模式 service）
- 可能的测试文件：更新对应 import

### 4.2 Signatures

#### appConfigService.ts

```typescript
class AppConfigService {
  loadApps(configDir: string): PersistedApp[]
  saveApps(configDir: string, apps: PersistedApp[]): void
}
export const appConfigService = new AppConfigService()
```

#### faviconService.ts

```typescript
class FaviconService {
  getCachedFaviconDataUrlSync(appId: string): string | undefined
  clearAppFaviconCache(appId: string): void
  fetchFaviconDataUrl(appId: string, faviconUrl: string): Promise<string>
}
export const faviconService = new FaviconService()
```

#### shortcutService.ts

```typescript
class ShortcutService {
  isShortcutSupported(): boolean
  createDesktopShortcut(appId: string, title: string, faviconDataUrl?: string): boolean
  removeDesktopShortcut(appId: string): Promise<void>
  hasDesktopShortcut(appId: string): Promise<boolean>
}
export const shortcutService = new ShortcutService()
```

#### webAppService.ts（消费方更新）

```typescript
import { appConfigService } from '@/main/services/appConfigService'
import { faviconService } from '@/main/services/faviconService'
import { shortcutService } from '@/main/services/shortcutService'
// 调用: appConfigService.loadApps(...), faviconService.fetchFaviconDataUrl(...), shortcutService.createDesktopShortcut(...)
```

### 4.3 Implementation Checklist

- [ ] 1. `appConfigService.ts`: 函数 → class + const
- [ ] 2. `faviconService.ts`: 函数 → class + const（内部函数 `faviconCachePath` 保留为 private method）
- [ ] 3. `shortcutService.ts`: 函数 → class + const（内部函数 `sanitizeFileName` / `getShortcutIconsDir` / `writeFaviconIco` 保留为 private method）
- [ ] 4. `webAppService.ts`: 更新所有 import 和调用
- [ ] 5. 其他消费方检查和更新
- [ ] 6. 验证: typecheck + lint + test + build
