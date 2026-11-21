import {
  isLoggedIn,
  type LayerFile,
  layerFileUrl,
  listLayerFiles,
  login,
  logout,
  uploadLayerFile,
} from '../api'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { PopupControl } from './PopupControl'

const FOLDER =
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' +
  '<rect x="10" y="9" width="14" height="15" fill="#fff" stroke="none"/>'

const FOLDER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  FOLDER +
  '<path d="M15 22v-9m-2 2 2-2 2 2"/>' +
  '<path d="M20 13v9m-2-2 2 2 2-2"/>' +
  '</svg>'

const LOCKED_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  FOLDER +
  '<rect x="13" y="16" width="8" height="6" rx="1"/>' +
  '<path d="M15 16v-2a2 2 0 0 1 4 0v2"/>' +
  '</svg>'

const TRAY = '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">${TRAY}<path d="M12 4v11m-4-4 4 4 4-4"/></svg>`
const UPLOAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">${TRAY}<path d="M12 15V4M8 8l4-4 4 4"/></svg>`

const DRAWINGS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/></svg>'

export interface UploadControlOptions {
  onLayerUpdated: () => void
  onLoginChange: (loggedIn: boolean) => void
  onOpenDrawings: () => void
}

const LOCKED_TITLE = 'Logi sisse'
const UNLOCKED_TITLE = 'Kihtide failid'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' })
}

/** Login, then download/upload of the static layers' GeoPackages and the way to the drawings panel. */
export class UploadControl extends PopupControl {
  private readonly callbacks: UploadControlOptions
  private loggedIn = false
  private layers: LayerFile[] = []
  private error = ''
  private status: Record<string, { text: string; kind: 'info' | 'ok' | 'error' }> = {}
  private busy = false
  private passwordInput?: HTMLInputElement

  constructor(options: UploadControlOptions) {
    super({ id: 'upload-panel', title: LOCKED_TITLE, icon: LOCKED_ICON })
    this.callbacks = options
  }

  override onAdd(map: MapLibreMap): HTMLElement {
    const container = super.onAdd(map)
    isLoggedIn()
      .then((ok) => (ok ? this.enter() : undefined))
      .catch(() => {})
    return container
  }

  protected override onOpen(): void {
    if (this.loggedIn) void this.loadLayers()
    else this.passwordInput?.focus()
  }

  protected override panelContent(): HTMLElement[] {
    return this.loggedIn ? this.layerList() : [this.loginForm()]
  }

  private loginForm(): HTMLElement {
    const form = el('form', 'upload-login')
    const label = el('label', undefined, 'Parool')
    const input = el('input')
    input.type = 'password'
    input.autocomplete = 'current-password'
    input.required = true
    label.append(input)
    const submit = el('button', 'upload-button', 'Logi sisse')
    submit.type = 'submit'
    submit.disabled = this.busy
    form.append(label, submit)
    if (this.error) form.append(el('p', 'upload-error', this.error))
    this.passwordInput = input

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.busy = true
      submit.disabled = true
      login(input.value)
        .then(() => this.enter())
        .catch((err: Error) => {
          this.busy = false
          this.error = err.message
          this.refresh()
          this.passwordInput?.focus()
        })
    })
    return form
  }

  private layerList(): HTMLElement[] {
    const drawings = el('button', 'upload-button upload-drawings', 'Teostusjoonised')
    drawings.type = 'button'
    drawings.insertAdjacentHTML('afterbegin', DRAWINGS_ICON)
    drawings.addEventListener('click', () => {
      this.close()
      this.callbacks.onOpenDrawings()
    })

    const list = el('div', 'upload-list')
    for (const layer of this.layers) {
      const row = el('div', 'upload-row')
      const name = el('div', 'upload-name', layer.label)
      const meta = el('div', 'upload-meta', `Muudetud ${formatTime(layer.updatedAt)}`)

      const actions = el('div', 'upload-actions')
      const download = el('a', 'upload-button', 'Lae alla')
      download.insertAdjacentHTML('afterbegin', DOWNLOAD_ICON)
      download.href = layerFileUrl(layer.id)
      download.download = ''

      const pick = el('label', 'upload-button', 'Lae üles')
      pick.insertAdjacentHTML('afterbegin', UPLOAD_ICON)
      const input = el('input')
      input.type = 'file'
      input.accept = '.gpkg'
      input.hidden = true
      input.disabled = this.busy
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        input.value = ''
        if (file) void this.upload(layer, file)
      })
      pick.append(input)
      if (this.busy) pick.classList.add('is-disabled')
      actions.append(download, pick)

      row.append(name, meta, actions)
      const status = this.status[layer.id]
      if (status) row.append(el('p', `upload-${status.kind}`, status.text))
      list.append(row)
    }
    if (this.error) list.append(el('p', 'upload-error', this.error))

    const out = el('button', 'upload-logout', 'Logi välja')
    out.type = 'button'
    out.addEventListener('click', () => {
      logout()
        .catch(() => {})
        .finally(() => this.leave())
    })
    return [drawings, list, out]
  }

  private async upload(layer: LayerFile, file: File): Promise<void> {
    if (!window.confirm(`Asendada kihi „${layer.label}“ andmed failiga „${file.name}“?`)) return
    this.busy = true
    this.status = { [layer.id]: { text: 'Laadin üles…', kind: 'info' } }
    this.refresh()
    try {
      await uploadLayerFile(layer.id, file)
      this.status = { [layer.id]: { text: '✓ Uuendatud', kind: 'ok' } }
      this.callbacks.onLayerUpdated()
    } catch (err) {
      this.status = { [layer.id]: { text: (err as Error).message, kind: 'error' } }
    }
    this.busy = false
    await this.loadLayers()
  }

  private async loadLayers(): Promise<void> {
    try {
      this.layers = await listLayerFiles()
      this.error = ''
    } catch (err) {
      if (!(await isLoggedIn().catch(() => true))) return this.leave()
      this.error = (err as Error).message
    }
    this.refresh()
  }

  private async enter(): Promise<void> {
    this.loggedIn = true
    this.busy = false
    this.error = ''
    this.setButton(FOLDER_ICON, UNLOCKED_TITLE)
    this.callbacks.onLoginChange(true)
    await this.loadLayers()
  }

  private leave(): void {
    this.loggedIn = false
    this.busy = false
    this.layers = []
    this.status = {}
    this.error = ''
    this.setButton(LOCKED_ICON, LOCKED_TITLE)
    this.callbacks.onLoginChange(false)
    this.refresh()
  }
}
