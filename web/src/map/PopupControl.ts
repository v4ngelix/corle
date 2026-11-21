import type { IControl, Map as MapLibreMap } from 'maplibre-gl'

export interface PopupControlOptions {
  id: string
  title: string
  icon: string
}

/** Map button that toggles a popup panel; closes on outside click and Escape. */
export abstract class PopupControl implements IControl {
  private readonly options: PopupControlOptions
  private container?: HTMLElement
  private button?: HTMLButtonElement
  private panel?: HTMLElement
  private map?: MapLibreMap
  private open = false

  constructor(options: PopupControlOptions) {
    this.options = options
  }

  onAdd(map: MapLibreMap): HTMLElement {
    const { id, title, icon } = this.options
    const container = document.createElement('div')
    container.className = 'maplibregl-ctrl layer-control'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'layer-control-button'
    button.title = title
    button.setAttribute('aria-label', title)
    button.setAttribute('aria-controls', id)
    button.innerHTML = icon
    button.addEventListener('click', () => this.setOpen(!this.open))

    const panel = document.createElement('div')
    panel.id = id
    panel.className = 'layer-panel'
    panel.append(...this.panelContent(map))

    container.append(button, panel)
    this.container = container
    this.button = button
    this.panel = panel
    this.map = map
    this.setOpen(false)

    document.addEventListener('pointerdown', this.onPointerDown, true)
    document.addEventListener('keydown', this.onKeyDown)
    return container
  }

  onRemove(): void {
    document.removeEventListener('pointerdown', this.onPointerDown, true)
    document.removeEventListener('keydown', this.onKeyDown)
    this.container?.remove()
    this.container = this.button = this.panel = this.map = undefined
  }

  protected abstract panelContent(map: MapLibreMap): HTMLElement[]

  /** Called each time the panel opens. */
  protected onOpen(): void {}

  /** Rebuilds the panel from panelContent(). */
  protected refresh(): void {
    if (this.panel && this.map) this.panel.replaceChildren(...this.panelContent(this.map))
  }

  protected setButton(icon: string, title: string): void {
    if (!this.button) return
    this.button.innerHTML = icon
    this.button.title = title
    this.button.setAttribute('aria-label', title)
  }

  private setOpen(open: boolean): void {
    this.open = open
    this.panel!.hidden = !open
    this.button!.setAttribute('aria-expanded', String(open))
    if (open) this.onOpen()
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.open && !this.container?.contains(e.target as Node)) this.setOpen(false)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      this.setOpen(false)
      this.button?.focus()
    }
  }
}
