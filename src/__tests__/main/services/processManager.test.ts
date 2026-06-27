import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

import { spawn, execSync } from 'node:child_process';
import { spawnService, killTree } from '@/main/services/processManager';

const mockSpawn = vi.mocked(spawn);
const mockExecSync = vi.mocked(execSync);

/** mock child：EventEmitter + pid + stderr(EventEmitter) + kill()。 */
interface MockChild extends EventEmitter {
  pid: number;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
}

function makeMockChild(pid = 12345): MockChild {
  const child = new EventEmitter() as unknown as MockChild;
  Object.defineProperty(child, 'pid', { value: pid, configurable: true });
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('processManager', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    mockSpawn.mockReset();
    mockExecSync.mockReset();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('spawn 传 command + 已解析 shell 给 child_process.spawn（不内部解析 auto）', () => {
    const mockChild = makeMockChild(12345);
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);

    const result = spawnService('npm start', 'C:\\Program Files\\Git\\bin\\bash.exe', {});

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn.mock.calls[0]![0]).toBe('npm start');
    expect(mockSpawn.mock.calls[0]![1]).toMatchObject({ shell: 'C:\\Program Files\\Git\\bin\\bash.exe' });
    expect(result?.pid).toBe(12345);
    expect(result?.child).toBe(mockChild);
  });

  it('exit 事件触发 onExit 附 code 与 signal', () => {
    const mockChild = makeMockChild();
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);
    const onExit = vi.fn();

    spawnService('cmd', 'cmd.exe', { onExit });
    mockChild.emit('exit', 0, null);

    expect(onExit).toHaveBeenCalledWith(0, null);
  });

  it('error 事件触发 onError 附错误对象', () => {
    const mockChild = makeMockChild();
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);
    const onError = vi.fn();

    spawnService('cmd', 'cmd.exe', { onError });
    const err = new Error('spawn ENOENT');
    mockChild.emit('error', err);

    expect(onError).toHaveBeenCalledWith(err);
  });

  it('stderr 尾部截断：超 20 行只保留最后 20 行', () => {
    const mockChild = makeMockChild();
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);
    const onStderrTail = vi.fn();

    spawnService('cmd', 'cmd.exe', { onStderrTail });
    const lines = Array.from({ length: 25 }, (_, i) => `line ${i}`);
    mockChild.stderr.emit('data', Buffer.from(lines.join('\n')));
    mockChild.emit('exit', 1, null);

    const tail = onStderrTail.mock.calls[0]![0] as string;
    expect(tail.split('\n').length).toBeLessThanOrEqual(20);
    expect(tail).toContain('line 24');
    expect(tail).not.toContain('line 0');
  });

  it('stderr 尾部截断：超 1KB 只保留最后 1KB（行数不足 20）', () => {
    const mockChild = makeMockChild();
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);
    const onStderrTail = vi.fn();

    spawnService('cmd', 'cmd.exe', { onStderrTail });
    const longLine = 'x'.repeat(300);
    const data = Array.from({ length: 5 }, () => longLine).join('\n'); // ~1500 bytes, 5 lines
    mockChild.stderr.emit('data', Buffer.from(data));
    mockChild.emit('exit', 1, null);

    const tail = onStderrTail.mock.calls[0]![0] as string;
    expect(tail.length).toBeLessThanOrEqual(1024);
  });

  it('killTree win32 调 taskkill /pid <pid> /T /F', () => {
    const mockChild = makeMockChild(999);
    mockExecSync.mockReturnValue('');

    killTree(mockChild as unknown as ChildProcess);

    expect(mockExecSync.mock.calls[0]![0]).toBe('taskkill /pid 999 /T /F');
  });

  it('killTree 幂等：同一 child 不重复 kill', () => {
    const mockChild = makeMockChild(888);
    mockExecSync.mockReturnValue('');

    killTree(mockChild as unknown as ChildProcess);
    killTree(mockChild as unknown as ChildProcess);

    expect(mockExecSync.mock.calls.length).toBe(1);
  });

  it('killTree 非 win32 调 child.kill()', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const mockChild = makeMockChild(777);

    killTree(mockChild as unknown as ChildProcess);

    expect(mockChild.kill).toHaveBeenCalled();
    expect(mockExecSync.mock.calls.length).toBe(0);
  });

  it('killTree 对已退出进程安全（taskkill 失败不抛）', () => {
    const mockChild = makeMockChild(666);
    mockExecSync.mockImplementation(() => { throw new Error('process not found'); });

    expect(() => killTree(mockChild as unknown as ChildProcess)).not.toThrow();
  });

  it('spawn 同步失败经 onError 上报，返回 null，不抛调用层', () => {
    mockSpawn.mockImplementation(() => { throw new Error('EACCES'); });
    const onError = vi.fn();

    const result = spawnService('bad', 'cmd.exe', { onError });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'EACCES' }));
  });
});
