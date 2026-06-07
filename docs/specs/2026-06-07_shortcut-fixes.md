# SDD Spec: 桌面快捷方式系统修复

## 0. Open Questions

- [x] 是否需要 macOS/Linux 支持？→ 当前项目仅面向 Windows（Electron .ico + `shell.writeShortcutLink`），本次只做平台安全保护，不做跨平台实现
- [x] `removeShortcut` API 是否需要 UI 入口？→ 需要，菜单中已有 Create Shortcut，应提供 Remove Shortcut 切换逻辑
- [x] shortcut 模式下第二实例普通启动的处理方式？→ 检测到无主窗口时调用 `createMainWindow()` 创建一个
- [x] 快捷方式图标缺失 → 根因：`extraResources` 未包含 `app/` 图标 + 无 per-app favicon 图标

## 1. Requirements (Context)

- **Goal**: 修复提交 `b4e50ec` 中桌面快捷方式系统的健壮性、平台安全、图标缺失、用户体验和边缘场景问题
- **In-Scope**:
  1. `shortcutService.ts` 平台保护 + `sanitizeFileName` 完整化 + favicon 图标
  2. `removeDesktopShortcut` 改为异步文件扫描
  3. 快捷方式使用 per-app favicon 图标（视觉区分）
  4. `electron-builder.config.mjs` 补充 `app/` 图标到 `extraResources`
  5. `WebCatalog` 菜单增加 Create/Remove Shortcut 状态切换 + 成功反馈
  6. `index.ts` shortcut 模式下第二实例普通启动时创建主窗口
  7. E2E 测试覆盖快捷方式 UI 交互
- **Out-of-Scope**:
  - 不做 macOS/Linux 快捷方式实现（`shell.writeShortcutLink` 是 Windows-only）
  - 不动 favicon 获取逻辑 / titlebar / session 相关逻辑
  - 不改 `--open-app` CLI 参数解析逻辑

## 1.1 Context Sources

- Requirement Source: 提交 `b4e50ec` 代码分析（8 个问题）
- Code Refs: `shortcutService.ts`, `webAppService.ts`, `index.ts`, `WebCatalog/index.tsx`, `webAppApi.ts`, `electron-builder.config.mjs`
- E2E Pattern: `tests/e2e/webCatalog.spec.ts` — Playwright + Electron, `electronApp` fixture, `data-testid` 选择器

## 1.7 Minimum Chaos Unit Assessment

- **Final Goal**: 桌面快捷方式系统达到可生产使用质量
- **Current Task Unit**: 一次性修复 8 个已识别问题 + E2E 覆盖
- **Why this unit is small enough**: 所有修改集中在 5 个文件 + 1 个构建配置 + 1 个测试文件，每个修改点明确且独立
- **In-Scope Boundary**: shortcut 相关代码路径 + 图标打包配置 + E2E 测试
- **Out-of-Scope Boundary**: favicon 获取逻辑 / titlebar / session / updater / tray
- **Verification Evidence**: `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` + `pnpm run build` + `pnpm run test:e2e`
- **Failure / Rework Plan**: 逐项修复，单点失败不影响其他修复项
- **User Decision**: Accepted

## 2. Research Findings

### 事实与约束

1. **`shell.writeShortcutLink` / `readShortcutLink` 是 Windows-only API**（Electron 文档明确标注）
   - macOS/Linux 调用会抛异常或返回 undefined
   - 项目现有平台判断模式：`process.platform === 'win32'` / `'darwin'` / `'linux'`

2. **`sanitizeFileName` 当前只替换 `<>:"/\\|?*`**，缺失：
   - 空字符串保护（title 全是特殊字符）
   - Windows 保留名（CON, PRN, AUX, NUL, COM1-9, LPT1-9）
   - 尾部点号/空格（Windows 不允许）

3. **`removeDesktopShortcut` 使用 `fs.readdirSync` 同步扫描桌面**
   - 主进程同步 I/O 阻塞，桌面文件多时影响响应
   - 应改为 `fs.promises.readdir`

4. **`createDesktopShortcut` 无 idempotent 保护**
   - Electron `writeShortcutLink('create', ...)` 对已存在的 .lnk 行为是覆盖
   - 实测安全，不需要额外保护

5. **`removeDesktopShortcut` 只删第一个匹配**
   - 理论上不应有重复，但改用 while 循环删除所有匹配更安全

6. **UI 无 Remove Shortcut 入口**
   - `removeShortcut` API 存在但无消费方
   - 需要在 AppCard 菜单中根据快捷方式是否存在切换 Create/Remove

7. **shortcut 模式下第二实例普通启动静默无反应**
   - `windowManager.getWindow('main')` 返回 undefined，else 分支什么都不做
   - 应在此分支创建主窗口

8. **快捷方式图标缺失（用户反馈）**
   - 根因 A：`electron-builder.config.mjs` 的 `extraResources` 只复制 `tray/`，不包含 `app/`
   - 打包后 `paths.getIconPath()/app/icon.ico` 不存在
   - 根因 B：所有快捷方式共用同一通用图标，无法区分不同 web app
   - 修复方案：
     a. `extraResources` 增加 `app/` 图标目录（兜底默认图标）
     b. `createDesktopShortcut` 改为使用 per-app favicon 作为快捷方式图标
     c. 从 `getCachedFaviconDataUrlSync(appId)` 获取 favicon data URL
     d. 用 `nativeImage.createFromDataURL()` + `toPNG()` 写入 `~/.web-nest/.cache/shortcut-icons/{appId}.png`
     e. 将 PNG 封装为合法 ICO 格式（6字节 ICO header + 16字节目录项 + PNG payload）
     f. 保存到 `~/.web-nest/.cache/shortcut-icons/{appId}.ico`
     g. `.lnk` 的 `icon` 指向该 .ico 文件
     h. 无 favicon 时 fallback 到默认 `app/icon.ico`
     i. `removeDesktopShortcut` 时同时清理对应 .ico 文件

### E2E 测试约束

- 现有 fixture 用 `WEB_NEST_HOME` 隔离数据目录，但 `app.getPath('desktop')` 指向真实桌面
- `.lnk` 文件会写入测试机器的真实桌面，测试需确保清理
- 现有 `webCatalog.spec.ts` 每个测试独立创建 `about:blank` app
- `webapp-shortcut-btn` 已有 `data-testid`，但当前只有 Create 按钮，需要支持 Create/Remove 两种状态

### 风险与不确定项

- 快捷方式"是否存在"的检测需要扫描桌面 .lnk 文件，可能较慢；首次简单实现用扫描即可，桌面 .lnk 数量通常不多
- ICO-PNG 格式（ICO header + PNG payload）自 Windows Vista 起支持，当前项目仅面向 Windows，无兼容性问题
- E2E 测试在桌面创建真实 .lnk 文件，需确保测试后清理（包括测试中断时）

## 2.1 Next Actions

- 进入 Plan，确定每个修复项的具体文件改动和签名

## 3. Innovate — Skipped

- Skipped: true
- Reason: 所有修复点明确，无需方案对比

## 4. Plan (Contract)

### 4.1 File Changes

- `src/main/services/shortcutService.ts`: 平台保护 + sanitizeFileName 完整化 + 异步扫描 + favicon 图标 + hasShortcut + 删除所有匹配
- `src/main/index.ts`: second-instance handler 中无主窗口时创建主窗口
- `src/main/services/webAppService.ts`: `createShortcut` / `removeShortcut` 增加平台保护 + favicon 图标集成；新增 `hasShortcut(id)` 方法
- `src/shared/services/webAppApi.ts`: 新增 `hasShortcut(id): Promise<boolean>` 抽象方法
- `src/renderer/components/WebCatalog/index.tsx`: 菜单 Create/Remove Shortcut 状态切换 + 成功反馈 toast
- `electron-builder.config.mjs`: `extraResources` 增加 `build/icons/app` → `icons/app`
- `tests/e2e/webCatalog.spec.ts`: 新增 3 个快捷方式 E2E 用例

### 4.2 Signatures

#### shortcutService.ts

```typescript
// 改为内部函数
function sanitizeFileName(title: string): string
// 新增：favicon data URL → .ico 文件
function writeFaviconIco(appId: string, faviconDataUrl: string): string | undefined
// 返回值 void → boolean；加平台保护 + favicon 图标
export function createDesktopShortcut(appId: string, title: string, faviconDataUrl?: string): boolean
// 同步改异步；删除所有匹配 + 清理 .ico 文件
export async function removeDesktopShortcut(appId: string): Promise<void>
// 新增：检测快捷方式是否存在
export async function hasDesktopShortcut(appId: string): Promise<boolean>
// 新增：平台是否支持快捷方式
export function isShortcutSupported(): boolean
```

#### webAppApi.ts

```typescript
abstract class WebAppMainApi {
  // 已有
  abstract createShortcut(id: string): Promise<void>
  abstract removeShortcut(id: string): Promise<void>
  // 新增
  abstract hasShortcut(id: string): Promise<boolean>
}
```

#### webAppService.ts

```typescript
class WebAppService {
  // 已有签名不变
  async createShortcut(id: string): Promise<void>
  async removeShortcut(id: string): Promise<void>
  // 新增
  async hasShortcut(id: string): Promise<boolean>
}
```

#### electron-builder.config.mjs

```javascript
extraResources: [
  { from: 'build/icons/tray', to: 'icons/tray' },
  { from: 'build/icons/app', to: 'icons/app' },  // 新增
]
```

### 4.3 Implementation Checklist

- [ ] 1. **shortcutService.ts**: 新增 `isShortcutSupported()` — `process.platform === 'win32'`
- [ ] 2. **shortcutService.ts**: 完善 `sanitizeFileName` — 空字符串 fallback、保留名检测、尾部点号/空格清理
- [ ] 3. **shortcutService.ts**: 新增 `writeFaviconIco(appId, faviconDataUrl)` — 从 data URL 生成 .ico 文件到 `shortcut-icons/` 缓存目录
- [ ] 4. **shortcutService.ts**: `createDesktopShortcut` 加平台保护 + favicon 图标集成（有 favicon 用 favicon .ico，否则 fallback 默认 icon.ico），透传返回值 boolean
- [ ] 5. **shortcutService.ts**: `removeDesktopShortcut` 改异步，删除所有匹配项，同时清理 `shortcut-icons/{appId}.ico`
- [ ] 6. **shortcutService.ts**: 新增 `hasDesktopShortcut(appId)` — 异步扫描桌面 .lnk 匹配
- [ ] 7. **webAppApi.ts**: 新增 `abstract hasShortcut(id: string): Promise<boolean>`
- [ ] 8. **webAppService.ts**: 实现 `hasShortcut`；`createShortcut` 传入 faviconDataUrl；`createShortcut` / `removeShortcut` 平台不支持时抛友好错误
- [ ] 9. **index.ts**: `second-instance` handler else 分支 — 无主窗口时调用 `createMainWindow()` + `appTray.create()`
- [ ] 10. **electron-builder.config.mjs**: `extraResources` 增加 `build/icons/app` → `icons/app`
- [ ] 11. **WebCatalog/index.tsx**: AppCard 增加 `shortcutExists` state，菜单根据状态显示 Create/Remove，操作成功后切换状态；增加 `data-testid="webapp-remove-shortcut-btn"` 用于 Remove 按钮
- [ ] 12. **webCatalog.spec.ts**: 新增 3 个 E2E 用例（见 4.4）

### 4.4 E2E Test Cases

在 `tests/e2e/webCatalog.spec.ts` 中追加以下用例：

| # | 用例名 | 步骤 | 验证点 |
|---|---|---|---|
| 1 | `hover menu shows create shortcut button` | 创建 app → hover → 打开菜单 | `webapp-shortcut-btn` 可见，文本为 "Create Shortcut" |
| 2 | `clicking create shortcut toggles to remove shortcut` | 创建 app → hover → 点击 "Create Shortcut" → 重新打开菜单 | "Remove Shortcut" 按钮（`webapp-remove-shortcut-btn`）可见 |
| 3 | `clicking remove shortcut toggles back to create` | 承接 #2 → 点击 "Remove Shortcut" → 重新打开菜单 | "Create Shortcut" 按钮（`webapp-shortcut-btn`）可见 |

**实现模式**：复用现有 `webCatalog.spec.ts` 的 "创建 about:blank app → hover → menu" 模式。

**data-testid 约定**：
- `webapp-shortcut-btn` — Create Shortcut 按钮（已有）
- `webapp-remove-shortcut-btn` — Remove Shortcut 按钮（新增）

**清理策略**：E2E fixture 的 `afterAll` 已自动关闭 app 并清理 `WEB_NEST_HOME`，但桌面 .lnk 文件需在测试内手动清理（通过 `removeShortcut` API 或 app 删除流程）。

### 4.5 Spec Review Notes (Optional Advisory, Pre-Execute)

- Spec Review Matrix:
  | Check | Verdict | Evidence |
  |---|---|---|
  | Requirement clarity & acceptance | PASS | 8 个问题 + E2E 用例均有明确验证标准 |
  | Plan executability | PASS | 文件路径 + 签名 + checklist 原子化 |
  | Risk / rollback readiness | PASS | 低风险，逐项独立修复 |
- Readiness Verdict: GO
