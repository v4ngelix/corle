import { NavigationControl } from 'maplibre-gl'

const EPSILON = 1e-6

// MapLibre disables the buttons only when zoom === min/max. The min zoom forced by maxBounds
// differs from the reached zoom by float noise, so "−" never got disabled.
export class ZoomControl extends NavigationControl {
  constructor() {
    super({ showCompass: false })
    this._updateZoomButtons = () => {
      const zoom = this._map.getZoom()
      const isMax = zoom >= this._map.getMaxZoom() - EPSILON
      const isMin = zoom <= this._map.getMinZoom(true) + EPSILON
      this._zoomInButton.disabled = isMax
      this._zoomOutButton.disabled = isMin
      this._zoomInButton.setAttribute('aria-disabled', String(isMax))
      this._zoomOutButton.setAttribute('aria-disabled', String(isMin))
    }
  }
}
