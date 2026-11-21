import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface GeometryField {
  type: string
  /** [minX, minY, maxX, maxY] in the layer's own CRS, easting/northing order. */
  extent?: [number, number, number, number]
  coordinateSystem?: { projjson?: { id?: { authority: string; code: number } } }
}

export interface LayerInfo {
  name: string
  featureCount: number
  geometryFields: GeometryField[]
}

/** Layer summary of a vector file. Rejects if GDAL can't open it. */
export async function ogrinfo(file: string): Promise<LayerInfo[]> {
  const { stdout } = await run('ogrinfo', ['-json', '-so', '-ro', file], { maxBuffer: 16 * 1024 * 1024 })
  return (JSON.parse(stdout) as { layers: LayerInfo[] }).layers
}

export async function reprojectTo3301(src: string, dst: string): Promise<void> {
  await run('ogr2ogr', ['-f', 'GPKG', dst, src, '-t_srs', 'EPSG:3301'])
}

export interface GeoJsonFeature {
  id: number
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown } | null
}

/** Features of one layer as GeoJSON in `srs`, ids = source FIDs. `precision` = decimal places to keep. */
export async function readGeoJson(file: string, layer: string, srs: string, precision?: number): Promise<GeoJsonFeature[]> {
  const args = ['-f', 'GeoJSON', '/vsistdout/', file, layer, '-t_srs', srs, '-preserve_fid']
  if (precision !== undefined) args.push('-lco', `COORDINATE_PRECISION=${precision}`)
  const { stdout } = await run('ogr2ogr', args, { maxBuffer: 256 * 1024 * 1024 })
  return (JSON.parse(stdout) as { features: GeoJsonFeature[] }).features
}

export async function runScript(script: string, env: Record<string, string>): Promise<void> {
  await run(script, [], { env: { ...process.env, ...env } })
}
