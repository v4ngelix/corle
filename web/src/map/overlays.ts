import type { LayerSpecification, Map as MapLibreMap, SourceSpecification } from 'maplibre-gl'
import { type Overlay, OVERLAYS, STATIC_LAYERS } from '../config'
import { wmsLayer, wmsSource } from './wms'

const STATIC_SOURCE = 'static-layers'

export const overlaySources: Record<string, SourceSpecification> = {
  ...Object.fromEntries(OVERLAYS.flatMap((o) => (o.kind === 'wms' ? [[o.id, wmsSource(o)]] : []))),
  [STATIC_SOURCE]: { type: 'vector', url: STATIC_LAYERS.url, attribution: STATIC_LAYERS.attribution },
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
        source: STATIC_SOURCE,
        'source-layer': overlay.id,
        layout: { ...style.layout, visibility: visible ? 'visible' : 'none' },
      }) as LayerSpecification,
  )
}

export function setOverlayVisible(map: MapLibreMap, overlay: Overlay, visible: boolean): void {
  for (const id of layerIds(overlay)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}
