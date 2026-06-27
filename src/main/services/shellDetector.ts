import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

/** 全局一次性 auto 探测结果缓存。 */
let autoCache: string | undefined;

/** 注册表查询 GitForWindows InstallPath（含 WOW6432Node 兜底）。 */
function readGitInstallPathFromRegistry(): string | null {
  const keys = [
    'HKLM\\SOFTWARE\\GitForWindows',
    'HKLM\\SOFTWARE\\WOW6432Node\\GitForWindows',
  ];
  for (const key of keys) {
    try {
      const out = execSync(`reg query "${key}" /v InstallPath`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const m = out.match(/InstallPath\s+REG_SZ\s+(.+)/);
      if (m) { return m[1].trim(); }
    } catch { /* registry key absent */ }
  }
  return null;
}

/** 探测 Git Bash 路径（win32）：注册表 → 常见路径 → where bash，三步择优。 */
function detectGitBash(): string | null {
  if (process.platform !== 'win32') { return null; }
  // ① 注册表 InstallPath
  const installPath = readGitInstallPathFromRegistry();
  if (installPath) {
    const p = `${installPath}\\bin\\bash.exe`;
    if (fs.existsSync(p)) { return p; }
  }
  // ② 常见安装路径枚举
  const commonPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) { return p; }
  }
  // ③ where bash（PATH 查找）
  try {
    const out = execSync('where bash', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) { return out.split('\n')[0]!.trim(); }
  } catch { /* bash not in PATH */ }
  return null;
}

/** 探测 PowerShell 路径（win32）：pwsh 优先 → powershell。 */
function detectPowerShell(): string | null {
  if (process.platform !== 'win32') { return null; }
  for (const cmd of ['where pwsh', 'where powershell']) {
    try {
      const out = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (out) { return out.split('\n')[0]!.trim(); }
    } catch { /* absent */ }
  }
  return null;
}

/**
 * 全局一次性 auto 探测：Git Bash → PowerShell → cmd 兜底（+ warn）。
 * 非 win32 直接返回 process.env.SHELL 或 /bin/bash，不探测。
 */
export async function detectAndCache(): Promise<string> {
  if (autoCache !== undefined) { return autoCache; }

  if (process.platform !== 'win32') {
    autoCache = process.env.SHELL || '/bin/bash';
    log.info('auto shell (non-win32):', autoCache);
    return autoCache;
  }

  const gitBash = detectGitBash();
  if (gitBash) {
    autoCache = gitBash;
    log.info('auto shell: Git Bash at', gitBash);
    return autoCache;
  }

  const pwsh = detectPowerShell();
  if (pwsh) {
    autoCache = pwsh;
    log.info('auto shell: PowerShell at', pwsh);
    return autoCache;
  }

  autoCache = 'cmd.exe';
  log.warn('auto shell: all detection failed, fallback to cmd.exe');
  return autoCache;
}

/**
 * 入口：接收 service.shell 值，返回 execa 可消费的真实 shell。
 * - '' / 'auto' → 全局一次性探测（detectAndCache）
 * - 'bash' → Git Bash 探测（win32 失败兜底 cmd.exe；非 win32 用 SHELL）
 * - 'cmd' → 'cmd.exe'
 * - 'powershell' → pwsh/powershell 探测（失败兜底 powershell.exe）
 * - 其他 → 原样返回（自定义路径，不探测）
 */
export async function resolveShell(shell: string): Promise<string> {
  const trimmed = (shell ?? '').trim();
  if (!trimmed || trimmed === 'auto') {
    return detectAndCache();
  }
  if (trimmed === 'bash') {
    if (process.platform === 'win32') {
      const gitBash = detectGitBash();
      if (gitBash) { return gitBash; }
      log.warn('shell=bash but Git Bash not found, fallback to cmd.exe');
      return 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }
  if (trimmed === 'cmd') {
    return 'cmd.exe';
  }
  if (trimmed === 'powershell') {
    if (process.platform === 'win32') {
      return detectPowerShell() ?? 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }
  // 自定义路径原样返回
  return trimmed;
}

/** 重置 auto 缓存（仅测试用）。 */
export function _resetCacheForTest(): void {
  autoCache = undefined;
}
