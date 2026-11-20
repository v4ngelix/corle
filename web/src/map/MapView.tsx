import { MapLibreMap } from 'maplibre-gl'
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import './worker'
import { BASEMAPS, MAX_BOUNDS, MAX_ZOOM, START_VIEW } from '../config'
import { BasemapControl } from './BasemapControl'

const sources: Record<string, SourceSpecification> = Object.fromEntries(
  BASEMAPS.map(({ id, tiles, scheme, maxzoom, attribution }) => [
    id,
    { type: 'raster', tileSize: 256, tiles, scheme, maxzoom, attribution },
  ]),
)

const layers: LayerSpecification[] = BASEMAPS.map(({ id }, i) => ({
  id,
  type: 'raster',
  source: id,
  layout: { visibility: i === 0 ? 'visible' : 'none' },
}))

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      center: START_VIEW.center,
      zoom: START_VIEW.zoom,
      maxZoom: MAX_ZOOM,
      maxBounds: MAX_BOUNDS,
      style: { version: 8, sources, layers },
    })
    map.addControl(new BasemapControl(BASEMAPS), 'top-right')
    return () => map.remove()
  }, [])

  return <div ref={containerRef} className="map" />
}
