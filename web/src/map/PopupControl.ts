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
    this.setOpen(false)

    document.addEventListener('pointerdown', this.onPointerDown, true)
    document.addEventListener('keydown', this.onKeyDown)
    return container
  }

  onRemove(): void {
    document.removeEventListener('pointerdown', this.onPointerDown, true)
    document.removeEventListener('keydown', this.onKeyDown)
    this.container?.remove()
    this.container = this.button = this.panel = undefined
  }

  protected abstract panelContent(map: MapLibreMap): HTMLElement[]

  private setOpen(open: boolean): void {
    this.open = open
    this.panel!.hidden = !open
    this.button!.setAttribute('aria-expanded', String(open))
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
