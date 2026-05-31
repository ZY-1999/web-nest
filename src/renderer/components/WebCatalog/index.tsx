import React, { useState } from 'react';
import { Button } from '@/renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog';
import { useWebAppStore } from '../../stores/webAppStore';
import { webAppMainApi } from '@/shared/services';
import { Plus } from 'lucide-react';

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addApp } = useWebAppStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) { return; }

    setLoading(true);
    try {
      const app = await webAppMainApi.createWebApp(trimmed);
      addApp(app);
      setUrl('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create web app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSubmit(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Web App</DialogTitle>
        </DialogHeader>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL (e.g. https://example.com)"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          data-testid="add-url-input"
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !url.trim()} data-testid="add-submit">
            {loading ? 'Opening...' : 'Open'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  appId,
  open,
  onOpenChange,
}: {
  appId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { apps, updateApp } = useWebAppStore();
  const app = apps.find((a) => a.id === appId);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (app && open) {
      setTitle(app.title);
      setUrl(app.url);
    }
  }, [app, open]);

  if (!app) { return null; }

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await webAppMainApi.updateWebApp(app.id, { title, url });
      updateApp(app.id, updated);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update web app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSave(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Web App</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="edit-title-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="edit-url-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading} data-testid="edit-submit">
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebCatalog() {
  const { apps, removeApp } = useWebAppStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const handleClose = async (id: string) => {
    try {
      await webAppMainApi.closeWebApp(id);
      removeApp(id);
    } catch (error) {
      console.error('Failed to close web app:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <h1 className="mb-8 text-center text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        Web Catalog
      </h1>

      <div className="mx-auto grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {apps.map((app) => (
          <div
            key={app.id}
            data-testid="webapp-card"
            className="group cursor-pointer rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
            onClick={() => setEditId(app.id)}
          >
            <p className="truncate text-white font-medium">{app.title || app.url}</p>
            <p className="mt-1 truncate text-sm text-white/50">{app.url}</p>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClose(app.id);
              }}
              variant="outline"
              size="sm"
              className="mt-3"
              data-testid="webapp-close-btn"
            >
              Close
            </Button>
          </div>
        ))}

        <button
          onClick={() => setAddOpen(true)}
          data-testid="add-card-btn"
          className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 text-white/40 transition-colors hover:border-white/40 hover:text-white/60 hover:bg-white/10"
        >
          <Plus className="h-8 w-8" />
          <span className="mt-1 text-sm">Add</span>
        </button>
      </div>

      {apps.length === 0 && (
        <p className="mt-8 text-center text-white/30" data-testid="empty-message">
          No web apps open. Click + to add one.
        </p>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditDialog appId={editId} open={editId !== null} onOpenChange={(open) => { if (!open) { setEditId(null); } }} />
    </div>
  );
}
