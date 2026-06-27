import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

/** stderr 尾部 buffer 上限：20 行或 1KB（取先到者）。 */
const STDERR_MAX_LINES = 20;
const STDERR_MAX_BYTES = 1024;

export interface SpawnHandlers {
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  onError?: (err: Error) => void;
  onStderrTail?: (text: string) => void;
}

export interface SpawnResult {
  child: ChildProcess;
  pid: number;
}

/** 截断 stderr 到尾部 20 行或 1KB（取先到者）。 */
function truncateStderrTail(text: string): string {
  const lines = text.split('\n');
  if (lines.length > STDERR_MAX_LINES) {
    return lines.slice(-STDERR_MAX_LINES).join('\n');
  }
  if (text.length > STDERR_MAX_BYTES) {
    return text.slice(-STDERR_MAX_BYTES);
  }
  return text;
}

/**
 * Spawn command 经指定 shell。
 * shell 由调用方经 shellDetector.resolveShell 解析后传入——本模块**不内部解析 'auto'**（职责单一）。
 * spawn 同步失败经 onError 上报并返回 null（不抛调用层，对齐 ADR-0006 + AGENTS.md 失败隔离）。
 */
export function spawnService(command: string, shell: string, handlers: SpawnHandlers = {}): SpawnResult | null {
  let child: ChildProcess;
  try {
    child = spawn(command, {
      shell,
      windowsHide: true,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error('spawn failed:', error.message);
    handlers.onError?.(error);
    return null;
  }

  const pid = child.pid ?? -1;

  // stderr 滚动 buffer：累积尾部，防爆（最终精确截断在 exit）
  let stderrBuffer = '';
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf8');
      if (stderrBuffer.length > STDERR_MAX_BYTES * 4) {
        stderrBuffer = stderrBuffer.slice(-STDERR_MAX_BYTES * 2);
      }
    });
  }

  child.on('error', (err) => {
    log.error(`process error (pid=${pid}):`, err.message);
    handlers.onError?.(err);
  });

  child.on('exit', (code, signal) => {
    const tail = truncateStderrTail(stderrBuffer);
    if (tail) {
      log.info(`stderr tail (pid=${pid}):`, tail);
      handlers.onStderrTail?.(tail);
    }
    log.info(`process exit (pid=${pid}):`, { code, signal });
    handlers.onExit?.(code, signal);
  });

  return { child, pid };
}

/** 已 kill 的 child 集合，保证 killTree 幂等。 */
const killedChildren = new WeakSet<ChildProcess>();

/**
 * 强杀进程树。幂等（同一 child 不重复 kill）。
 * win32: `taskkill /pid <pid> /T /F`（/T 杀树 /F 强制，对齐 ADR-0004）。
 * 非 win32: `child.kill()`（默认信号）。
 * 对已退出的 child 安全无副作用（try-catch，对齐 AGENTS.md 销毁安全约定）。
 */
export function killTree(child: ChildProcess): void {
  if (killedChildren.has(child)) { return; }
  killedChildren.add(child);

  try {
    if (process.platform === 'win32' && child.pid) {
      execSync(`taskkill /pid ${child.pid} /T /F`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      log.info('killTree: taskkill /T /F pid', child.pid);
    } else if (typeof child.kill === 'function') {
      child.kill();
      log.info('killTree: child.kill() pid', child.pid);
    }
  } catch (err) {
    log.warn('killTree failed (process may have exited):', err instanceof Error ? err.message : err);
  }
}
