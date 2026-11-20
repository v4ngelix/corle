import { GeolocateControl } from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'

const MIN_ZOOM = 12
const TOAST_MS = 4000

const LOCATE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="7"/>' +
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' +
  '</svg>'

export class LocateControl extends GeolocateControl {
  private toast?: HTMLElement
  private toastTimer?: ReturnType<typeof setTimeout>

  constructor() {
    super({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false,
    })
    this._updateCamera = ({ coords }) =>
      this._map.flyTo(
        { center: [coords.longitude, coords.latitude], zoom: Math.max(this._map.getZoom(), MIN_ZOOM) },
        { geolocateSource: true },
      )
    this.on('error', (e) =>
      this.showToast(
        e.code === GeolocationPositionError.PERMISSION_DENIED
          ? 'Asukoha luba on keelatud.'
          : 'Asukohta ei õnnestunud leida.',
      ),
    )
    this.on('outofmaxbounds', () => this.showToast('Asukoht on kaardi alast väljas.'))
  }

  override onAdd(map: MapLibreMap): HTMLElement {
    const container = super.onAdd(map)
    container.className = 'maplibregl-ctrl locate-control'
    const button = this._geolocateButton
    button.classList.add('layer-control-button')
    button.querySelector('.maplibregl-ctrl-icon')?.remove()
    button.insertAdjacentHTML('beforeend', LOCATE_ICON)

    const toast = document.createElement('div')
    toast.className = 'locate-toast'
    toast.setAttribute('role', 'status')
    toast.hidden = true
    container.append(toast)
    this.toast = toast
    return container
  }

  override onRemove(): void {
    clearTimeout(this.toastTimer)
    this.toast = undefined
    super.onRemove()
  }

  private showToast(text: string): void {
    if (!this.toast) return
    this.toast.textContent = text
    this.toast.hidden = false
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      if (this.toast) this.toast.hidden = true
    }, TOAST_MS)
  }
}
