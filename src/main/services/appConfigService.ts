import fs from 'fs';
import path from 'path';

export interface PersistedApp {
  id: string;
  url: string;
  title: string;
  faviconUrl: string;
}

export function loadApps(configDir: string): PersistedApp[] {
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

export function saveApps(configDir: string, apps: PersistedApp[]): void {
  fs.writeFileSync(
    path.join(configDir, 'apps.config'),
    JSON.stringify(apps, null, 2),
    'utf-8',
  );
}
