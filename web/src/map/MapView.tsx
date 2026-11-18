import { MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import './worker'
import { BASEMAP_MAAAMET_KAART, MAX_ZOOM, START_VIEW } from '../config'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      center: START_VIEW.center,
      zoom: START_VIEW.zoom,
      maxZoom: MAX_ZOOM,
      style: {
        version: 8,
        sources: {
          basemap: { type: 'raster', tileSize: 256, ...BASEMAP_MAAAMET_KAART },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
    })
    return () => map.remove()
  }, [])

  return <div ref={containerRef} className="map" />
}
