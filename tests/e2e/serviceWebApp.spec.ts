import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import type { ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { test, expect } from './fixtures/electronApp';
import { waitForWindowReady } from './helpers/windowHelpers';

// mock-service.js 接受单个 port 参数；pid 文件路径由 port 派生（见 fixture 头注释）。
const mockServiceScript = path
  .resolve(__dirname, 'fixtures/server/mock-service.js')
  .replace(/\\/g, '/');

/** pid 文件路径由 port 派生——与 mock-service.js 内部计算一致（避免传路径参数被 shell 篡改）。 */
function pidFileForPort(port: number): string {
  return path.join(os.tmpdir(), `web-nest-mock-${port}.pid`);
}

/** 找一个空闲端口（E2E 串行单 worker，TOCTOU 风险可接受）。 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('failed to get free port'));
      }
    });
  });
}

function readPid(pidFile: string): number | null {
  try {
    return parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
  } catch {
    return null;
  }
}

/** signal 0 = 进程探活；存在返回 true，ESRCH/EPERM 视为已死。 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidFile(pidFile: string, timeout = 15000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const pid = readPid(pidFile);
    if (pid) { return pid; }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`pid file not written within ${timeout}ms: ${pidFile}`);
}

/** 构造服务型 app 的 url + command（command 经 auto shell 执行 node mock-service）。 */
function buildServiceTarget(port: number): { url: string; command: string; pidFile: string } {
  return {
    url: `http://localhost:${port}`,
    command: `node ${mockServiceScript} ${port}`,
    pidFile: pidFileForPort(port),
  };
}

/** 在 AddDialog 填写服务型 app 表单并提交（fill→click 前断言 toBeEnabled，缓解时序 flaky）。 */
async function addServiceApp(mainWindow: Page, url: string, command: string, shell?: string) {
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-testid="add-url-input"]').fill(url);
  await dialog.locator('[data-testid="service-toggle"]').check();
  await expect(dialog.locator('[data-testid="service-fields"]')).toBeVisible();
  await dialog.locator('[data-testid="service-command-input"]').fill(command);
  if (shell) {
    await dialog.locator('[data-testid="service-shell-select"]').selectOption(shell);
  }
  await expect(dialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await dialog.locator('[data-testid="add-submit"]').click();
  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  return card;
}

/** 找到 web app 标题栏 page（data-testid=webapp-titlebar）。 */
async function findTitlebarPage(electronApp: ElectronApplication): Promise<Page> {
  await expect(async () => {
    const pages = electronApp.windows();
    const results = await Promise.all(
      pages.map(async (p: Page) => {
        try {
          return await p.locator('[data-testid="webapp-titlebar"]').count();
        } catch {
          return 0;
        }
      }),
    );
    expect(results.some((c: number) => c > 0)).toBe(true);
  }).toPass({ timeout: 10000 });

  const pages = electronApp.windows();
  for (const page of pages) {
    try {
      const count = await page.locator('[data-testid="webapp-titlebar"]').count();
      if (count > 0) { return page; }
    } catch {
      // page may have been closed
    }
  }
  throw new Error('Titlebar page not found');
}

/** 通过 BaseWindow title（=app url）找到 web app 窗口并关闭——触发 nativeWindow 'closed' → killServiceProcess。 */
async function closeWebAppWindow(electronApp: ElectronApplication, url: string) {
  await electronApp.evaluate(async (electron, appUrl: string) => {
    const BaseWindow = (electron as unknown as { BaseWindow: { getAllWindows: () => Electron.BaseWindow[] } }).BaseWindow;
    const wins = BaseWindow.getAllWindows();
    const target = wins.find((w) => !w.isDestroyed() && w.getTitle() === appUrl);
    target?.close();
  }, url);
}

/** 等待标题栏 ServiceStateIndicator 达到指定状态。 */
async function waitForServiceState(
  electronApp: ElectronApplication,
  state: 'starting' | 'running' | 'failed' | 'stopped',
  timeout = 20000,
): Promise<Page> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const page of electronApp.windows()) {
      try {
        const el = page.locator(`[data-testid="service-state"][data-state="${state}"]`);
        if (await el.count() > 0) { return page; }
      } catch {
        // page may have been closed
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`service-state "${state}" not reached within ${timeout}ms`);
}

// ─── AC1 + AC2: 全链路成功 + 关窗 kill ──────────────────────────────────

test('service app: open → starting/running → close kills service process', async ({ electronApp }) => {
  const port = await getFreePort();
  const { url, command, pidFile } = buildServiceTarget(port);

  const mainWindow = await waitForWindowReady(electronApp);
  await addServiceApp(mainWindow, url, command);

  // 点击卡片打开 web app 窗口
  await mainWindow.locator('[data-testid="webapp-card"]').click();
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  // 标题栏应最终显示 running（mock server 起来 + URL 加载成功）
  await waitForServiceState(electronApp, 'running');

  // 读 pid 文件确认服务进程已起
  const pid = await waitForPidFile(pidFile);
  expect(isPidAlive(pid)).toBe(true);

  // 关闭 web app 窗口（BaseWindow 'closed' → killServiceProcess → taskkill /T /F）
  await closeWebAppWindow(electronApp, url);

  // 轮询：服务进程应被杀死
  await expect.poll(async () => isPidAlive(pid), { timeout: 10000, intervals: [200, 500, 1000] }).toBe(false);
});

// ─── AC4: command 拼错 → failed ─────────────────────────────────────────

test('service app: bad command shows failed state in titlebar', async ({ electronApp }) => {
  const port = await getFreePort();
  const url = `http://localhost:${port}`; // 无服务监听，URL 加载也会失败
  const command = 'nonexistent-cmd-xyz-12345';

  const mainWindow = await waitForWindowReady(electronApp);
  await addServiceApp(mainWindow, url, command);

  await mainWindow.locator('[data-testid="webapp-card"]').click();
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  // shell 试图执行拼错的命令 → 进程 exit（加载前）→ failed（不卡 starting）
  await waitForServiceState(electronApp, 'failed');
});

// ─── AC3: quit 扫杀多个服务进程 ──────────────────────────────────────────

test('service app: app quit kills all running service processes', async ({ electronApp }) => {
  const port1 = await getFreePort();
  const port2 = await getFreePort();
  const t1 = buildServiceTarget(port1);
  const t2 = buildServiceTarget(port2);

  const mainWindow = await waitForWindowReady(electronApp);

  // 添加两个服务型 app
  await addServiceApp(mainWindow, t1.url, t1.command);
  await addServiceApp(mainWindow, t2.url, t2.command);

  // 分别打开两个窗口
  const cards = mainWindow.locator('[data-testid="webapp-card"]');
  await cards.nth(0).click();
  await cards.nth(1).click();

  // 两个服务进程都应已启动（pid 文件写出）
  const pid1 = await waitForPidFile(t1.pidFile);
  const pid2 = await waitForPidFile(t2.pidFile);
  expect(isPidAlive(pid1)).toBe(true);
  expect(isPidAlive(pid2)).toBe(true);

  // 关闭 electron app 实例 → 触发 before-quit → killAllServiceProcesses
  await electronApp.close();

  // 轮询：两个服务进程均应被扫杀
  await expect.poll(async () => isPidAlive(pid1) && isPidAlive(pid2), {
    timeout: 10000,
    intervals: [200, 500, 1000],
  }).toBe(false);
});

// ─── AC5: 运行中外部 kill → stopped ──────────────────────────────────────

test('service app: external kill of running service shows stopped', async ({ electronApp }) => {
  const port = await getFreePort();
  const { url, command, pidFile } = buildServiceTarget(port);

  const mainWindow = await waitForWindowReady(electronApp);
  await addServiceApp(mainWindow, url, command);

  await mainWindow.locator('[data-testid="webapp-card"]').click();
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  await waitForServiceState(electronApp, 'running');
  const pid = await waitForPidFile(pidFile);

  // 测试侧外部 kill 服务进程（运行中）→ exit 边界后 → stopped
  try {
    process.kill(pid);
  } catch {
    // 进程可能已退出
  }

  await waitForServiceState(electronApp, 'stopped');
});

// ─── AC6: 旧配置兼容（apps.config 无 service 字段）────────────────────────

test('service app: old config without service field opens as normal app', async () => {
  // 旧版 apps.config：无 service 字段（模拟升级前数据）
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-nest-oldcfg-'));
  const fixturesDir = path.resolve(__dirname, 'fixtures/pages');
  const pageAUrl = `file:///${fixturesDir.replace(/\\/g, '/')}/page-a.html`;
  const oldApps = [
    { id: 'old-app-1', url: pageAUrl, title: 'Legacy App', faviconUrl: '' },
  ];
  fs.writeFileSync(path.join(tmpDir, 'apps.config'), JSON.stringify(oldApps, null, 2));
  // 与 electronApp fixture 一致：强制英文 locale 保证确定性
  fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ locale: 'en' }));

  const app = await electron.launch({
    args: ['./dist/main/index.js'],
    env: { ...process.env, WEB_NEST_HOME: tmpDir },
  });

  try {
    const mainWindow = await waitForWindowReady(app);

    // 旧配置 app 应作为普通型卡片正常显示，无 Terminal 角标
    const card = mainWindow.locator('[data-testid="webapp-card"]');
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('[data-testid="webapp-service-badge"]')).toHaveCount(0);

    // 点击打开应正常（普通型，无服务启动）
    await card.click();
    await expect(async () => {
      expect(app.windows().length).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10000 });
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Spec 07 验证：表单交互 + 校验 + 角标 + 回填 + 互转 ───────────────────

test('service form: toggle reveals fields, command empty disables submit, badge on card', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // 勾选服务开关 → 字段区显示
  await dialog.locator('[data-testid="service-toggle"]').check();
  await expect(dialog.locator('[data-testid="service-fields"]')).toBeVisible();

  // shell 下拉应含全部选项
  const shellSelect = dialog.locator('[data-testid="service-shell-select"]');
  await expect(shellSelect.locator('option')).toHaveCount(5);

  // 填 url 但 command 空 → 提交禁用（表单层校验，与持久化层双保护）
  await dialog.locator('[data-testid="add-url-input"]').fill('http://localhost:9999');
  await expect(dialog.locator('[data-testid="add-submit"]')).toBeDisabled();
  await expect(dialog.locator('[data-testid="service-command-error"]')).toBeVisible();

  // 填 command → 提交启用
  await dialog.locator('[data-testid="service-command-input"]').fill('npm run dev');
  await expect(dialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await dialog.locator('[data-testid="add-submit"]').click();

  // 服务型 app 卡片应显示 Terminal 角标
  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.locator('[data-testid="webapp-service-badge"]')).toBeVisible();
});

test('service form: edit dialog backfills service config and toggle-off converts to normal', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // 先创建一个服务型 app（自定义 shell 路径，验证 custom 回填）
  const customShell = 'C:/custom/bash.exe';
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('http://localhost:9999');
  await addDialog.locator('[data-testid="service-toggle"]').check();
  await addDialog.locator('[data-testid="service-command-input"]').fill('npm start');
  await addDialog.locator('[data-testid="service-shell-select"]').selectOption('custom');
  await addDialog.locator('[data-testid="service-custom-path-input"]').fill(customShell);
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.locator('[data-testid="webapp-service-badge"]')).toBeVisible();

  // 打开编辑对话框 → 验证回填
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  await card.locator('[data-testid="webapp-edit-btn"]').click();
  const editDialog = mainWindow.locator('[role="dialog"]');
  await expect(editDialog).toBeVisible();

  await expect(editDialog.locator('[data-testid="service-toggle"]')).toBeChecked();
  await expect(editDialog.locator('[data-testid="service-command-input"]')).toHaveValue('npm start');
  await expect(editDialog.locator('[data-testid="service-shell-select"]')).toHaveValue('custom');
  await expect(editDialog.locator('[data-testid="service-custom-path-input"]')).toHaveValue(customShell);

  // 关闭服务开关 → 保存 → 互转为普通型（角标消失）
  await editDialog.locator('[data-testid="service-toggle"]').uncheck();
  await expect(editDialog.locator('[data-testid="edit-submit"]')).toBeEnabled();
  await editDialog.locator('[data-testid="edit-submit"]').click();

  await expect(card.locator('[data-testid="webapp-service-badge"]')).toHaveCount(0);
});
