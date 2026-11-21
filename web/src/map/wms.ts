import type { ImageSource, LayerSpecification, Map as MapLibreMap, SourceSpecification } from 'maplibre-gl'
import { MAX_BOUNDS, type WmsOverlay } from '../config'

const EARTH_RADIUS = 6378137

function getMapUrl(overlay: WmsOverlay, bbox: string, width: number, height: number): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: overlay.wmsLayer,
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
    SRS: 'EPSG:3857',
    WIDTH: String(width),
    HEIGHT: String(height),
  })
  return `${overlay.url}?${params}&BBOX=${bbox}`
}

export function toMercator([lng, lat]: [number, number]): [number, number] {
  const x = (EARTH_RADIUS * lng * Math.PI) / 180
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  return [x, y]
}

export function wmsSource(overlay: WmsOverlay): SourceSpecification {
  if (overlay.tiled) {
    return {
      type: 'raster',
      tileSize: 256,
      tiles: [getMapUrl(overlay, '{bbox-epsg-3857}', 256, 256)],
      attribution: overlay.attribution,
    }
  }
  const [[west, south], [east, north]] = MAX_BOUNDS
  return {
    type: 'image',
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  }
}

export function wmsLayer(overlay: WmsOverlay, visible: boolean): LayerSpecification {
  return {
    id: overlay.id,
    type: 'raster',
    source: overlay.id,
    minzoom: overlay.minzoom,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: { 'raster-opacity': overlay.opacity, 'raster-fade-duration': 0 },
  }
}

/** Keeps a non-tiled overlay's image in sync with the view. Needs an unrotated map. */
export class WmsImageUpdater {
  private readonly map: MapLibreMap
  private readonly overlay: WmsOverlay
  private currentUrl?: string

  constructor(map: MapLibreMap, overlay: WmsOverlay) {
    this.map = map
    this.overlay = overlay
    map.on('moveend', this.update)
    map.on('idle', this.update)
  }

  private readonly update = (): void => {
    const { map, overlay } = this
    if (map.getLayoutProperty(overlay.id, 'visibility') === 'none') return
    if (map.getZoom() < overlay.minzoom) return

    const bounds = map.getBounds()
    const nw = bounds.getNorthWest().toArray()
    const ne = bounds.getNorthEast().toArray()
    const se = bounds.getSouthEast().toArray()
    const sw = bounds.getSouthWest().toArray()
    const [minX, minY] = toMercator(sw)
    const [maxX, maxY] = toMercator(ne)
    const { clientWidth, clientHeight } = map.getCanvas()
    const url = getMapUrl(overlay, [minX, minY, maxX, maxY].join(','), clientWidth, clientHeight)
    if (url === this.currentUrl) return

    this.currentUrl = url
    const source = map.getSource<ImageSource>(overlay.id)
    source?.updateImage({ url, coordinates: [nw, ne, se, sw] })
  }
}
