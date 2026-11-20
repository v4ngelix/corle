import type { Map as MapLibreMap } from 'maplibre-gl'
import { START_VIEW } from '../config'

export interface View {
  center: [number, number]
  zoom: number
}

// URL hash format: #<zoom>/<lat>/<lng>
export function loadView(): View {
  const parts = window.location.hash.slice(1).split('/')
  if (parts.length !== 3 || parts.some((p) => p === '' || !Number.isFinite(Number(p)))) return START_VIEW
  const [zoom, lat, lng] = parts.map(Number)
  return { center: [lng, lat], zoom }
}

export function saveView(map: MapLibreMap): void {
  const { lng, lat } = map.getCenter()
  const hash = `#${map.getZoom().toFixed(2)}/${lat.toFixed(6)}/${lng.toFixed(6)}`
  window.history.replaceState(window.history.state, '', hash)
}
