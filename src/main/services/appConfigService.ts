import fs from 'fs';
import path from 'path';
import type { AppServiceConfig } from '@/shared/services/webAppApi';

export interface PersistedApp {
  id: string;
  url: string;
  title: string;
  faviconUrl: string;
  /** 服务型 app 的本地服务配置；普通型/旧配置缺失为 undefined（向后兼容）。 */
  service?: AppServiceConfig;
}

class AppConfigService {
  loadApps(configDir: string): PersistedApp[] {
    const filePath = path.join(configDir, 'apps.config');
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as PersistedApp[];
    } catch {
      return [];
    }
  }

  saveApps(configDir: string, apps: PersistedApp[]): void {
    fs.writeFileSync(
      path.join(configDir, 'apps.config'),
      JSON.stringify(apps, null, 2),
      'utf-8',
    );
  }
}

export const appConfigService = new AppConfigService();
