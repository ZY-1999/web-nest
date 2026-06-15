# Feature Spec: 全局配置管理 UI + main 入口代码整理

> Status: MCU-1~5 Complete, Ready for Manual Testing
> Phase: Execute Done → Review
> Created: 2026-06-10
> Updated: 2026-06-10

---

## 1. 目标

### 1A. 全局配置管理 UI
后端 `settingsService` + `settingsApi` 已完整实现，但 renderer 无任何 UI 入口。需要：
- 标题栏添加「设置」按钮（齿轮图标）
- 实现 SettingsDialog 弹窗组件，接入 `settingsApi` 的 `getSettings` / `setSettings`
- 各配置项表单：locale、autoLaunch、disableGpu（含重启提示）、proxy（mode + host + port + 测试连接）、userAgent
- i18n 补齐 settings 相关翻译 key（zh-CN + en）

### 1B. main/index.ts 代码整理
`second-instance` handler 和 `whenReady` 回调的 normal mode 存在重复的「创建主窗口 + tray + registerMainServices」逻辑，提取为共享函数消除重复。

---

## 2. In Scope

| 范围 | 说明 |
|---|---|
| main/index.ts 重构 | 提取 `launchManagementWindow()` 合并重复逻辑 |
| SettingsDialog 组件 | 新建 `src/renderer/components/SettingsDialog/` |
| 标题栏设置按钮 | `TitleBar/index.tsx` 添加齿轮按钮 |
| i18n key | zh-CN.json + en.json 新增 settings 命名空间 |
| proxy 测试连接 | 新增 `settingsApi.testProxy(config)` IPC 方法 |
| settingsService 扩展 | 新增 `testProxy()` 后端方法 |

## 3. Out of Scope

- 不重写 settingsService 后端逻辑（仅新增 testProxy）
- 不修改 AppSettings 类型（除非有新增配置项）
- 不改动 webAppService / WebAppWindowService / mainWindow.ts / preload
- 不实现设置导入/导出/重置
- ThemeToggle 保持独立，SettingsDialog 不含 theme 切换
- 不动 IPC channel / serviceRegistry 基础设施

---

## 4. 已有上下文

### 关键文件
| 文件 | 角色 |
|---|---|
| `src/main/index.ts` | 入口整理目标 |
| `src/main/services/settingsService.ts` | 后端配置 CRUD + applyRuntimeEffects |
| `src/shared/settings.ts` | AppSettings 类型 + DEFAULT_SETTINGS |
| `src/shared/services/settingsApi.ts` | settings IPC API（含 ProxyTestConfig/ProxyTestResult） |
| `src/renderer/components/TitleBar/index.tsx` | 标题栏（添加按钮入口） |
| `src/renderer/components/ThemeToggle/index.tsx` | 主题切换（保留独立） |
| `src/shared/i18n/locales/zh-CN.json` / `en.json` | 翻译文件 |

---

## 5. MCU 拆分与执行结果

### MCU-1: main/index.ts 代码整理 ✅
- 提取 `launchManagementWindow()` 函数
- `second-instance` fallback 和 `whenReady` normal mode 共享调用
- typecheck ✅ + 151 tests ✅

### MCU-2: 标题栏添加设置按钮 ✅
- `TitleBar/index.tsx` 添加齿轮图标（`Settings` from lucide-react）
- `data-testid="open-settings"`
- 右侧区域：齿轮 → ThemeToggle

### MCU-3: SettingsDialog 组件实现 ✅
- 新建 `src/renderer/components/SettingsDialog/index.tsx`
- 4 个分组：外观（locale）→ 通用（autoLaunch + disableGpu + 重启提示）→ 网络（proxy + 测试连接）→ 高级（userAgent）
- draft 模式：编辑不立即生效，点保存才提交
- 保存后 locale 变化自动同步 `changeLocale()`

### MCU-4: i18n 翻译 key ✅
- `settings.*` 命名空间，zh-CN + en 各 18 个 key

### MCU-5: Proxy 测试连接 ✅
- `settingsApi.ts` 新增 `ProxyTestConfig` / `ProxyTestResult` 类型 + `testProxy()` 抽象方法
- `settingsService.ts` 实现：临时 session + `net.request` + 5s 超时
- 前端测试按钮 + 结果展示（成功绿色/失败红色）

---

## 6. 实际改动文件清单

| 文件 | 操作 |
|---|---|
| `src/main/index.ts` | 修改：提取 `launchManagementWindow()` |
| `src/main/services/settingsService.ts` | 修改：新增 `testProxy()` + import `net` |
| `src/shared/services/settingsApi.ts` | 修改：新增 `ProxyTestConfig` / `ProxyTestResult` + `testProxy()` 抽象方法 |
| `src/renderer/components/TitleBar/index.tsx` | 修改：添加齿轮按钮 + SettingsDialog |
| `src/renderer/components/SettingsDialog/index.tsx` | **新建**：完整设置弹窗组件 |
| `src/shared/i18n/locales/zh-CN.json` | 修改：新增 `settings.*` + `titlebar.openSettings` |
| `src/shared/i18n/locales/en.json` | 修改：新增 `settings.*` + `titlebar.openSettings` |

---

## 7. 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm run typecheck` | ✅ 通过 |
| `pnpm run test` | ✅ 151 tests passed |
| `pnpm run build` | ✅ 构建成功（5.68s） |

---

## 8. Plan-Execution Diff

- **testProxy 实现方案变更**：原计划用 `net.fetch` + `proxy` 参数，发现 Electron `net.fetch` 的 `RequestInit` 不支持 `proxy` 选项。改为临时 session + `net.request` + `setTimeout` 手动超时管理。
- **Theme 展示**：原计划 SettingsDialog 只读展示 theme，实际实现中省略了 theme 展示（ThemeToggle 独立保留即可，弹窗无需重复展示）。

---

## 9. Done Contract

- [x] `pnpm run typecheck` 通过
- [x] `pnpm run test` 通过
- [x] `pnpm run build` 通过
- [ ] 标题栏显示齿轮按钮，点击弹出设置弹窗
- [ ] 弹窗中修改 locale 后 UI 语言切换生效
- [ ] 弹窗中切换 autoLaunch 后系统登录项正确变化
- [ ] 弹窗中修改 proxy 后保存，`~/.web-nest/settings.json` 正确更新
- [ ] proxy 测试连接按钮返回成功/失败结果
- [ ] disableGpu 开关旁显示重启提示
- [ ] i18n 中英文均完整
- [x] index.ts 中无重复的 launch 逻辑

---

## 10. Change Log

| 时间 | 变更 |
|---|---|
| 2026-06-10 | 初始 Spec 创建 |
| 2026-06-10 | MCU-1~5 执行完成，自动验证通过，待手动测试 |
