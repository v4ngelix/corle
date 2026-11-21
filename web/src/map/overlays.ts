import type { LayerSpecification, Map as MapLibreMap, SourceSpecification, VectorTileSource } from 'maplibre-gl'
import { DRAWINGS, type Overlay, OVERLAYS, STATIC_LAYERS, type VectorOverlay } from '../config'
import { wmsLayer, wmsSource } from './wms'

const STATIC_SOURCE = 'static-layers'
const DRAWINGS_SOURCE = 'drawings'

export const overlaySources: Record<string, SourceSpecification> = {
  ...Object.fromEntries(OVERLAYS.flatMap((o) => (o.kind === 'wms' ? [[o.id, wmsSource(o)]] : []))),
  [STATIC_SOURCE]: { type: 'vector', url: STATIC_LAYERS.url, attribution: STATIC_LAYERS.attribution },
  [DRAWINGS_SOURCE]: { type: 'geojson', data: DRAWINGS.url, attribution: DRAWINGS.attribution },
}

function sourceOf(overlay: VectorOverlay): { source: string; 'source-layer'?: string } {
  return overlay.source === 'drawings'
    ? { source: DRAWINGS_SOURCE }
    : { source: STATIC_SOURCE, 'source-layer': overlay.id }
}

function layerIds(overlay: Overlay): string[] {
  return overlay.kind === 'wms' ? [overlay.id] : overlay.styles.map((_, i) => `${overlay.id}-${i}`)
}

export function overlayLayers(overlay: Overlay, visible: boolean): LayerSpecification[] {
  if (overlay.kind === 'wms') return [wmsLayer(overlay, visible)]
  const ids = layerIds(overlay)
  return overlay.styles.map(
    (style, i) =>
      ({
        ...style,
        id: ids[i],
        ...sourceOf(overlay),
        layout: { ...style.layout, visibility: visible ? 'visible' : 'none' },
      }) as LayerSpecification,
  )
}

export function setOverlayVisible(map: MapLibreMap, overlay: Overlay, visible: boolean): void {
  for (const id of layerIds(overlay)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}

/** Reloads the static layers after one of their source files was replaced; the query string busts caches. */
export function reloadStaticLayers(map: MapLibreMap): void {
  map.getSource<VectorTileSource>(STATIC_SOURCE)?.setUrl(`${STATIC_LAYERS.url}?v=${Date.now()}`)
}
