import { addProtocol, MapLibreMap } from 'maplibre-gl'
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { useEffect, useRef } from 'react'
import './worker'
import { BASEMAPS, MAX_BOUNDS, MAX_ZOOM, OVERLAYS, TILE_LAYERS } from '../config'
import { CadastrePopup } from './CadastrePopup'
import { LayerControl } from './LayerControl'
import { type LayerState, loadLayerState } from './layerState'
import { LocateControl } from './LocateControl'
import { overlayLayers, overlaySources, reloadStaticLayers } from './overlays'
import { UploadControl } from './UploadControl'
import { loadView, saveView } from './viewHash'
import { WmsImageUpdater } from './wms'
import { ZoomControl } from './ZoomControl'

addProtocol('pmtiles', new Protocol().tile)

const sources: Record<string, SourceSpecification> = {
  ...Object.fromEntries(
    TILE_LAYERS.map(({ id, tiles, scheme, maxzoom, attribution }) => [
      id,
      { type: 'raster', tileSize: 256, tiles, scheme, maxzoom, attribution },
    ]),
  ),
  ...overlaySources,
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
    ...OVERLAYS.flatMap((o) => overlayLayers(o, state.overlays.includes(o.id))),
  ]
}

export function MapView({ onReady }: { onReady: (map: MapLibreMap | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layerState = loadLayerState()
    const layers = buildLayers(layerState)
    const view = loadView()
    const map = new MapLibreMap({
      container: containerRef.current!,
      center: view.center,
      zoom: view.zoom,
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
    map.doubleClickZoom.disable()
    new CadastrePopup(map)
    map.on('moveend', () => saveView(map))
    for (const overlay of OVERLAYS) {
      if (overlay.kind === 'wms' && !overlay.tiled) new WmsImageUpdater(map, overlay)
    }
    map.addControl(new ZoomControl(), 'top-left')
    map.addControl(new LocateControl(), 'top-right')
    map.addControl(new UploadControl(() => reloadStaticLayers(map)), 'top-right')
    map.addControl(new LayerControl(BASEMAPS, OVERLAYS, layerState), 'top-right')
    onReady(map)
    return () => {
      onReady(null)
      map.remove()
    }
  }, [onReady])

  return <div ref={containerRef} className="map" />
}
