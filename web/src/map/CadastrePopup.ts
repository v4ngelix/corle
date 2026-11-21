import { type Map as MapLibreMap, type MapMouseEvent, Popup } from 'maplibre-gl'
import { CADASTRE_POPUP } from '../config'
import { toMercator } from './wms'

type Properties = Record<string, unknown>

function getFeatureUrl([x, y]: [number, number]): string {
  const d = CADASTRE_POPUP.searchRadius
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typename: CADASTRE_POPUP.wfsLayer,
    outputFormat: 'application/json',
    srsName: 'EPSG:3857',
    bbox: [x - d, y - d, x + d, y + d, 'EPSG:3857'].join(','),
  })
  return `${CADASTRE_POPUP.url}?${params}`
}

function message(text: string): HTMLElement {
  const node = document.createElement('div')
  node.textContent = text
  return node
}

function cell(row: HTMLTableRowElement, content: string | Node): void {
  const td = row.insertCell()
  td.append(content)
}

function details(props: Properties): HTMLElement {
  const root = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'cadastre-popup-title'
  title.textContent = 'Katastriüksus'

  const table = document.createElement('table')
  for (const [field, label] of CADASTRE_POPUP.fields) {
    const value = props[field]
    if (value === null || value === undefined || value === '') continue
    const row = table.insertRow()
    cell(row, `${label}:`)
    if (field === 'kinnistu' && props.tunnus) {
      const link = document.createElement('a')
      link.href = CADASTRE_POPUP.registryUrl + encodeURIComponent(String(props.tunnus))
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = String(value)
      cell(row, link)
    } else {
      cell(row, String(value))
    }
  }
  root.append(title, table)
  return root
}

export class CadastrePopup {
  private readonly map: MapLibreMap
  private readonly popup = new Popup({ className: 'cadastre-popup', maxWidth: '18.75rem' })
  private request?: AbortController

  constructor(map: MapLibreMap) {
    this.map = map
    map.on('dblclick', this.onDoubleClick)
  }

  private readonly onDoubleClick = async (e: MapMouseEvent): Promise<void> => {
    const { map } = this
    if (map.getZoom() < CADASTRE_POPUP.minZoom) return
    if (map.getLayoutProperty(CADASTRE_POPUP.overlayId, 'visibility') === 'none') return

    this.request?.abort()
    const request = new AbortController()
    this.request = request

    let content: HTMLElement
    try {
      const response = await fetch(getFeatureUrl(toMercator(e.lngLat.toArray())), { signal: request.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { features?: { properties: Properties }[] }
      const feature = data.features?.[0]
      content = feature ? details(feature.properties) : message('Selles punktis puudub katastriüksus.')
    } catch (error) {
      if (request.signal.aborted) return
      console.error('Cadastre WFS request failed', error)
      content = message('Päringu viga.')
    }
    this.popup.setLngLat(e.lngLat).setDOMContent(content).addTo(map)
  }
}
