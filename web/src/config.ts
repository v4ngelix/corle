// All external addresses live here (PLAN.md risk 9.2).

export const START_VIEW = {
  center: [25.5, 58.7] as [number, number],
  zoom: 7,
}

export const MAX_ZOOM = 22

export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [21.5, 57.3],
  [28.5, 59.9],
]

export interface Basemap {
  id: string
  label: string
  tiles: string[]
  scheme: 'xyz' | 'tms'
  maxzoom: number
  attribution: string
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'maaamet-kaart',
    label: 'Kaart',
    tiles: ['https://tiles.maaamet.ee/tm/tms/1.0.0/kaart@GMC/{z}/{x}/{y}.png'],
    scheme: 'tms',
    maxzoom: 18,
    attribution: '© Maa- ja Ruumiamet',
  },
  {
    id: 'maaamet-foto',
    label: 'Foto',
    tiles: ['https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/{z}/{x}/{y}.jpg'],
    scheme: 'tms',
    maxzoom: 18,
    attribution: '© Maa- ja Ruumiamet',
  },
]
