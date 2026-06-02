/** Title bar height for the main management window. */
export const TITLE_BAR_HEIGHT = 35;

/** Total height of the web app window custom titlebar (two rows). */
export const WEBAPP_TITLEBAR_HEIGHT = TITLE_BAR_HEIGHT * 2; // 70px

/**
 * Platform-specific titleBarStyle options for BaseWindow.
 * Used by both the main window and web app child windows.
 */
export function getTitleBarOptions(): Electron.BaseWindowConstructorOptions {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 14, y: 12 },
    };
  }

  // Windows & Linux
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      height: TITLE_BAR_HEIGHT,
      color: '#00000000',
      symbolColor: '#666666',
    },
  };
}
