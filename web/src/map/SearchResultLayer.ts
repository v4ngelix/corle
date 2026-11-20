import { LngLatBounds, Marker, Popup } from 'maplibre-gl'
import type { GeoJSONSource, GeoJSONSourceSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { ADDRESS_SEARCH } from '../config'
import type { AddressSuggestion } from '../components/addressSearchApi'

const EXTENT_ID = 'search-extent'

// Marker + short-lived extent outline for the selected address.
export class SearchResultLayer {
  private readonly map: MapLibreMap
  private marker: Marker | null = null
  private extentTimer: ReturnType<typeof setTimeout> | undefined

  constructor(map: MapLibreMap) {
    this.map = map
  }

  show({ label, lngLat, extent }: AddressSuggestion): void {
    this.clear()

    const element = document.createElement('div')
    element.className = 'search-pin'
    const popup = new Popup({ offset: 12 }).setText(label)
    this.marker = new Marker({ element }).setLngLat(lngLat).setPopup(popup).addTo(this.map)

    if (extent) {
      const bounds = extent.reduce((b, p) => b.extend(p), new LngLatBounds(extent[0], extent[0]))
      this.map.fitBounds(bounds, { maxZoom: ADDRESS_SEARCH.maxZoom, padding: 40 })
      this.showExtent(extent)
    } else {
      this.map.flyTo({ center: lngLat, zoom: ADDRESS_SEARCH.maxZoom })
    }
    this.marker.togglePopup()
  }

  clear(): void {
    this.marker?.remove()
    this.marker = null
    this.hideExtent()
  }

  private showExtent(ring: [number, number][]): void {
    const data: GeoJSONSourceSpecification['data'] = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    }
    const source = this.map.getSource<GeoJSONSource>(EXTENT_ID)
    if (source) {
      source.setData(data)
    } else {
      this.map.addSource(EXTENT_ID, { type: 'geojson', data })
      this.map.addLayer({
        id: EXTENT_ID,
        type: 'line',
        source: EXTENT_ID,
        paint: { 'line-color': '#e53935', 'line-width': 3 },
      })
    }
    this.map.setLayoutProperty(EXTENT_ID, 'visibility', 'visible')
    this.extentTimer = setTimeout(() => this.hideExtent(), ADDRESS_SEARCH.extentHighlightMs)
  }

  private hideExtent(): void {
    clearTimeout(this.extentTimer)
    if (this.map.getLayer(EXTENT_ID)) {
      this.map.setLayoutProperty(EXTENT_ID, 'visibility', 'none')
    }
  }
}
