import type { IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { Basemap } from '../config'

const LAYERS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 3 2 8.5 12 14l10-5.5L12 3z"/>' +
  '<path d="m2 13 10 5.5L22 13"/>' +
  '<path d="m2 17.5 10 5.5 10-5.5"/>' +
  '</svg>'

export class LayerControl implements IControl {
  private readonly basemaps: Basemap[]
  private container?: HTMLElement
  private button?: HTMLButtonElement
  private panel?: HTMLElement
  private open = false

  constructor(basemaps: Basemap[]) {
    this.basemaps = basemaps
  }

  onAdd(map: MapLibreMap): HTMLElement {
    const container = document.createElement('div')
    container.className = 'maplibregl-ctrl layer-control'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'layer-control-button'
    button.title = 'Kihid'
    button.setAttribute('aria-label', 'Kihid')
    button.setAttribute('aria-controls', 'layer-panel')
    button.innerHTML = LAYERS_ICON
    button.addEventListener('click', () => this.setOpen(!this.open))

    const panel = document.createElement('div')
    panel.id = 'layer-panel'
    panel.className = 'layer-panel'
    panel.append(this.basemapFieldset(map))

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

  private basemapFieldset(map: MapLibreMap): HTMLElement {
    const fieldset = document.createElement('fieldset')

    const legend = document.createElement('legend')
    legend.textContent = 'Aluskaardid'
    fieldset.append(legend)

    this.basemaps.forEach((basemap, i) => {
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'basemap'
      input.value = basemap.id
      input.checked = i === 0
      input.addEventListener('change', () => this.selectBasemap(map, basemap.id))

      const label = document.createElement('label')
      label.append(input, basemap.label)
      fieldset.append(label)
    })

    return fieldset
  }

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

  private selectBasemap(map: MapLibreMap, id: string): void {
    const visible = new Set(this.basemaps.find((b) => b.id === id)?.layers)
    for (const layerId of new Set(this.basemaps.flatMap((b) => b.layers))) {
      map.setLayoutProperty(layerId, 'visibility', visible.has(layerId) ? 'visible' : 'none')
    }
  }
}
