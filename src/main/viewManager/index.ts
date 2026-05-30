import { TypedEmitter } from '@/shared/utils/typedEmitter';
import { ManagedView } from './managedView';
import type { ViewOptions, ViewState, ViewEventMap } from '@/shared/view';
import type { Handler, AnyRequestHandler, ChannelCenter, ChannelAPI } from '@/shared/channel';
import { Singleton } from '@/shared/utils/singleton';

function generateViewId(): string {
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

@Singleton()
export class ViewManager extends TypedEmitter<ViewEventMap> implements ChannelCenter {
  private views = new Map<string, ManagedView>();
  private anyRequestHandlers = new Map<string, AnyRequestHandler>();

  // ─── View lifecycle ────────────────────────────────────────────────────

  async createView(options: ViewOptions): Promise<string> {
    const {
      id: viewId = generateViewId(),
      type = 'embedded',
      url,
      channel,
      defaultChannelTimeout,
      loadUrlOptions = {},
      ...restOptions
    } = options;

    // Validate ID uniqueness
    if (this.views.has(viewId)) {
      throw new Error(`View with id '${viewId}' already exists`);
    }

    const view = new ManagedView(viewId, {
      type,
      channel,
      ...restOptions,
    });

    view.on('state-changed', (state) => {
      this.emit('view-state-changed', viewId, state);
    });
    view.on('ready', () => {
      this.emit('view-ready', viewId);
    });

    // Init channel and load URL before exposing view
    await view.init({ url, defaultChannelTimeout, ...loadUrlOptions });

    // Apply any registered onAnyRequest handlers
    for (const [method, handler] of this.anyRequestHandlers) {
      view.channel.onRequest(method, (payload: unknown) => handler(viewId, payload));
    }

    // Only add to views map after full initialization
    this.views.set(viewId, view);

    this.emit('view-created', viewId, view.state);
    return viewId;
  }

  destroyView(viewId: string): void {
    const view = this.views.get(viewId);
    if (!view) {
      return;
    }

    view.destroy();
    this.views.delete(viewId);
    this.emit('view-destroyed', viewId);
  }

  // ─── Query ─────────────────────────────────────────────────────────────

  getView(viewId: string): ManagedView | undefined {
    return this.views.get(viewId);
  }

  getViewState(viewId: string): ViewState | undefined {
    return this.views.get(viewId)?.state;
  }

  listViews(): ViewState[] {
    return Array.from(this.views.values()).map((v) => v.state);
  }

  // ─── Built-in channel ──────────────────────────────────────────────────

  async requestTo(
    viewId: string,
    method: string,
    payload?: unknown,
    timeout?: number,
  ): Promise<unknown> {
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View not found: ${viewId}`);
    }
    return view.channel.request(method, payload, timeout);
  }

  async broadcast(method: string, payload?: unknown, timeout?: number): Promise<void> {
    const promises: Promise<unknown>[] = [];
    for (const view of this.views.values()) {
      promises.push(view.channel.request(method, payload, timeout));
    }
    await Promise.allSettled(promises);
  }

  onRequest(viewId: string, method: string, handler: Handler): void {
    const view = this.views.get(viewId);
    if (!view) {
      return;
    }
    view.channel.onRequest(method, handler);
  }

  onAnyRequest(method: string, handler: AnyRequestHandler): void {
    this.anyRequestHandlers.set(method, handler);
    // Apply to all existing views
    for (const [id, view] of this.views) {
      view.channel.onRequest(method, (payload: unknown) => handler(id, payload));
    }
  }

  offAnyRequest(method: string): void {
    this.anyRequestHandlers.delete(method);
    // Remove from all existing views
    for (const view of this.views.values()) {
      view.channel.offRequest(method);
    }
  }

  getAllChannels(): Map<string, ChannelAPI> {
    const channels = new Map<string, ChannelAPI>();
    for (const [id, view] of this.views) {
      channels.set(id, view.channel);
    }
    return channels;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  /** Destroy all views and reset internal state. */
  destroy(): void {
    for (const viewId of this.views.keys()) {
      this.destroyView(viewId);
    }
    this.anyRequestHandlers.clear();
    this.removeAllListeners();
  }
}

export const viewManager = new ViewManager();
