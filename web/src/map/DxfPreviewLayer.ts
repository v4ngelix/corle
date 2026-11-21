import { LngLatBounds } from 'maplibre-gl'
import type { GeoJSONSource, GeoJSONSourceSpecification, Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'
import type { PreviewLayer } from '../api'

const SOURCE = 'dxf-preview'
const CONTEXT = 'dxf-preview-context'
const SELECTED = 'dxf-preview-selected'

/** Lines of an uploaded DXF: chosen layers in red, the rest thin grey for context. */
export class DxfPreviewLayer {
  private readonly map: MapLibreMap

  constructor(map: MapLibreMap) {
    this.map = map
  }

  show(layers: PreviewLayer[], selected: Set<string>): void {
    const data: GeoJSONSourceSpecification['data'] = {
      type: 'FeatureCollection',
      features: layers
        .filter((l) => l.inEstonia)
        .map((l) => ({ type: 'Feature', properties: { selected: selected.has(l.name) }, geometry: l.geometry })),
    }
    const source = this.map.getSource<GeoJSONSource>(SOURCE)
    if (source) {
      source.setData(data)
      return
    }
    this.map.addSource(SOURCE, { type: 'geojson', data })
    this.map.addLayer({
      id: CONTEXT,
      type: 'line',
      source: SOURCE,
      filter: ['!', ['get', 'selected']],
      paint: { 'line-color': '#78909c', 'line-width': 1, 'line-opacity': 0.6 },
    })
    this.map.addLayer({
      id: SELECTED,
      type: 'line',
      source: SOURCE,
      filter: ['get', 'selected'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e53935', 'line-width': 3, 'line-dasharray': [2, 1.5] },
    })
  }

  /** Zooms to the chosen layers, or to the whole file while none is chosen. */
  fit(layers: PreviewLayer[], selected: Set<string>, padding: PaddingOptions): void {
    const usable = layers.filter((l) => l.inEstonia)
    const chosen = usable.filter((l) => selected.has(l.name))
    const bounds = new LngLatBounds()
    for (const layer of chosen.length ? chosen : usable) {
      for (const line of layer.geometry.coordinates) for (const [lon, lat] of line) bounds.extend([lon, lat])
    }
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding, maxZoom: 18 })
  }

  clear(): void {
    for (const id of [SELECTED, CONTEXT]) if (this.map.getLayer(id)) this.map.removeLayer(id)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
  }
}
