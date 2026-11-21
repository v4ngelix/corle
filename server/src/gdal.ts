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

export async function runScript(script: string, env: Record<string, string>): Promise<void> {
  await run(script, [], { env: { ...process.env, ...env } })
}
