import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl'

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
  kind: 'wms'
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

type StyleKeys = 'type' | 'minzoom' | 'layout' | 'paint'
export type VectorStyle = Pick<FillLayerSpecification, StyleKeys> | Pick<LineLayerSpecification, StyleKeys>

export interface VectorOverlay {
  kind: 'vector'
  id: string
  label: string
  visible: boolean
  styles: VectorStyle[]
}

export type Overlay = WmsOverlay | VectorOverlay

export const STATIC_LAYERS = {
  url: `pmtiles://${window.location.origin}/layers/static.pmtiles`,
  attribution: 'Corle OÜ',
}

const ROUND_LINE = { 'line-cap': 'round', 'line-join': 'round' } as const

export const OVERLAYS: Overlay[] = [
  {
    kind: 'wms',
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
    kind: 'vector',
    id: 'seadustusala',
    label: 'Seadustusala',
    visible: true,
    styles: [
      {
        type: 'fill',
        minzoom: 7,
        paint: { 'fill-color': '#e77148', 'fill-outline-color': '#232323', 'fill-opacity': 0.5 },
      },
    ],
  },
  {
    kind: 'vector',
    id: '5g',
    label: '5G',
    visible: false,
    styles: [
      { type: 'line', layout: ROUND_LINE, paint: { 'line-color': '#000000', 'line-width': 7 } },
      { type: 'line', layout: ROUND_LINE, paint: { 'line-color': '#11ff44', 'line-width': 5 } },
    ],
  },
  {
    kind: 'vector',
    id: 'mastid',
    label: 'Mastid',
    visible: false,
    styles: [
      { type: 'fill', paint: { 'fill-color': '#de258f' } },
      { type: 'line', paint: { 'line-color': '#dc4523', 'line-width': 7 } },
    ],
  },
  {
    kind: 'wms',
    id: 'elasa',
    label: 'ELASA',
    url: `${window.location.origin}/api/elasa/wms`,
    wmsLayer: 'avalik_trassid',
    minzoom: 0,
    opacity: 1,
    visible: false,
    tiled: true,
    attribution: 'ELASA',
  },
  {
    kind: 'wms',
    id: 'katastripiirid',
    label: 'Katastripiirid',
    url: MAAAMET_WMS,
    wmsLayer: 'kataster:ky_kehtiv',
    minzoom: 14,
    opacity: 1,
    visible: false,
    tiled: true,
    attribution: MAAAMET_ATTRIBUTION,
  },
  {
    kind: 'wms',
    id: 'katastriandmed',
    label: 'Katastriandmed',
    url: MAAAMET_WMS,
    wmsLayer: 'kataster:ky_tunnus_aadress',
    minzoom: 15,
    opacity: 1,
    visible: false,
    tiled: false,
    attribution: MAAAMET_ATTRIBUTION,
  },
]

export interface LayerGroup {
  id: string
  label: string
  overlays: string[]
}

export const LAYER_GROUPS: LayerGroup[] = [
  { id: 'tehnovork', label: 'Tehnovõrk', overlays: ['seadustusala', '5g', 'mastid'] },
  { id: 'abi', label: 'ABI', overlays: ['ky-omandivorm', 'katastripiirid', 'katastriandmed', 'elasa'] },
]

export const LOGO = {
  src: '/logo.png',
  href: 'https://corle.ee/',
  alt: 'Corle OÜ',
}

export const ADDRESS_SEARCH = {
  url: 'https://inaadress.maaamet.ee/inaadress/gazetteer',
  minLength: 4,
  debounceMs: 500,
  resultLimit: 8,
  maxZoom: 18,
  extentHighlightMs: 2500,
}

export const CADASTRE_POPUP = {
  url: 'https://gsavalik.envir.ee/geoserver/kataster/wfs',
  wfsLayer: 'kataster:ky_tunnus_aadress',
  overlayId: 'katastriandmed',
  minZoom: 15,
  searchRadius: 1, // EPSG:3857 units, as in the old app
  registryUrl: 'https://kinnistusraamat.rik.ee/PealeheOtsinguTulemus.aspx?term=',
  fields: [
    ['l_aadress', 'Aadress'],
    ['ay_nimi', 'Asustusüksus'],
    ['ov_nimi', 'Omavalitsus'],
    ['mk_nimi', 'Maakond'],
    ['tunnus', 'Katastritunnus'],
    ['kinnistu', 'Kinnistu nr'],
    ['siht1', 'Sihtotstarve'],
    ['omvorm', 'Omandivorm'],
    ['ads_oid', 'ADS OID'],
  ] as const,
}
