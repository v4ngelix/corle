import { MapLibreMap } from 'maplibre-gl'
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import './worker'
import { BASEMAPS, MAX_BOUNDS, MAX_ZOOM, OVERLAYS, START_VIEW, TILE_LAYERS } from '../config'
import { LayerControl } from './LayerControl'
import { type LayerState, loadLayerState } from './layerState'
import { LocateControl } from './LocateControl'
import { WmsImageUpdater, wmsLayer, wmsSource } from './wms'
import { ZoomControl } from './ZoomControl'

const sources: Record<string, SourceSpecification> = {
  ...Object.fromEntries(
    TILE_LAYERS.map(({ id, tiles, scheme, maxzoom, attribution }) => [
      id,
      { type: 'raster', tileSize: 256, tiles, scheme, maxzoom, attribution },
    ]),
  ),
  ...Object.fromEntries(OVERLAYS.map((o) => [o.id, wmsSource(o)])),
}

function buildLayers(state: LayerState): LayerSpecification[] {
  const basemapLayers = BASEMAPS.find((b) => b.id === state.basemap)?.layers ?? []
  return [
    ...TILE_LAYERS.map(({ id }): LayerSpecification => ({
      id,
      type: 'raster',
      source: id,
      layout: { visibility: basemapLayers.includes(id) ? 'visible' : 'none' },
    })),
    ...OVERLAYS.map((o) => wmsLayer(o, state.overlays.includes(o.id))),
  ]
}

export function MapView({ onReady }: { onReady: (map: MapLibreMap | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layerState = loadLayerState()
    const layers = buildLayers(layerState)
    const map = new MapLibreMap({
      container: containerRef.current!,
      center: START_VIEW.center,
      zoom: START_VIEW.zoom,
      maxZoom: MAX_ZOOM,
      maxBounds: MAX_BOUNDS,
      style: { version: 8, sources, layers },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      locale: {
        'GeolocateControl.FindMyLocation': 'Minu asukoht',
        'GeolocateControl.LocationNotAvailable': 'Asukoht pole saadaval',
      },
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    for (const overlay of OVERLAYS) {
      if (!overlay.tiled) new WmsImageUpdater(map, overlay)
    }
    map.addControl(new ZoomControl(), 'top-left')
    map.addControl(new LocateControl(), 'top-right')
    map.addControl(new LayerControl(BASEMAPS, OVERLAYS, layerState), 'top-right')
    onReady(map)
    return () => {
      onReady(null)
      map.remove()
    }
  }, [onReady])

  return <div ref={containerRef} className="map" />
}
