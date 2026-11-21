/** Mapping from the Maa-amet KPO attribute format to drawing columns. */

export type DrawingLocation = 'underground' | 'overhead'

export type LineGeometry =
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }

export interface DrawingFields {
  name: string
  municipality: string | null
  settlement: string | null
  location: DrawingLocation
  surveyor: string | null
  surveyedOn: string | null
  accuracyClass: number | null
  attrs: Record<string, unknown>
}

const LOCATIONS: Record<string, DrawingLocation> = {
  KPO_ASUKOHT_MAA_ALUNE: 'underground',
  KPO_ASUKOHT_MAAPEALNE: 'overhead',
}

/** Stored in their own columns, so left out of `attrs`. VALINE_ID stays: it is the registry's identifier. */
const MAPPED = new Set(['ASUKOHT', 'MOODISTAJA', 'MOODISTUSE_KPV', 'TAPSUSKLASS'])
/** Added by QGIS when the old layers were merged; they hold paths from the old developer's PC. */
const DROPPED = new Set(['layer', 'path'])

const OVERHEAD_MARKER = 'ÕHK'

const tallinnFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' })

/** Calendar date in Tallinn. KPO stores local midnights in UTC, so the UTC date is often a day early. */
export function tallinnDate(iso: string): string {
  return tallinnFormat.format(new Date(iso))
}

export function fromKpo(props: Record<string, unknown>): DrawingFields {
  const location = LOCATIONS[String(props.ASUKOHT)]
  if (!location) throw new Error(`Unknown ASUKOHT: ${props.ASUKOHT}`)

  const parts = String(props.VALINE_ID ?? '').split('//')
  if (parts.length < 4) throw new Error(`VALINE_ID is not municipality//settlement//name//date: ${props.VALINE_ID}`)
  const [municipality, settlement, ...rest] = parts
  const name = rest
    .slice(0, -1)
    .filter((part) => part !== OVERHEAD_MARKER)
    .join('//')

  const attrs = Object.fromEntries(
    Object.entries(props).filter(([key, value]) => value !== null && !MAPPED.has(key) && !DROPPED.has(key)),
  )

  return {
    name,
    municipality,
    settlement,
    location,
    surveyor: typeof props.MOODISTAJA === 'string' ? props.MOODISTAJA : null,
    surveyedOn: typeof props.MOODISTUSE_KPV === 'string' ? tallinnDate(props.MOODISTUSE_KPV) : null,
    accuracyClass: typeof props.TAPSUSKLASS === 'number' ? props.TAPSUSKLASS : null,
    attrs,
  }
}

/** Planar length in the geometry's own units (metres for EPSG:3301). */
export function lineLength(geometry: LineGeometry): number {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  let total = 0
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
    }
  }
  return total
}
