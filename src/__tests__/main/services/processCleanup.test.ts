import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';

vi.mock('@/main/services/processManager', () => ({
  spawnService: vi.fn(),
  killTree: vi.fn(),
}));
vi.mock('@/main/services/shellDetector', () => ({
  resolveShell: vi.fn().mockResolvedValue('cmd.exe'),
}));

import { killTree } from '@/main/services/processManager';
import { WebAppService } from '@/main/services/webAppService';

const mockKillTree = vi.mocked(killTree);

function makeMockChild(pid: number): ChildProcess {
  return { pid } as unknown as ChildProcess;
}

interface InjectResult {
  child: ChildProcess | undefined;
}

/** 直接往 webAppService.apps 注入 entry（绕过真实窗口创建，隔离 kill 逻辑）。 */
function injectEntry(
  svc: WebAppService,
  appId: string,
  opts: { withProcess?: boolean; pid?: number } = {},
): InjectResult {
  const child = opts.withProcess ? makeMockChild(opts.pid ?? 1) : undefined;
  const entry = {
    appId,
    windowId: `win-${appId}`,
    viewId: `view-${appId}`,
    titlebarViewId: `tb-${appId}`,
    url: 'http://localhost:3000',
    title: appId,
    faviconUrl: '',
    service: { command: 'npm start', shell: 'auto' },
    serviceProcess: child ? { child, pid: child.pid } : undefined,
  };
  (svc as unknown as { apps: Map<string, unknown> }).apps.set(appId, entry);
  return { child: child };
}

describe('Spec 05: 进程清理双保险', () => {
  let svc: WebAppService;

  beforeEach(() => {
    mockKillTree.mockReset();
    svc = new WebAppService();
  });

  it('killAllServiceProcesses 扫杀所有服务型 app 进程', () => {
    const r1 = injectEntry(svc, 'app-1', { withProcess: true, pid: 111 });
    const r2 = injectEntry(svc, 'app-2', { withProcess: true, pid: 222 });

    svc.killAllServiceProcesses();

    expect(mockKillTree).toHaveBeenCalledTimes(2);
    expect(mockKillTree).toHaveBeenCalledWith(r1.child);
    expect(mockKillTree).toHaveBeenCalledWith(r2.child);
  });

  it('killAllServiceProcesses 幂等：kill 后 entry.serviceProcess 置空，再调不重复', () => {
    injectEntry(svc, 'app-1', { withProcess: true, pid: 111 });

    svc.killAllServiceProcesses();
    svc.killAllServiceProcesses();

    expect(mockKillTree).toHaveBeenCalledTimes(1);
  });

  it('普通型 app（无 serviceProcess）跳过 kill', () => {
    injectEntry(svc, 'app-normal'); // 无 withProcess

    svc.killAllServiceProcesses();

    expect(mockKillTree).not.toHaveBeenCalled();
  });

  it('混合：服务型 + 普通型 → 只 kill 服务型', () => {
    injectEntry(svc, 'app-svc', { withProcess: true, pid: 111 });
    injectEntry(svc, 'app-normal');

    svc.killAllServiceProcesses();

    expect(mockKillTree).toHaveBeenCalledTimes(1);
  });

  it('kill 后 entry.serviceProcess 被置空（供 before-quit 二次扫杀跳过）', () => {
    injectEntry(svc, 'app-1', { withProcess: true, pid: 111 });
    svc.killAllServiceProcesses();

    const apps = (svc as unknown as { apps: Map<string, { serviceProcess: unknown }> }).apps;
    const entry = apps.get('app-1');
    expect(entry?.serviceProcess).toBeNull();
  });
});
