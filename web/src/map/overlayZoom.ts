import type { Overlay } from '../config'

export function minzoomOf(overlay: Overlay): number {
  return overlay.kind === 'wms' ? overlay.minzoom : Math.min(...overlay.styles.map((s) => s.minzoom ?? 0))
}

export function zoomToShow(overlay: Overlay, zoom: number): number | null {
  const minzoom = minzoomOf(overlay)
  return zoom < minzoom ? minzoom : null
}