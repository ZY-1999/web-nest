import { MainWindowApi } from '@/shared/services/mainWindowApi';
import type { ManagedView } from '@/main/viewManager/managedView';

interface MainWindowContext {
  mainView: ManagedView;
}

/**
 * Service for the main management window.
 * Created in `createMainWindow` with a captured reference to the main content view.
 */
export class MainWindowService extends MainWindowApi {
  private context: MainWindowContext;

  constructor(context: MainWindowContext) {
    super();
    this.context = context;
  }

  async toggleDevTools(): Promise<void> {
    const wc = this.context.mainView.webContents;
    if (!wc.isDestroyed()) { this.context.mainView.toggleDevTools(); }
  }
}
