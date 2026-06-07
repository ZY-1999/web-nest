import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/shared/utils/log';
import { paths } from '@/main/utils/paths';

const log = logger(__SOURCE_FILE__);

function sanitizeFileName(title: string): string {
  return title.replace(/[<>:"/\\|?*]/g, '_').trim();
}

/** Create a desktop shortcut that opens a specific web app. */
export function createDesktopShortcut(appId: string, title: string): void {
  const linkPath = path.join(app.getPath('desktop'), `${sanitizeFileName(title)}.lnk`);
  const iconPath = path.join(paths.getIconPath(), 'app', 'icon.ico');

  shell.writeShortcutLink(linkPath, 'create', {
    target: process.execPath,
    args: `--open-app=${appId}`,
    description: `Open ${title} in Web Nest`,
    icon: iconPath,
    iconIndex: 0,
    appUserModelId: `web-nest.webapp-${appId}`,
  });

  log.info('Desktop shortcut created:', linkPath);
}

/** Remove the desktop shortcut for a web app by scanning for matching args. */
export function removeDesktopShortcut(appId: string): void {
  const desktop = app.getPath('desktop');
  let files: string[];
  try {
    files = fs.readdirSync(desktop);
  } catch {
    return;
  }

  for (const file of files) {
    if (!file.endsWith('.lnk')) { continue; }
    const fullPath = path.join(desktop, file);
    try {
      const link = shell.readShortcutLink(fullPath);
      if (link.args?.includes(`--open-app=${appId}`)) {
        fs.unlinkSync(fullPath);
        log.info('Desktop shortcut removed:', fullPath);
        return;
      }
    } catch {
      // Not a valid shortcut or unreadable — skip
    }
  }
}
