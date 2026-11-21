import { BASEMAPS, OVERLAYS } from '../config'

const STORAGE_KEY = 'corle:layers'

export interface LayerState {
  basemap: string
  overlays: string[]
}

export function loadLayerState(): LayerState {
  const fallback: LayerState = {
    basemap: BASEMAPS[0].id,
    overlays: OVERLAYS.filter((o) => o.visible).map((o) => o.id),
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<LayerState>
    return {
      basemap: BASEMAPS.some((b) => b.id === saved.basemap) ? saved.basemap! : fallback.basemap,
      overlays: Array.isArray(saved.overlays)
        ? saved.overlays.filter((id) => OVERLAYS.some((o) => o.id === id))
        : fallback.overlays,
    }
  } catch {
    return fallback
  }
}

export function saveLayerState(state: LayerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota): selection just won't persist.
  }
}
