import { WebContentsView } from 'electron';
import { WebAppMainApi } from '@/shared/services';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { windowManager } from '@/main/windowManager';

const log = logger(__SOURCE_FILE__);

function generateWebAppId(): string {
  return `webapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface WebAppEntry {
  id: string;
  url: string;
  title: string;
  webContentsView: WebContentsView;
}

@Singleton()
export class WebAppService extends WebAppMainApi {
  private apps = new Map<string, WebAppEntry>();

  async createWebApp(url: string): Promise<{ id: string; url: string; title: string }> {
    const id = generateWebAppId();

    const windowId = windowManager.createWindow({
      id,
      options: { width: 1200, height: 800, title: url },
    });

    const nativeWindow = windowManager.getNativeWindow(windowId)!;

    const webContentsView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    (nativeWindow.contentView as { addChildView: (v: unknown) => void }).addChildView(
      webContentsView,
    );
    const updateBounds = () => {
      const { width, height } = nativeWindow.getContentBounds();
      webContentsView.setBounds({ x: 0, y: 0, width, height });
    };
    updateBounds();
    nativeWindow.on('resize', updateBounds);

    webContentsView.webContents.on('page-title-updated', (_event: Electron.Event, title: string) => {
      const entry = this.apps.get(id);
      if (entry) {
        entry.title = title;
      }
    });

    nativeWindow.on('closed', () => {
      this.apps.delete(id);
      log.info('Web app window closed:', id);
    });

    await webContentsView.webContents.loadURL(url);

    const title = webContentsView.webContents.getTitle() || url;

    this.apps.set(id, { id, url, title, webContentsView });

    log.info('Web app created:', id, url);
    return { id, url, title };
  }

  async closeWebApp(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (!entry) {
      return;
    }

    if (!entry.webContentsView.webContents.isDestroyed()) {
      entry.webContentsView.webContents.close();
    }
    windowManager.destroyWindow(id);
    this.apps.delete(id);
    log.info('Web app closed:', id);
  }

  async listWebApps(): Promise<{ id: string; url: string; title: string }[]> {
    return Array.from(this.apps.values()).map((entry) => ({
      id: entry.id,
      url: entry.url,
      title: entry.title,
    }));
  }

  async updateWebApp(id: string, data: { title?: string; url?: string }): Promise<{ id: string; url: string; title: string }> {
    const entry = this.apps.get(id);
    if (!entry) {
      throw new Error(`Web app not found: ${id}`);
    }

    if (data.title !== undefined) {
      entry.title = data.title;
    }

    if (data.url !== undefined && data.url !== entry.url) {
      entry.url = data.url;
      if (!entry.webContentsView.webContents.isDestroyed()) {
        await entry.webContentsView.webContents.loadURL(data.url);
        entry.title = entry.webContentsView.webContents.getTitle() || data.url;
      }
    }

    log.info('Web app updated:', id, data);
    return { id: entry.id, url: entry.url, title: entry.title };
  }
}

export const webAppService = new WebAppService();
