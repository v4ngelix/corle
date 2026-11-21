import { translateGeoJson, translateToGeoJson, type GeoJsonGeometry } from './gdal.ts'
import { lineLength } from './kpo.ts'
import { type Extent, inEstonia, UploadError } from './validate.ts'

export interface MultiLineString {
  type: 'MultiLineString'
  coordinates: number[][][]
}

export interface DxfLayer {
  name: string
  lines: number
  lengthM: number
  /** X and Y were the wrong way round in the file and have been swapped back. */
  swapped: boolean
  inEstonia: boolean
  /** EPSG:3301. DXF stores no coordinate system, so L-EST97 is assumed. */
  lest: MultiLineString
  /** EPSG:4326, lon/lat, 6 decimals. */
  wgs: MultiLineString
}

export interface DxfContents {
  /** Sorted by name. */
  layers: DxfLayer[]
  /** Model-space entities that are not lines; DXF text is read as a point. */
  ignored: { points: number; polygons: number; other: number }
}

const SWAPPED_MIN_X = 6_000_000
const SWAPPED_MAX_Y = 1_000_000

function extentOf(lines: number[][][]): Extent {
  const extent: Extent = [Infinity, Infinity, -Infinity, -Infinity]
  for (const line of lines) {
    for (const [x, y] of line) {
      extent[0] = Math.min(extent[0], x)
      extent[1] = Math.min(extent[1], y)
      extent[2] = Math.max(extent[2], x)
      extent[3] = Math.max(extent[3], y)
    }
  }
  return extent
}

/**
 * Lines of a DXF file grouped by DXF layer, model space only, in L-EST97 and WGS84.
 * Rejects with `UploadError` if the file can't be read as DXF or has no lines.
 */
export async function readDxf(file: string): Promise<DxfContents> {
  const features = await translateToGeoJson(file, ['-dim', 'XY', '-select', 'Layer,PaperSpace'], ['DXF']).catch(() => {
    throw new UploadError('Faili ei saa avada. Kas see on DXF?')
  })

  const byLayer = new Map<string, number[][][]>()
  const ignored = { points: 0, polygons: 0, other: 0 }

  const collect = (geometry: GeoJsonGeometry, lines: number[][][]) => {
    switch (geometry.type) {
      case 'LineString':
        lines.push(geometry.coordinates as number[][])
        break
      case 'MultiLineString':
        lines.push(...(geometry.coordinates as number[][][]))
        break
      case 'GeometryCollection':
        for (const part of geometry.geometries) collect(part, lines)
        break
      case 'Point':
      case 'MultiPoint':
        ignored.points++
        break
      case 'Polygon':
      case 'MultiPolygon':
        ignored.polygons++
        break
      default:
        ignored.other++
    }
  }

  for (const { properties, geometry } of features) {
    if (properties.PaperSpace || !geometry) continue
    const name = String(properties.Layer ?? '')
    let lines = byLayer.get(name)
    if (!lines) byLayer.set(name, (lines = []))
    collect(geometry, lines)
  }

  const layers = [...byLayer]
    .filter(([, lines]) => lines.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, lines]) => {
      const [minX, , , maxY] = extentOf(lines)
      const swapped = minX > SWAPPED_MIN_X && maxY < SWAPPED_MAX_Y
      const coordinates = swapped ? lines.map((line) => line.map(([x, y]) => [y, x])) : lines
      const lest: MultiLineString = { type: 'MultiLineString', coordinates }
      return { name, lines: lines.length, lengthM: lineLength(lest), swapped, inEstonia: inEstonia(extentOf(coordinates)), lest }
    })
  if (layers.length === 0) throw new UploadError('Failis pole jooni.')

  const wgs = await translateGeoJson(
    { type: 'FeatureCollection', features: layers.map(({ lest }) => ({ type: 'Feature', properties: {}, geometry: lest })) },
    ['-s_srs', 'EPSG:3301', '-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=6'],
  )
  return {
    layers: layers.map((layer, i) => ({ ...layer, wgs: wgs[i].geometry as unknown as MultiLineString })),
    ignored,
  }
}

/** The chosen layers merged into one drawing geometry. */
export function mergeLayers({ layers }: DxfContents, names: string[]): { lest: MultiLineString; wgs: MultiLineString; lengthM: number } {
  if (names.length === 0) throw new UploadError('Vali vähemalt üks kiht.')
  const chosen = [...new Set(names)].map((name) => {
    const layer = layers.find((l) => l.name === name)
    if (!layer) throw new UploadError(`Kihti „${name}“ failis pole.`)
    if (!layer.inEstonia) throw new UploadError(`Kiht „${name}“ jääb Eestist välja.`)
    return layer
  })
  return {
    lest: { type: 'MultiLineString', coordinates: chosen.flatMap((l) => l.lest.coordinates) },
    wgs: { type: 'MultiLineString', coordinates: chosen.flatMap((l) => l.wgs.coordinates) },
    lengthM: chosen.reduce((sum, l) => sum + l.lengthM, 0),
  }
}
