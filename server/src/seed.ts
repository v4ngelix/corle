import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { openDb } from './db.ts'
import { buildStaticLayers } from './gdal.ts'
import { importDrawings } from './importDrawings.ts'

/**
 * Fills a fresh data dir from `seedDir`:
 * - `source/*.gpkg` → `<dataDir>/source/`, only the files that are missing there;
 * - `layers/static.pmtiles` is built if missing;
 * - `drawings.gpkg` is imported only when `corle.sqlite` does not exist yet, so deleted drawings stay deleted.
 */
export async function seedDataDir(dataDir: string, seedDir: string): Promise<void> {
  const sourceDir = join(dataDir, 'source')
  await mkdir(sourceDir, { recursive: true })
  for (const name of await readdir(join(seedDir, 'source'))) {
    if (!name.endsWith('.gpkg') || existsSync(join(sourceDir, name))) continue
    await copyFile(join(seedDir, 'source', name), join(sourceDir, name))
    console.log(`Seeded source/${name}`)
  }
  if (!existsSync(join(dataDir, 'layers', 'static.pmtiles'))) {
    await buildStaticLayers(dataDir)
    console.log('Built layers/static.pmtiles')
  }

  const dbFile = join(dataDir, 'corle.sqlite')
  const drawings = join(seedDir, 'drawings.gpkg')
  if (!existsSync(dbFile) && existsSync(drawings)) {
    const db = openDb(dbFile)
    try {
      console.log(`Seeded ${await importDrawings(db, drawings, 'liidetud')} drawings`)
      db.close()
    } catch (err) {
      db.close()
      await Promise.all(['', '-wal', '-shm'].map((suffix) => rm(dbFile + suffix, { force: true })))
      throw err
    }
  }
}
