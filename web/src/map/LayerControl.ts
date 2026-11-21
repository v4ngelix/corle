import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Basemap, Overlay } from '../config'
import { type LayerState, saveLayerState } from './layerState'
import { setOverlayVisible } from './overlays'
import { PopupControl } from './PopupControl'

const LAYERS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 3 2 8.5 12 14l10-5.5L12 3z"/>' +
  '<path d="m2 13 10 5.5L22 13"/>' +
  '<path d="m2 17.5 10 5.5 10-5.5"/>' +
  '</svg>'

export class LayerControl extends PopupControl {
  private readonly basemaps: Basemap[]
  private readonly overlays: Overlay[]
  private readonly state: LayerState

  constructor(basemaps: Basemap[], overlays: Overlay[], state: LayerState) {
    super({ id: 'layer-panel', title: 'Kihid', icon: LAYERS_ICON })
    this.basemaps = basemaps
    this.overlays = overlays
    this.state = { basemap: state.basemap, overlays: [...state.overlays] }
  }

  protected override panelContent(map: MapLibreMap): HTMLElement[] {
    return [this.basemapFieldset(map), this.overlayFieldset(map)]
  }

  private basemapFieldset(map: MapLibreMap): HTMLElement {
    const fieldset = document.createElement('fieldset')

    const legend = document.createElement('legend')
    legend.textContent = 'Aluskaardid'
    fieldset.append(legend)

    this.basemaps.forEach((basemap) => {
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'basemap'
      input.value = basemap.id
      input.checked = basemap.id === this.state.basemap
      input.addEventListener('change', () => this.selectBasemap(map, basemap.id))

      const label = document.createElement('label')
      label.append(input, basemap.label)
      fieldset.append(label)
    })

    return fieldset
  }

  private overlayFieldset(map: MapLibreMap): HTMLElement {
    const fieldset = document.createElement('fieldset')
    fieldset.className = 'overlay-tree'

    const root = checkbox('Kihid')
    root.label.classList.add('overlay-root')
    const list = document.createElement('div')
    list.className = 'overlay-list'
    fieldset.append(root.label, list)

    const setLayer = (i: number, checked: boolean): void => {
      inputs[i].checked = checked
      setOverlayVisible(map, this.overlays[i], checked)
    }

    const inputs = this.overlays.map((overlay, i) => {
      const { label, input } = checkbox(overlay.label)
      input.value = overlay.id
      input.checked = this.state.overlays.includes(overlay.id)
      input.addEventListener('change', () => {
        setLayer(i, input.checked)
        setTriState(root.input, inputs)
        this.saveOverlays(inputs)
      })
      list.append(label)
      return input
    })

    root.input.addEventListener('change', () => {
      inputs.forEach((_, i) => setLayer(i, root.input.checked))
      setTriState(root.input, inputs)
      this.saveOverlays(inputs)
    })

    setTriState(root.input, inputs)
    return fieldset
  }

  private selectBasemap(map: MapLibreMap, id: string): void {
    const visible = new Set(this.basemaps.find((b) => b.id === id)?.layers)
    for (const layerId of new Set(this.basemaps.flatMap((b) => b.layers))) {
      map.setLayoutProperty(layerId, 'visibility', visible.has(layerId) ? 'visible' : 'none')
    }
    this.state.basemap = id
    saveLayerState(this.state)
  }

  private saveOverlays(inputs: HTMLInputElement[]): void {
    this.state.overlays = inputs.filter((c) => c.checked).map((c) => c.value)
    saveLayerState(this.state)
  }
}

function checkbox(text: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const input = document.createElement('input')
  input.type = 'checkbox'
  const label = document.createElement('label')
  label.append(input, text)
  return { label, input }
}

function setTriState(parent: HTMLInputElement, children: HTMLInputElement[]): void {
  const on = children.filter((c) => c.checked).length
  parent.checked = on > 0 && on === children.length
  parent.indeterminate = on > 0 && on < children.length
}
