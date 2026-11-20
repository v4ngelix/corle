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
