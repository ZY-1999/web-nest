import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn() },
}));

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import {
  resolveShell,
  detectAndCache,
  _resetCacheForTest,
} from '@/main/services/shellDetector';

const mockExecSync = execSync as unknown as { mockImplementation: (fn: (cmd: string) => string) => void; mockReset: () => void; mock: { calls: string[][] } };
const mockExists = fs.existsSync as unknown as { mockReturnValue: (v: boolean) => void; mockReset: () => void };

describe('shellDetector', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    _resetCacheForTest();
    mockExecSync.mockReset();
    mockExists.mockReset();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('auto 优先级：注册表命中 Git Bash → 返回 bash.exe 路径', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('GitForWindows') && !cmd.includes('WOW6432Node')) {
        return '    InstallPath    REG_SZ    C:\\Program Files\\Git\n';
      }
      throw new Error('not found');
    });
    mockExists.mockReturnValue(true);

    const result = await resolveShell('auto');
    expect(result).toBe('C:\\Program Files\\Git\\bin\\bash.exe');
  });

  it('auto 优先级：Git Bash 缺、PowerShell 在 → 返回 PowerShell', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('GitForWindows')) { throw new Error('no git'); }
      if (cmd === 'where bash') { throw new Error('no bash'); }
      if (cmd === 'where pwsh') { return 'C:\\Program Files\\PowerShell\\7\\pwsh.exe\n'; }
      throw new Error('unexpected');
    });
    mockExists.mockReturnValue(false);

    const result = await resolveShell('auto');
    expect(result).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe');
  });

  it('auto 优先级：全缺 → 兜底 cmd.exe', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('all fail'); });
    mockExists.mockReturnValue(false);

    const result = await resolveShell('auto');
    expect(result).toBe('cmd.exe');
  });

  it('auto 全局缓存：第二次 resolveShell(auto) 不重探', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('GitForWindows') && !cmd.includes('WOW6432Node')) {
        return '    InstallPath    REG_SZ    C:\\Program Files\\Git\n';
      }
      throw new Error('no');
    });
    mockExists.mockReturnValue(true);

    await resolveShell('auto');
    const callsAfterFirst = mockExecSync.mock.calls.length;
    await resolveShell('auto');
    expect(mockExecSync.mock.calls.length).toBe(callsAfterFirst);
  });

  it('显式 bash：探测 Git Bash 路径（不走 auto 缓存）', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('GitForWindows') && !cmd.includes('WOW6432Node')) {
        return '    InstallPath    REG_SZ    C:\\Program Files\\Git\n';
      }
      throw new Error('no');
    });
    mockExists.mockReturnValue(true);

    const result = await resolveShell('bash');
    expect(result).toBe('C:\\Program Files\\Git\\bin\\bash.exe');
  });

  it('显式 bash：Git Bash 缺 → 兜底 cmd.exe', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('no git'); });
    mockExists.mockReturnValue(false);

    const result = await resolveShell('bash');
    expect(result).toBe('cmd.exe');
  });

  it('显式 cmd：直通 cmd.exe，不探测', async () => {
    const result = await resolveShell('cmd');
    expect(result).toBe('cmd.exe');
    expect(mockExecSync.mock.calls.length).toBe(0);
  });

  it('显式 powershell：探测 powershell 路径', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'where pwsh') { throw new Error('no pwsh'); }
      if (cmd === 'where powershell') { return 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\n'; }
      throw new Error('no');
    });

    const result = await resolveShell('powershell');
    expect(result).toContain('powershell.exe');
  });

  it('自定义路径：原样返回，不探测', async () => {
    const custom = 'D:\\shells\\my-shell.exe';
    const result = await resolveShell(custom);
    expect(result).toBe(custom);
    expect(mockExecSync.mock.calls.length).toBe(0);
  });

  it('跨平台：非 win32 → process.env.SHELL 或 /bin/bash', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const originalShell = process.env.SHELL;
    delete process.env.SHELL;

    const result = await resolveShell('auto');
    expect(result).toBe('/bin/bash');

    if (originalShell !== undefined) { process.env.SHELL = originalShell; }
  });

  it('空 shell 视为 auto 探测兜底', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('fail'); });
    mockExists.mockReturnValue(false);

    const result = await resolveShell('');
    expect(result).toBe('cmd.exe');
  });

  it('detectAndCache 直接调用也走缓存', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('GitForWindows') && !cmd.includes('WOW6432Node')) {
        return '    InstallPath    REG_SZ    C:\\Program Files\\Git\n';
      }
      throw new Error('no');
    });
    mockExists.mockReturnValue(true);

    const first = await detectAndCache();
    const callsAfterFirst = mockExecSync.mock.calls.length;
    const second = await detectAndCache();
    expect(second).toBe(first);
    expect(mockExecSync.mock.calls.length).toBe(callsAfterFirst);
  });
});
