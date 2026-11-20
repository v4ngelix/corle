export const START_VIEW = {
  center: [25.5, 58.7] as [number, number],
  zoom: 7,
}

export const MAX_ZOOM = 22

export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [21.5, 57.3],
  [28.5, 59.9],
]

export interface TileLayer {
  id: string
  tiles: string[]
  scheme: 'xyz' | 'tms'
  maxzoom: number
  attribution: string
}

const MAAAMET_TMS = 'https://tiles.maaamet.ee/tm/tms/1.0.0'
const MAAAMET_ATTRIBUTION = '© Maa- ja Ruumiamet'

export const TILE_LAYERS: TileLayer[] = [
  {
    id: 'maaamet-kaart',
    tiles: [`${MAAAMET_TMS}/kaart@GMC/{z}/{x}/{y}.png`],
    scheme: 'tms',
    maxzoom: 18,
    attribution: MAAAMET_ATTRIBUTION,
  },
  {
    id: 'maaamet-foto',
    tiles: [`${MAAAMET_TMS}/foto@GMC/{z}/{x}/{y}.jpg`],
    scheme: 'tms',
    maxzoom: 18,
    attribution: MAAAMET_ATTRIBUTION,
  },
  {
    id: 'maaamet-hybriid',
    tiles: [`${MAAAMET_TMS}/hybriid@GMC/{z}/{x}/{y}.png`],
    scheme: 'tms',
    maxzoom: 18,
    attribution: MAAAMET_ATTRIBUTION,
  },
]

export interface Basemap {
  id: string
  label: string
  layers: string[]
}

export const BASEMAPS: Basemap[] = [
  { id: 'kaart', label: 'Kaart', layers: ['maaamet-kaart'] },
  { id: 'ortofoto', label: 'Ortofoto', layers: ['maaamet-foto'] },
  { id: 'hybriid', label: 'Hübriid', layers: ['maaamet-foto', 'maaamet-hybriid'] },
]

const MAAAMET_WMS = 'https://gsavalik.envir.ee/geoserver/kataster/wms'

export interface WmsOverlay {
  id: string
  label: string
  url: string
  wmsLayer: string
  minzoom: number
  opacity: number
  visible: boolean
  tiled: boolean
  attribution: string
}

// Draw order: first entry is drawn lowest.
export const OVERLAYS: WmsOverlay[] = [
  {
    id: 'ky-omandivorm',
    label: 'KÜ Omandivorm',
    url: MAAAMET_WMS,
    wmsLayer: 'kataster:ky_omandivorm',
    minzoom: 13,
    opacity: 0.75,
    visible: false,
    tiled: true,
    attribution: MAAAMET_ATTRIBUTION,
  },
  {
    id: 'katastripiirid',
    label: 'Katastripiirid',
    url: MAAAMET_WMS,
    wmsLayer: 'kataster:ky_kehtiv',
    minzoom: 14,
    opacity: 1,
    visible: true,
    tiled: true,
    attribution: MAAAMET_ATTRIBUTION,
  },
  {
    id: 'katastriandmed',
    label: 'Katastriandmed',
    url: MAAAMET_WMS,
    wmsLayer: 'kataster:ky_tunnus_aadress',
    minzoom: 15,
    opacity: 1,
    visible: true,
    tiled: false,
    attribution: MAAAMET_ATTRIBUTION,
  },
]

export const LOGO = {
  src: '/logo.png',
  href: 'https://corle.ee/',
  alt: 'Corle OÜ',
}

// IN-ADS usage rules 2.4.1 and 2.4.2: min 4 chars, 500 ms pause.
export const ADDRESS_SEARCH = {
  url: 'https://inaadress.maaamet.ee/inaadress/gazetteer',
  minLength: 4,
  debounceMs: 500,
  resultLimit: 8,
  maxZoom: 18,
  extentHighlightMs: 2500,
}
