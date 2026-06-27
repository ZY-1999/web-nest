import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ServiceState } from '@/shared/services/webAppApi';

interface ServiceStateIndicatorProps {
  serviceState?: ServiceState;
  serviceError?: string;
}

/** serviceError 简述截断阈值（renderer 侧，防顶爆标题栏；main 侧传完整简述）。 */
const MAX_ERROR_CHARS = 60;

function truncate(text: string): string {
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text;
}

/**
 * 服务型 app 后端服务状态指示器（标题栏第二行 URL 旁）。
 * 四态：starting=spinner、running=绿点、failed=红字简述、stopped=灰点。
 * 普通型（serviceState undefined）不渲染。
 */
export function ServiceStateIndicator({ serviceState, serviceError }: ServiceStateIndicatorProps) {
  const { t } = useTranslation();

  if (!serviceState) { return null; }

  if (serviceState === 'starting') {
    return (
      <span className="service-state service-state--starting" data-testid="service-state" data-state="starting">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="service-state__text">{t('titlebar.serviceState.starting')}</span>
      </span>
    );
  }

  if (serviceState === 'running') {
    return (
      <span className="service-state service-state--running" data-testid="service-state" data-state="running">
        <span className="service-state__dot service-state__dot--green" />
        <span className="service-state__text">{t('titlebar.serviceState.running')}</span>
      </span>
    );
  }

  if (serviceState === 'failed') {
    const errorText = serviceError ? truncate(serviceError) : '';
    return (
      <span
        className="service-state service-state--failed"
        data-testid="service-state"
        data-state="failed"
        title={serviceError}
      >
        <span className="service-state__dot service-state__dot--red" />
        <span className="service-state__text">
          {t('titlebar.serviceState.failed')}
          {errorText ? `: ${errorText}` : ''}
        </span>
      </span>
    );
  }

  // stopped
  return (
    <span className="service-state service-state--stopped" data-testid="service-state" data-state="stopped">
      <span className="service-state__dot service-state__dot--gray" />
      <span className="service-state__text">{t('titlebar.serviceState.stopped')}</span>
    </span>
  );
}
