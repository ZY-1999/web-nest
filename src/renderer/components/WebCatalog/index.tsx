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
import { Plus, MoreVertical, Pencil, Trash2, Pin, PinOff, Terminal } from 'lucide-react'
import type { AppServiceConfig } from '@/shared/services/webAppApi'

/** shell 下拉选项（与 shellDetector.resolveShell 接受的命名 shell 对齐；custom=用户填路径）。 */
type ShellOption = 'auto' | 'bash' | 'cmd' | 'powershell' | 'custom'

const SHELL_OPTIONS: ShellOption[] = ['auto', 'bash', 'cmd', 'powershell', 'custom']

/**
 * 把表单的 shellSelect + customPath 解析为落盘的 shell 字符串。
 * custom 时空路径兜底为 'auto'（避免把字面量 'custom' 当 shell 传给 shellDetector）。
 */
function resolveShellForSave(select: ShellOption, customPath: string): string {
  return select === 'custom' ? (customPath.trim() || 'auto') : select
}

/**
 * 把落盘的 shell 字符串反解为表单状态：命名 shell 直接映射，其余视为 custom + 路径。
 */
function shellToFormState(shell: string): { select: ShellOption; customPath: string } {
  if (SHELL_OPTIONS.includes(shell as ShellOption) && shell !== 'custom') {
    return { select: shell as ShellOption, customPath: '' }
  }
  return { select: 'custom', customPath: shell }
}

/**
 * AddDialog/EditDialog 共用的服务配置区（开关 + command + shell 下拉 + 自定义路径）。
 * 受控组件——状态由父 dialog 持有，本组件只负责渲染与 onChange 回传。
 */
function ServiceConfigFields({
  enabled,
  command,
  shellSelect,
  customPath,
  commandError,
  onToggle,
  onCommandChange,
  onShellChange,
  onCustomPathChange,
}: {
  enabled: boolean
  command: string
  shellSelect: ShellOption
  customPath: string
  commandError: string | null
  onToggle: (enabled: boolean) => void
  onCommandChange: (value: string) => void
  onShellChange: (value: ShellOption) => void
  onCustomPathChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4"
          data-testid="service-toggle"
        />
        {t('catalog.serviceToggle')}
      </label>

      {enabled && (
        <div className="space-y-2 pl-6" data-testid="service-fields">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('catalog.serviceCommand')}</label>
            <input
              type="text"
              value={command}
              onChange={(e) => onCommandChange(e.target.value)}
              placeholder={t('catalog.serviceCommandPlaceholder')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="service-command-input"
            />
            {commandError && (
              <p className="mt-1 text-xs text-red-500" data-testid="service-command-error">
                {commandError}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('catalog.serviceShellLabel')}</label>
            <select
              value={shellSelect}
              onChange={(e) => onShellChange(e.target.value as ShellOption)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="service-shell-select"
            >
              {SHELL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`catalog.serviceShell.${opt}`)}
                </option>
              ))}
            </select>
          </div>

          {shellSelect === 'custom' && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('catalog.serviceShellCustomPath')}</label>
              <input
                type="text"
                value={customPath}
                onChange={(e) => onCustomPathChange(e.target.value)}
                placeholder={t('catalog.serviceShellCustomPlaceholder')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="service-custom-path-input"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { addApp } = useWebAppStore()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [serviceEnabled, setServiceEnabled] = useState(false)
  const [command, setCommand] = useState('')
  const [shellSelect, setShellSelect] = useState<ShellOption>('auto')
  const [customPath, setCustomPath] = useState('')

  const commandError = serviceEnabled && !command.trim() ? t('errors.serviceCommandRequired') : null
  const canSubmit = !!url.trim() && !commandError

  const resetForm = () => {
    setUrl('')
    setServiceEnabled(false)
    setCommand('')
    setShellSelect('auto')
    setCustomPath('')
  }

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed || commandError) { return }

    const service: AppServiceConfig | null = serviceEnabled
      ? { command: command.trim(), shell: resolveShellForSave(shellSelect, customPath) }
      : null

    setLoading(true)
    try {
      const app = await webAppMainApi.createWebApp(trimmed, service)
      addApp(app)
      resetForm()
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
        <ServiceConfigFields
          enabled={serviceEnabled}
          command={command}
          shellSelect={shellSelect}
          customPath={customPath}
          commandError={commandError}
          onToggle={setServiceEnabled}
          onCommandChange={setCommand}
          onShellChange={setShellSelect}
          onCustomPathChange={setCustomPath}
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !canSubmit} data-testid="add-submit">
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
  const [serviceEnabled, setServiceEnabled] = useState(false)
  const [command, setCommand] = useState('')
  const [shellSelect, setShellSelect] = useState<ShellOption>('auto')
  const [customPath, setCustomPath] = useState('')

  React.useEffect(() => {
    if (app && open) {
      setTitle(app.title)
      setUrl(app.url)
      // 回填服务配置：无 service → 开关 off；有 → 开关 on + command/shell 反解
      if (app.service) {
        setServiceEnabled(true)
        setCommand(app.service.command)
        const { select, customPath: cp } = shellToFormState(app.service.shell)
        setShellSelect(select)
        setCustomPath(cp)
      } else {
        setServiceEnabled(false)
        setCommand('')
        setShellSelect('auto')
        setCustomPath('')
      }
    }
  }, [app, open])

  if (!app) { return null }

  const commandError = serviceEnabled && !command.trim() ? t('errors.serviceCommandRequired') : null
  const canSubmit = !!url.trim() && !commandError

  const handleSave = async () => {
    if (!url.trim() || commandError) { return }

    // 开关 on → 设置/覆盖 service；off → 清除（转普通型）
    const service: AppServiceConfig | null = serviceEnabled
      ? { command: command.trim(), shell: resolveShellForSave(shellSelect, customPath) }
      : null

    setLoading(true)
    try {
      const updated = await webAppMainApi.updateWebApp(app.id, { title, url, service })
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
          <ServiceConfigFields
            enabled={serviceEnabled}
            command={command}
            shellSelect={shellSelect}
            customPath={customPath}
            commandError={commandError}
            onToggle={setServiceEnabled}
            onCommandChange={setCommand}
            onShellChange={setShellSelect}
            onCustomPathChange={setCustomPath}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading || !canSubmit} data-testid="edit-submit">
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
  app: { id: string; url: string; title: string; faviconDataUrl?: string; service?: AppServiceConfig }
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
      {/* Favicon: 36x36 white circle, 24x24 image; service app 加 Terminal 角标 */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white">
        <FaviconImg appId={app.id} fallback={app.title} />
        {app.service && (
          <span
            className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm"
            title={t('catalog.serviceBadge')}
            data-testid="webapp-service-badge"
          >
            <Terminal className="h-2.5 w-2.5" />
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
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid="webapp-edit-btn"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('catalog.edit')}
          </button>
          <button
            onClick={handleToggleShortcut}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            data-testid={shortcutExists ? 'webapp-remove-shortcut-btn' : 'webapp-shortcut-btn'}
          >
            {shortcutExists ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {shortcutExists ? t('catalog.removeShortcut') : t('catalog.createShortcut')}
          </button>
          <button
            onClick={() => { setMenuOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-red-500 hover:bg-accent"
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
