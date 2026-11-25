import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Basemap, LayerGroup, Overlay } from '../config'
import { type LayerState, saveLayerState } from './layerState'
import { setOverlayVisible } from './overlays'
import { minzoomOf, zoomToShow } from './overlayZoom'
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
  private readonly groups: LayerGroup[]
  private readonly state: LayerState

  constructor(basemaps: Basemap[], overlays: Overlay[], groups: LayerGroup[], state: LayerState) {
    super({ id: 'layer-panel', title: 'Kihid', icon: LAYERS_ICON })
    this.basemaps = basemaps
    this.overlays = overlays
    this.groups = groups
    this.state = { basemap: state.basemap, overlays: [...state.overlays] }
    if (import.meta.env.DEV) checkGroups(overlays, groups)
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

    const byId = new Map(this.overlays.map((o) => [o.id, o]))
    const inputs: HTMLInputElement[] = []
    const groups: { input: HTMLInputElement; children: HTMLInputElement[] }[] = []

    const setLayers = (targets: HTMLInputElement[], checked: boolean): void => {
      for (const input of targets) {
        input.checked = checked
        setOverlayVisible(map, byId.get(input.value)!, checked)
      }
      groups.forEach((g) => setTriState(g.input, g.children))
      setTriState(root.input, inputs)
      this.saveOverlays(inputs)
      if (checked) this.zoomToVisible(map, targets.map((input) => byId.get(input.value)!))
    }

    for (const group of this.groups) {
      const header = checkbox(group.label)
      header.label.classList.add('overlay-group-label')
      const children = document.createElement('div')
      children.className = 'overlay-list'
      children.id = `overlay-group-${group.id}`

      const row = document.createElement('div')
      row.className = 'overlay-group'
      row.append(header.label, collapseButton(group.label, children))
      list.append(row, children)

      const childInputs = group.overlays.flatMap((id) => {
        const overlay = byId.get(id)
        if (!overlay) return []
        const { label, input } = checkbox(overlay.label)
        const minzoom = minzoomOf(overlay)
        if (minzoom > 0) {
          const hint = document.createElement('span')
          hint.className = 'overlay-zoom-hint'
          hint.textContent = `al. z${minzoom}`
          label.append(hint)
        }
        input.value = overlay.id
        input.checked = this.state.overlays.includes(overlay.id)
        input.addEventListener('change', () => setLayers([input], input.checked))
        children.append(label)
        return [input]
      })
      inputs.push(...childInputs)
      groups.push({ input: header.input, children: childInputs })
      header.input.addEventListener('change', () => setLayers(childInputs, header.input.checked))
      setTriState(header.input, childInputs)
    }

    root.input.addEventListener('change', () => setLayers(inputs, root.input.checked))
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

  private zoomToVisible(map: MapLibreMap, overlays: Overlay[]): void {
    const zoom = map.getZoom()
    const needed = overlays.map((overlay) => zoomToShow(overlay, zoom)).filter((z): z is number => z !== null)
    if (needed.length === 0) return
    map.easeTo({ zoom: Math.max(...needed), duration: 600 })
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

function collapseButton(groupLabel: string, target: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'overlay-group-toggle'
  button.setAttribute('aria-expanded', 'true')
  button.setAttribute('aria-controls', target.id)
  button.setAttribute('aria-label', groupLabel)
  button.addEventListener('click', () => {
    target.hidden = !target.hidden
    button.setAttribute('aria-expanded', String(!target.hidden))
  })
  return button
}

/** Warns when an overlay is listed in no group or in several, or a group names an unknown overlay. */
function checkGroups(overlays: Overlay[], groups: LayerGroup[]): void {
  const listed = groups.flatMap((g) => g.overlays)
  for (const o of overlays) {
    const count = listed.filter((id) => id === o.id).length
    if (count !== 1) console.warn(`Overlay "${o.id}" is in ${count} layer groups, expected 1`)
  }
  for (const id of listed) {
    if (!overlays.some((o) => o.id === id)) console.warn(`Layer group lists unknown overlay "${id}"`)
  }
}

function setTriState(parent: HTMLInputElement, children: HTMLInputElement[]): void {
  const on = children.filter((c) => c.checked).length
  parent.checked = on > 0 && on === children.length
  parent.indeterminate = on > 0 && on < children.length
}
