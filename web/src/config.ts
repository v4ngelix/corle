// All external addresses live here (PLAN.md risk 9.2).

export const START_VIEW = {
  center: [25.5, 58.7] as [number, number],
  zoom: 7,
}

export const MAX_ZOOM = 22

export const BASEMAP_MAAAMET_KAART = {
  tiles: ['https://tiles.maaamet.ee/tm/tms/1.0.0/kaart@GMC/{z}/{x}/{y}.png'],
  scheme: 'tms' as const,
  maxzoom: 18,
  attribution: '© Maa- ja Ruumiamet',
}
