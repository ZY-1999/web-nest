import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog'
import { useWebAppStore } from '../../stores/webAppStore'
import { FaviconImg } from '@/renderer/components/FaviconImg'
import { webAppMainApi } from '@/shared/services'
import { Plus, MoreVertical, Pencil, Trash2, Pin, PinOff } from 'lucide-react'

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { addApp } = useWebAppStore()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) { return }

    setLoading(true)
    try {
      const app = await webAppMainApi.createWebApp(trimmed)
      addApp(app)
      setUrl('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create web app:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSubmit() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('catalog.addWebApp')}</DialogTitle>
        </DialogHeader>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('catalog.enterUrl')}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          data-testid="add-url-input"
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !url.trim()} data-testid="add-submit">
            {loading ? t('catalog.opening') : t('catalog.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({
  appId,
  open,
  onOpenChange,
}: {
  appId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { apps, updateApp } = useWebAppStore()
  const app = apps.find((a) => a.id === appId)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    if (app && open) {
      setTitle(app.title)
      setUrl(app.url)
    }
  }, [app, open])

  if (!app) { return null }

  const handleSave = async () => {
    setLoading(true)
    try {
      const updated = await webAppMainApi.updateWebApp(app.id, { title, url })
      updateApp(app.id, updated)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to update web app:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSave() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('catalog.editWebApp')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('catalog.title')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="edit-title-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('catalog.url')}</label>
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
            {loading ? t('catalog.saving') : t('catalog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AppCard({
  app,
  onOpen,
  onEdit,
  onDelete,
}: {
  app: { id: string; url: string; title: string; faviconDataUrl?: string }
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [shortcutExists, setShortcutExists] = useState(false)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Check shortcut status when menu opens
  React.useEffect(() => {
    if (!menuOpen) { return }
    webAppMainApi.hasShortcut(app.id).then(setShortcutExists).catch(() => {})
  }, [menuOpen, app.id])

  React.useEffect(() => {
    if (!menuOpen) { return }
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const handleToggleShortcut = async () => {
    setMenuOpen(false)
    try {
      if (shortcutExists) {
        await webAppMainApi.removeShortcut(app.id)
        setShortcutExists(false)
      } else {
        await webAppMainApi.createShortcut(app.id)
        setShortcutExists(true)
      }
    } catch (error) {
      console.error('Failed to toggle shortcut:', error)
    }
  }

  return (
    <div
      ref={cardRef}
      data-testid="webapp-card"
      className="group relative aspect-square flex flex-col items-center justify-center rounded-lg border border-border bg-card cursor-pointer transition-colors hover:bg-accent"
      onClick={onOpen}
    >
      {/* Favicon: 36x36 white circle, 24x24 image */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
        <FaviconImg appId={app.id} fallback={app.title} />
      </div>

      {/* Title */}
      <p className="mt-2 max-w-[80%] truncate text-center text-xs font-medium text-foreground" title={app.title}>
        {app.title}
      </p>

      {/* Hover menu trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(!menuOpen)
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
            onClick={() => { setMenuOpen(false); onEdit() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid="webapp-edit-btn"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('catalog.edit')}
          </button>
          <button
            onClick={handleToggleShortcut}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid={shortcutExists ? 'webapp-remove-shortcut-btn' : 'webapp-shortcut-btn'}
          >
            {shortcutExists ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {shortcutExists ? t('catalog.removeShortcut') : t('catalog.createShortcut')}
          </button>
          <button
            onClick={() => { setMenuOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-accent"
            data-testid="webapp-delete-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('catalog.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

export function WebCatalog() {
  const { t } = useTranslation()
  const { apps, setApps, removeApp } = useWebAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  React.useEffect(() => {
    webAppMainApi.listWebApps().then(setApps)
  }, [])

  const handleOpen = async (id: string) => {
    try {
      await webAppMainApi.openWebApp(id)
    } catch (error) {
      console.error('Failed to open web app:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await webAppMainApi.deleteWebApp(id)
      removeApp(id)
    } catch (error) {
      console.error('Failed to delete web app:', error)
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-8 pt-2">
      <h1 className="sr-only">{t('catalog.webCatalog')}</h1>
      <div className="mx-auto grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onOpen={() => handleOpen(app.id)}
            onEdit={() => setEditId(app.id)}
            onDelete={() => handleDelete(app.id)}
          />
        ))}

        <button
          onClick={() => setAddOpen(true)}
          data-testid="add-card-btn"
          className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground/60 hover:bg-accent"
        >
          <Plus className="h-8 w-8" />
          <span className="mt-1 text-sm">{t('catalog.add')}</span>
        </button>
      </div>

      {apps.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground" data-testid="empty-message">
          {t('catalog.emptyMessage')}
        </p>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditDialog appId={editId} open={editId !== null} onOpenChange={(open) => { if (!open) { setEditId(null) } }} />
    </div>
  )
}
