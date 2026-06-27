import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

vi.mock('@/main/services/shellDetector', () => ({
  resolveShell: vi.fn(),
}));
vi.mock('@/main/services/processManager', () => ({
  spawnService: vi.fn(),
}));

import { resolveShell } from '@/main/services/shellDetector';
import { spawnService, type SpawnHandlers, type SpawnResult } from '@/main/services/processManager';
import { launchServiceApp, type ServiceLaunchTarget } from '@/main/services/serviceAppLauncher';

const mockResolveShell = vi.mocked(resolveShell);
const mockSpawnService = vi.mocked(spawnService);

interface MockSpawn {
  child: ChildProcess;
  emitExit: (code: number | null) => void;
  emitError: (err: Error) => void;
}

function makeMockSpawn(pid = 12345): MockSpawn {
  const handlers: SpawnHandlers = {};
  const child = new EventEmitter() as unknown as ChildProcess;
  Object.defineProperty(child, 'pid', { value: pid, configurable: true });
  (child as unknown as { kill: ReturnType<typeof vi.fn> }).kill = vi.fn();
  mockSpawnService.mockImplementation((_cmd, _shell, h) => {
    Object.assign(handlers, h);
    return { child, pid } as SpawnResult;
  });
  return {
    child,
    emitExit: (code) => handlers.onExit?.(code, null),
    emitError: (err) => handlers.onError?.(err),
  };
}

function makeMockTarget(url = 'http://localhost:3000') {
  const failListeners: Array<() => void> = [];
  const finishListeners: Array<() => void> = [];
  const loadUrl = vi.fn().mockResolvedValue(undefined);
  const target: ServiceLaunchTarget = {
    url,
    loadUrl,
    onDidFailLoad: (l) => failListeners.push(l),
    onDidFinishLoad: (l) => finishListeners.push(l),
    isDestroyed: () => false,
  };
  return {
    target,
    loadUrl,
    emitFail: () => failListeners.forEach((l) => l()),
    emitFinish: () => finishListeners.forEach((l) => l()),
  };
}

describe('serviceAppLauncher', () => {
  beforeEach(() => {
    mockResolveShell.mockResolvedValue('cmd.exe');
    mockSpawnService.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('成功路径：resolveShell → spawn → starting → didFinishLoad → running', async () => {
    makeMockSpawn();
    const { target, emitFinish } = makeMockTarget();
    const onStateChange = vi.fn();

    const handle = await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange });

    expect(mockResolveShell).toHaveBeenCalledWith('auto');
    expect(mockSpawnService).toHaveBeenCalledWith('npm start', 'cmd.exe', expect.any(Object));
    expect(onStateChange).toHaveBeenCalledWith('starting', undefined);

    emitFinish();
    expect(onStateChange).toHaveBeenCalledWith('running', undefined);
    expect(handle.process?.pid).toBe(12345);
    handle.cleanup();
  });

  it('URL 重试退避：500ms → 1000ms → 2000ms（封顶）', async () => {
    makeMockSpawn();
    const { target, loadUrl, emitFail } = makeMockTarget();
    await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange: () => {} });

    emitFail();
    await vi.advanceTimersByTimeAsync(499);
    expect(loadUrl).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadUrl).toHaveBeenCalledTimes(1); // 500ms

    emitFail();
    await vi.advanceTimersByTimeAsync(999);
    expect(loadUrl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadUrl).toHaveBeenCalledTimes(2); // 1000ms

    emitFail();
    await vi.advanceTimersByTimeAsync(1999);
    expect(loadUrl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadUrl).toHaveBeenCalledTimes(3); // 2000ms（封顶）
  });

  it('重试总超时 30s → failed「服务可能未就绪」+ 仍 loadURL 一次', async () => {
    makeMockSpawn();
    const { target, loadUrl } = makeMockTarget();
    const onStateChange = vi.fn();

    await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange });
    const callsBeforeTimeout = loadUrl.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30000);

    expect(onStateChange).toHaveBeenCalledWith('failed', expect.stringContaining('timeout'));
    expect(loadUrl.mock.calls.length).toBeGreaterThanOrEqual(callsBeforeTimeout + 1);
  });

  it('失败矩阵·spawn 失败（onError）→ failed，停止重试', async () => {
    const mock = makeMockSpawn();
    const { target, loadUrl, emitFail } = makeMockTarget();
    const onStateChange = vi.fn();

    await launchServiceApp({ command: 'bad', shell: 'auto' }, target, { onStateChange });

    mock.emitError(new Error('spawn ENOENT'));
    expect(onStateChange).toHaveBeenCalledWith('failed', 'spawn ENOENT');

    const callsAfterFail = loadUrl.mock.calls.length;
    emitFail();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loadUrl.mock.calls.length).toBe(callsAfterFail); // 停止重试
  });

  it('失败矩阵·加载前进程 exit → failed（附 exit code），提前结束重试', async () => {
    const mock = makeMockSpawn();
    const { target, loadUrl, emitFail } = makeMockTarget();
    const onStateChange = vi.fn();

    await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange });

    mock.emitExit(1);
    expect(onStateChange).toHaveBeenCalledWith('failed', expect.stringContaining('code 1'));

    const callsAfterFail = loadUrl.mock.calls.length;
    emitFail();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loadUrl.mock.calls.length).toBe(callsAfterFail); // 提前结束重试
  });

  it('失败矩阵·运行中 exit（已 running）→ stopped（不 failed、不重启）', async () => {
    const mock = makeMockSpawn();
    const { target, emitFinish } = makeMockTarget();
    const onStateChange = vi.fn();

    await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange });
    emitFinish();
    expect(onStateChange).toHaveBeenLastCalledWith('running', undefined);

    mock.emitExit(0);
    expect(onStateChange).toHaveBeenLastCalledWith('stopped', expect.stringContaining('code 0'));

    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).not.toContain('failed');
  });

  it('exit 边界：didFinishLoad 前 exit=failed；didFinishLoad 后 exit=stopped', async () => {
    // 前 exit = failed
    const before = makeMockSpawn();
    const beforeTarget = makeMockTarget();
    const beforeStates = vi.fn();
    await launchServiceApp({ command: 'x', shell: 'auto' }, beforeTarget.target, { onStateChange: beforeStates });
    before.emitExit(1);
    expect(beforeStates).toHaveBeenCalledWith('failed', expect.any(String));

    // 后 exit = stopped
    const after = makeMockSpawn();
    const afterTarget = makeMockTarget();
    const afterStates = vi.fn();
    await launchServiceApp({ command: 'x', shell: 'auto' }, afterTarget.target, { onStateChange: afterStates });
    afterTarget.emitFinish(); // loaded=true
    after.emitExit(0);
    const states = afterStates.mock.calls.map((c) => c[0]);
    expect(states).toContain('running');
    expect(states).toContain('stopped');
    expect(states).not.toContain('failed');
  });

  it('spawn 同步失败（onError + null）→ failed，process=null', async () => {
    mockSpawnService.mockImplementation((_cmd, _shell, h) => {
      h?.onError?.(new Error('spawn EACCES'));
      return null;
    });
    const { target } = makeMockTarget();
    const onStateChange = vi.fn();

    const handle = await launchServiceApp({ command: 'bad', shell: 'auto' }, target, { onStateChange });

    expect(handle.process).toBeNull();
    expect(onStateChange).toHaveBeenCalledWith('failed', 'spawn EACCES');
  });

  it('cleanup 停止所有定时器，后续事件不再 setState', async () => {
    makeMockSpawn();
    const { target } = makeMockTarget();
    const onStateChange = vi.fn();

    const handle = await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange });
    handle.cleanup();

    const callsBefore = onStateChange.mock.calls.length;
    await vi.advanceTimersByTimeAsync(40000);
    expect(onStateChange.mock.calls.length).toBe(callsBefore);
  });

  it('target 已销毁时不重试 loadURL', async () => {
    makeMockSpawn();
    let destroyed = false;
    const failListeners: Array<() => void> = [];
    const target: ServiceLaunchTarget = {
      url: 'http://localhost:3000',
      loadUrl: vi.fn(),
      onDidFailLoad: (l) => failListeners.push(l),
      onDidFinishLoad: () => {},
      isDestroyed: () => destroyed,
    };
    await launchServiceApp({ command: 'npm start', shell: 'auto' }, target, { onStateChange: () => {} });

    destroyed = true;
    failListeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(5000);
    expect(target.loadUrl).not.toHaveBeenCalled();
  });
});
