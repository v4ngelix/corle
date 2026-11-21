import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import gdal from 'gdal-async'

export interface LayerInfo {
  name: string
  featureCount: number
  /** Flattened OGR geometry type (no Z/M), e.g. `gdal.wkbLineString`. */
  geometryType: number
  geometryName: string
  extent?: [number, number, number, number]
  hasCoordinateSystem: boolean
  epsg?: number
}

function flatten(type: number): number {
  return (type & ~gdal.wkb25DBit) % 1000
}

async function withDataset<T>(file: string, work: (ds: gdal.Dataset) => Promise<T> | T, drivers?: string[]): Promise<T> {
  const ds = await gdal.openAsync(file, 'r', drivers)
  try {
    return await work(ds)
  } finally {
    ds.close()
  }
}

/** Layer summary of a vector file. Rejects if GDAL can't open it. */
export async function ogrinfo(file: string): Promise<LayerInfo[]> {
  return withDataset(file, (ds) =>
    ds.layers.map((layer) => {
      const srs = layer.srs
      const code = srs?.getAuthorityName() === 'EPSG' ? Number(srs.getAuthorityCode()) : undefined
      const geometryType = flatten(layer.geomType)
      let extent: LayerInfo['extent']
      try {
        const e = layer.getExtent()
        extent = [e.minX, e.minY, e.maxX, e.maxY]
      } catch {
        extent = undefined
      }
      return {
        name: layer.name,
        featureCount: layer.features.count(),
        geometryType,
        geometryName: gdal.Geometry.getName(geometryType),
        extent,
        hasCoordinateSystem: srs !== null,
        epsg: Number.isFinite(code) ? code : undefined,
      }
    }),
  )
}

export async function reprojectTo3301(src: string, dst: string): Promise<void> {
  await withDataset(src, async (ds) => (await gdal.vectorTranslateAsync(dst, ds, ['-f', 'GPKG', '-t_srs', 'EPSG:3301'])).close())
}

export interface GeoJsonFeature {
  id: number
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry | null
}

export type GeoJsonGeometry =
  | { type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] }

/**
 * Runs `ogr2ogr -f GeoJSON <args>` on `file` in the GDAL thread pool and returns the features.
 * `drivers` limits which formats `file` may be opened as.
 */
export async function translateToGeoJson(file: string, args: string[], drivers?: string[]): Promise<GeoJsonFeature[]> {
  const mem = `/vsimem/${randomUUID()}.geojson`
  await withDataset(file, async (ds) => (await gdal.vectorTranslateAsync(mem, ds, ['-f', 'GeoJSON', ...args])).close(), drivers)
  return (JSON.parse(gdal.vsimem.release(mem).toString('utf8')) as { features: GeoJsonFeature[] }).features
}

/** Same as `translateToGeoJson`, for GeoJSON held in memory. */
export async function translateGeoJson(geojson: object, args: string[]): Promise<GeoJsonFeature[]> {
  const mem = `/vsimem/${randomUUID()}.geojson`
  gdal.vsimem.set(Buffer.from(JSON.stringify(geojson)), mem)
  try {
    return await translateToGeoJson(mem, args)
  } finally {
    gdal.vsimem.release(mem)
  }
}

/** Features of one layer as GeoJSON in `srs`, ids = source FIDs. `precision` = decimal places to keep. */
export async function readGeoJson(file: string, layer: string, srs: string, precision?: number): Promise<GeoJsonFeature[]> {
  const args = ['-t_srs', srs, '-preserve_fid', layer]
  if (precision !== undefined) args.push('-lco', `COORDINATE_PRECISION=${precision}`)
  return translateToGeoJson(file, args)
}

const STATIC_LAYERS = ['seadustusala', '5g', 'mastid']

/**
 * Rebuilds `<dataDir>/layers/static.pmtiles` (Seadustusala, 5G, Mastid) from the GeoPackages in `<dataDir>/source/`.
 * Geometry only: the old app never exposed the attributes, so neither does this file.
 */
export async function buildStaticLayers(dataDir: string): Promise<void> {
  const out = join(dataDir, 'layers', 'static.pmtiles')
  const partial = join(dataDir, 'layers', '.static.partial.pmtiles')
  const tmp = await mkdtemp(join(tmpdir(), 'corle-static-'))
  try {
    await mkdir(join(dataDir, 'layers'), { recursive: true })
    const combined = join(tmp, 'static.gpkg')
    for (const [i, name] of STATIC_LAYERS.entries()) {
      const target = i === 0 ? combined : await gdal.openAsync(combined, 'r+')
      const args = ['-nln', name, '-select', '', ...(i === 0 ? ['-f', 'GPKG'] : [])]
      const result = await withDataset(join(dataDir, 'source', `${name}.gpkg`), (ds) => gdal.vectorTranslateAsync(target, ds, args))
      result.close()
    }
    await rm(partial, { force: true })
    await withDataset(combined, async (ds) =>
      (await gdal.vectorTranslateAsync(partial, ds, ['-f', 'PMTiles', '-dsco', 'MINZOOM=0', '-dsco', 'MAXZOOM=15'])).close(),
    )
    await rename(partial, out)
  } finally {
    await rm(tmp, { recursive: true, force: true })
    await rm(partial, { force: true })
  }
}
