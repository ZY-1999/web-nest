import type { AppServiceConfig, ServiceState } from '@/shared/services/webAppApi';
import { resolveShell } from './shellDetector';
import { spawnService, type SpawnResult } from './processManager';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

/** URL 自适应重试：首次 500ms，指数退避，2s 封顶。 */
const RETRY_INITIAL_MS = 500;
const RETRY_MAX_MS = 2000;
/** 重试总超时 30s（超时仍 loadURL 一次 + 转 failed）。 */
const RETRY_TOTAL_TIMEOUT_MS = 30000;

export interface ServiceLaunchCallbacks {
  onStateChange: (state: ServiceState, error?: string) => void;
}

/** 加载目标抽象（由 webAppService 用 content view webContents 适配）。 */
export interface ServiceLaunchTarget {
  url: string;
  loadUrl: (url: string) => Promise<unknown> | unknown;
  onDidFailLoad: (listener: () => void) => void;
  onDidFinishLoad: (listener: () => void) => void;
  isDestroyed: () => boolean;
}

export interface ServiceLaunchHandle {
  process: SpawnResult | null;
  cleanup: () => void;
}

/**
 * 启动服务型 app：spawn command + URL 自适应重试 + exit 边界状态机（ADR-0003 并行 + 自适应重试）。
 *
 * 失败矩阵：
 *  - spawn 失败（onError ENOENT/EACCES）→ failed（附错误简述），停止重试
 *  - 加载成功前进程 exit → failed（附 exit code），提前结束重试（不等 30s）
 *  - 重试总超时 30s → failed「服务可能未就绪」，仍 loadURL 一次
 *  - 运行中进程 exit（已 running）→ stopped（附 exit code），不重启
 *
 * exit 边界：以 content view `did-finish-load` 成功为界——此前 exit=failed、此后 exit=stopped。
 */
export async function launchServiceApp(
  service: AppServiceConfig,
  target: ServiceLaunchTarget,
  callbacks: ServiceLaunchCallbacks,
): Promise<ServiceLaunchHandle> {
  const setState = (state: ServiceState, error?: string) => {
    log.info(`serviceState → ${state}${error ? ` (${error})` : ''}`);
    callbacks.onStateChange(state, error);
  };

  let loaded = false;
  let cleaned = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let nextRetryMs = RETRY_INITIAL_MS;

  const stopTimers = () => {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
  };

  const cleanup = () => {
    if (cleaned) { return; }
    cleaned = true;
    stopTimers();
  };

  // 1. resolveShell（消费 Spec 02）
  const shell = await resolveShell(service.shell);

  // 2. spawn（消费 Spec 03）—— handlers 驱动状态机
  const process = spawnService(service.command, shell, {
    onError: (err) => {
      if (loaded || cleaned) { return; }
      cleaned = true; // 终态：阻止后续重试/setState
      stopTimers();
      setState('failed', err.message);
    },
    onExit: (code) => {
      if (cleaned) { return; }
      if (loaded) {
        // 运行中崩溃 → stopped（窗口保留最后页面，不重启）
        setState('stopped', `exit code ${code}`);
      } else {
        // 加载前 exit → failed（提前结束重试）
        cleaned = true; // 终态
        stopTimers();
        setState('failed', `service exited (code ${code})`);
      }
    },
  });

  if (!process) {
    // spawn 同步失败：spawnService 已经触发 onError → setState('failed')
    return { process: null, cleanup };
  }

  // 3. starting
  setState('starting');

  // 4. URL 自适应重试订阅（did-fail-load 触发，did-finish-load 标成功界）
  const scheduleRetry = () => {
    if (cleaned || loaded) { return; }
    const delay = nextRetryMs;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (cleaned || loaded) { return; }
      if (target.isDestroyed()) { return; }
      log.info(`retry loadURL after ${delay}ms`);
      Promise.resolve(target.loadUrl(target.url)).catch(() => {});
      nextRetryMs = Math.min(nextRetryMs * 2, RETRY_MAX_MS);
    }, delay);
  };

  target.onDidFailLoad(() => {
    if (loaded || cleaned) { return; }
    scheduleRetry();
  });

  target.onDidFinishLoad(() => {
    if (cleaned) { return; }
    loaded = true; // 标记 exit 边界（此后 exit → stopped）
    stopTimers();
    setState('running');
  });

  // 5. 总超时 30s：仍 loadURL 一次 + 转 failed
  timeoutTimer = setTimeout(() => {
    timeoutTimer = null;
    if (loaded || cleaned) { return; }
    stopTimers();
    if (!target.isDestroyed()) {
      Promise.resolve(target.loadUrl(target.url)).catch(() => {});
    }
    setState('failed', 'service may not be ready (timeout)');
  }, RETRY_TOTAL_TIMEOUT_MS);

  return { process, cleanup };
}
