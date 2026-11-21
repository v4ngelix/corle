import { resolve } from 'node:path'
import { buildStaticLayers } from '../server/src/gdal.ts'

const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dirname}/../data`)
await buildStaticLayers(dataDir)
console.log(`Wrote ${dataDir}/layers/static.pmtiles`)
