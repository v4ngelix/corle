import type { DatabaseSync } from 'node:sqlite'
import { countDrawings, insertDrawing, type NewDrawing, transaction } from './db.ts'
import { readGeoJson } from './gdal.ts'
import { fromKpo, type LineGeometry, lineLength } from './kpo.ts'

/** One-off import of the old app's drawings (KPO attributes, one feature per drawing). Returns the count. */
export async function importDrawings(db: DatabaseSync, file: string, layer: string): Promise<number> {
  if (countDrawings(db) > 0) throw new Error('Database is not empty: drawings were already imported')

  const [lest, wgs] = await Promise.all([
    readGeoJson(file, layer, 'EPSG:3301'),
    readGeoJson(file, layer, 'EPSG:4326', 6),
  ])
  const wgsById = new Map(wgs.map((f) => [f.id, f.geometry]))

  const rows: NewDrawing[] = lest.map((feature) => {
    try {
      const geometry = feature.geometry as LineGeometry | null
      if (geometry?.type !== 'LineString' && geometry?.type !== 'MultiLineString') {
        throw new Error(`expected lines, got ${feature.geometry?.type ?? 'no geometry'}`)
      }
      return {
        ...fromKpo(feature.properties),
        uploadId: null,
        geomLest: JSON.stringify(geometry),
        geomWgs: JSON.stringify(wgsById.get(feature.id)),
        lengthM: lineLength(geometry),
      }
    } catch (err) {
      throw new Error(`Feature ${feature.id}: ${(err as Error).message}`, { cause: err })
    }
  })

  transaction(db, () => {
    for (const row of rows) insertDrawing(db, row)
  })
  return rows.length
}
