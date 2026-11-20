import type { IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { Basemap } from '../config'

export class BasemapControl implements IControl {
  private readonly basemaps: Basemap[]
  private container?: HTMLElement

  constructor(basemaps: Basemap[]) {
    this.basemaps = basemaps
  }

  onAdd(map: MapLibreMap): HTMLElement {
    const container = document.createElement('fieldset')
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group basemap-control'

    const legend = document.createElement('legend')
    legend.textContent = 'Aluskaart'
    container.append(legend)

    this.basemaps.forEach((basemap, i) => {
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'basemap'
      input.value = basemap.id
      input.checked = i === 0
      input.addEventListener('change', () => this.select(map, basemap.id))

      const label = document.createElement('label')
      label.append(input, basemap.label)
      container.append(label)
    })

    this.container = container
    return container
  }

  onRemove(): void {
    this.container?.remove()
    this.container = undefined
  }

  private select(map: MapLibreMap, id: string): void {
    const visible = new Set(this.basemaps.find((b) => b.id === id)?.layers)
    for (const layerId of new Set(this.basemaps.flatMap((b) => b.layers))) {
      map.setLayoutProperty(layerId, 'visibility', visible.has(layerId) ? 'visible' : 'none')
    }
  }
}
