/**
 * One-off import of the old app's drawings into $DATA_DIR/corle.sqlite.
 * Usage: node scripts/import-drawings.mts <Teostused_MA.gpkg> [layer, default "liidetud"]
 * Refuses to run when the database already has drawings.
 */
import { join, resolve } from 'node:path'
import { openDb } from '../server/src/db.ts'
import { importDrawings } from '../server/src/importDrawings.ts'

const [file, layer = 'liidetud'] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/import-drawings.mts <file.gpkg> [layer]')
  process.exit(1)
}

const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dirname}/../data`)
const db = openDb(join(dataDir, 'corle.sqlite'))
let count: number
try {
  count = await importDrawings(db, resolve(file), layer)
} catch (err) {
  console.error((err as Error).message)
  process.exit(1)
}

const summary = db
  .prepare('SELECT location, count(*) AS n, round(sum(length_m) / 1000, 1) AS km FROM drawings GROUP BY location')
  .all() as { location: string; n: number; km: number }[]
console.log(`Imported ${count} drawings into ${join(dataDir, 'corle.sqlite')}`)
for (const { location, n, km } of summary) console.log(`  ${location}: ${n} drawings, ${km} km`)
db.close()
