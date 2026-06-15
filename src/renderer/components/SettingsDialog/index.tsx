import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog';
import { Button } from '@/renderer/components/ui/button';
import { settingsApi } from '@/shared/services/settingsApi';
import { i18nApi } from '@/shared/services/i18nApi';
import type { AppSettings } from '@/shared/settings';
import type { ProxyTestResult } from '@/shared/services/settingsApi';
import type { SupportedLocale } from '@/shared/i18n';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [proxyTestResult, setProxyTestResult] = useState<ProxyTestResult | null>(null);
  const [proxyTesting, setProxyTesting] = useState(false);

  // Draft state for form editing (applied only on save)
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (open) {
      settingsApi.getSettings().then((s) => {
        setSettings(s);
        setDraft(s);
        setSaved(true);
        setProxyTestResult(null);
      });
    }
  }, [open]);

  if (!draft) { return null; }

  const updateDraft = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!draft) { return; }

    // Theme is managed by ThemeToggle — exclude from settings patch
    const { theme: _theme, ...patch } = draft;
    await settingsApi.setSettings(patch);

    // Sync locale via i18nApi full path (broadcasts locale-changed to all views)
    if (draft.locale !== settings?.locale) {
      await i18nApi.setLocale(draft.locale as SupportedLocale);
    }

    // Refresh from backend
    const updated = await settingsApi.getSettings();
    setSettings(updated);
    setDraft(updated);
    setSaved(true);
    onOpenChange(false);
  };

  const handleTestProxy = async () => {
    if (!draft) { return; }
    setProxyTesting(true);
    setProxyTestResult(null);
    try {
      const result = await settingsApi.testProxy({
        mode: draft.proxyMode,
        host: draft.proxyHost,
        port: draft.proxyPort,
      });
      setProxyTestResult(result);
    } catch {
      setProxyTestResult({ ok: false, error: 'Unknown error' });
    } finally {
      setProxyTesting(false);
    }
  };

  const showProxyFields = draft.proxyMode !== 'none';
  const gpuChanged = draft.disableGpu !== settings?.disableGpu;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Appearance ────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('settings.appearance')}</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">{t('settings.language')}</span>
                <select
                  value={draft.locale}
                  onChange={(e) => updateDraft('locale', e.target.value)}
                  data-testid="settings-locale-select"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </section>

          {/* ── General ──────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('settings.general')}</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">{t('settings.autoLaunch')}</span>
                <input
                  type="checkbox"
                  checked={draft.autoLaunch}
                  onChange={(e) => updateDraft('autoLaunch', e.target.checked)}
                  data-testid="settings-autoLaunch-checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm">{t('settings.disableGpu')}</span>
                  <input
                    type="checkbox"
                    checked={draft.disableGpu}
                    onChange={(e) => updateDraft('disableGpu', e.target.checked)}
                    data-testid="settings-disableGpu-checkbox"
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                {gpuChanged && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('settings.restartRequired')}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Network ──────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('settings.network')}</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">{t('settings.proxyMode')}</span>
                <select
                  value={draft.proxyMode}
                  onChange={(e) => updateDraft('proxyMode', e.target.value as AppSettings['proxyMode'])}
                  data-testid="settings-proxy-mode-select"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="none">{t('settings.proxyNone')}</option>
                  <option value="http">{t('settings.proxyHttp')}</option>
                  <option value="socks5">{t('settings.proxySocks5')}</option>
                </select>
              </label>

              {showProxyFields && (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">{t('settings.proxyHost')}</label>
                      <input
                        type="text"
                        value={draft.proxyHost}
                        onChange={(e) => updateDraft('proxyHost', e.target.value)}
                        placeholder="127.0.0.1"
                        data-testid="settings-proxy-host"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="w-24">
                      <label className="mb-1 block text-xs text-muted-foreground">{t('settings.proxyPort')}</label>
                      <input
                        type="number"
                        value={draft.proxyPort || ''}
                        onChange={(e) => updateDraft('proxyPort', parseInt(e.target.value, 10) || 0)}
                        placeholder="8080"
                        data-testid="settings-proxy-port"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestProxy}
                      disabled={proxyTesting || !draft.proxyHost || !draft.proxyPort}
                      data-testid="settings-test-proxy"
                    >
                      {proxyTesting ? t('settings.testConnectionTesting') : t('settings.testConnection')}
                    </Button>
                    {proxyTestResult && (
                      <span className={`text-xs ${proxyTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                        {proxyTestResult.ok
                          ? t('settings.testConnectionSuccess', { ms: proxyTestResult.latency })
                          : t('settings.testConnectionFail', { error: proxyTestResult.error })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Advanced ─────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('settings.advanced')}</h3>
            <div>
              <label className="mb-1 block text-sm">{t('settings.userAgent')}</label>
              <input
                type="text"
                value={draft.userAgent}
                onChange={(e) => updateDraft('userAgent', e.target.value)}
                placeholder={t('settings.userAgentPlaceholder')}
                data-testid="settings-useragent"
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="settings-cancel">
            {t('settings.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saved} data-testid="settings-save">
            {t('settings.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
