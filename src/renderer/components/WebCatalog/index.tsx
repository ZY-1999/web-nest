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
import { Plus, MoreVertical, Pencil, Trash2, Pin } from 'lucide-react';

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

function AppCard({
  app,
  onOpen,
  onEdit,
  onDelete,
  onCreateShortcut,
}: {
  app: { id: string; url: string; title: string; faviconDataUrl?: string };
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateShortcut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) { return; }
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  return (
    <div
      ref={cardRef}
      data-testid="webapp-card"
      className="group relative aspect-square flex flex-col items-center justify-center rounded-lg border border-border bg-card cursor-pointer transition-colors hover:bg-accent"
      onClick={onOpen}
    >
      {/* Favicon: 36x36 white circle, 24x24 image */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
        {app.faviconDataUrl ? (
          <img src={app.faviconDataUrl} alt="" className="h-6 w-6 rounded" data-testid="webapp-favicon" />
        ) : (
          <span className="h-6 w-6 flex items-center justify-center text-xs font-bold text-gray-500" data-testid="webapp-favicon-fallback">
            {app.title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="mt-2 max-w-[80%] truncate text-center text-xs font-medium text-foreground" title={app.title}>
        {app.title}
      </p>

      {/* Hover menu trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="absolute top-1 right-1 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
        data-testid="webapp-menu-btn"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute top-7 right-1 z-10 rounded-md border border-border bg-card shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setMenuOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid="webapp-edit-btn"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => { setMenuOpen(false); onCreateShortcut(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid="webapp-shortcut-btn"
          >
            <Pin className="h-3.5 w-3.5" />
            Create Shortcut
          </button>
          <button
            onClick={() => { setMenuOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-accent"
            data-testid="webapp-delete-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function WebCatalog() {
  const { apps, setApps, removeApp } = useWebAppStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  React.useEffect(() => {
    webAppMainApi.listWebApps().then(setApps);
  }, []);

  const handleOpen = async (id: string) => {
    try {
      await webAppMainApi.openWebApp(id);
    } catch (error) {
      console.error('Failed to open web app:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webAppMainApi.deleteWebApp(id);
      removeApp(id);
    } catch (error) {
      console.error('Failed to delete web app:', error);
    }
  };

  const handleCreateShortcut = async (id: string) => {
    try {
      await webAppMainApi.createShortcut(id);
    } catch (error) {
      console.error('Failed to create shortcut:', error);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-8 pt-2">
      <h1 className="sr-only">Web Catalog</h1>
      <div className="mx-auto grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onOpen={() => handleOpen(app.id)}
            onEdit={() => setEditId(app.id)}
            onDelete={() => handleDelete(app.id)}
            onCreateShortcut={() => handleCreateShortcut(app.id)}
          />
        ))}

        <button
          onClick={() => setAddOpen(true)}
          data-testid="add-card-btn"
          className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground/60 hover:bg-accent"
        >
          <Plus className="h-8 w-8" />
          <span className="mt-1 text-sm">Add</span>
        </button>
      </div>

      {apps.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground" data-testid="empty-message">
          No web apps. Click + to add one.
        </p>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditDialog appId={editId} open={editId !== null} onOpenChange={(open) => { if (!open) { setEditId(null); } }} />
    </div>
  );
}
