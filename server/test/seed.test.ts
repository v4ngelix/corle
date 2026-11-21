import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, test } from 'node:test'
import { countDrawings, openDb } from '../src/db.ts'
import { seedDataDir } from '../src/seed.ts'

const root = mkdtempSync(join(tmpdir(), 'corle-seed-'))
const seedDir = join(root, 'seed')
mkdirSync(join(seedDir, 'source'), { recursive: true })

const square = { type: 'Polygon', coordinates: [[[540000, 6580000], [540100, 6580000], [540100, 6580100], [540000, 6580000]]] }
const line = { type: 'LineString', coordinates: [[540000, 6580000], [541000, 6581000]] }
const drawing = {
  type: 'Feature',
  properties: { ASUKOHT: 'KPO_ASUKOHT_MAA_ALUNE', VALINE_ID: 'Harku vald//Muraste küla//Muraste_CO5038//30.07.2025' },
  geometry: { type: 'MultiLineString', coordinates: [[[530000, 6585000], [530300, 6585400]]] },
}

function gpkg(file: string, layer: string, features: object[]): void {
  const geojson = join(root, `${layer}.geojson`)
  writeFileSync(geojson, JSON.stringify({ type: 'FeatureCollection', features }))
  execFileSync('ogr2ogr', ['-f', 'GPKG', file, geojson, '-nln', layer, '-a_srs', 'EPSG:3301'])
}
const feature = (geometry: object) => ({ type: 'Feature', properties: {}, geometry })

gpkg(join(seedDir, 'source', 'seadustusala.gpkg'), 'seadustusala', [feature(square)])
gpkg(join(seedDir, 'source', '5g.gpkg'), '5g', [feature(line)])
gpkg(join(seedDir, 'source', 'mastid.gpkg'), 'mastid', [feature(square)])
gpkg(join(seedDir, 'drawings.gpkg'), 'liidetud', [drawing])

function drawingCount(dataDir: string): number {
  const db = openDb(join(dataDir, 'corle.sqlite'))
  try {
    return countDrawings(db)
  } finally {
    db.close()
  }
}

after(() => rmSync(root, { recursive: true, force: true }))

describe('seedDataDir', () => {
  test('fills an empty data dir, builds the PMTiles and imports the drawings', async () => {
    const dataDir = join(root, 'empty')
    await seedDataDir(dataDir, seedDir)
    for (const name of ['seadustusala', '5g', 'mastid']) {
      assert.deepEqual(
        readFileSync(join(dataDir, 'source', `${name}.gpkg`)),
        readFileSync(join(seedDir, 'source', `${name}.gpkg`)),
      )
    }
    assert.ok(existsSync(join(dataDir, 'layers', 'static.pmtiles')))
    assert.equal(drawingCount(dataDir), 1)
  })

  test('keeps files that are already there', async () => {
    const dataDir = join(root, 'existing')
    mkdirSync(join(dataDir, 'source'), { recursive: true })
    gpkg(join(dataDir, 'source', '5g.gpkg'), '5g', [feature({ type: 'LineString', coordinates: [[550000, 6590000], [551000, 6591000]] })])
    const own = readFileSync(join(dataDir, 'source', '5g.gpkg'))
    mkdirSync(join(dataDir, 'layers'))
    writeFileSync(join(dataDir, 'layers', 'static.pmtiles'), 'existing')
    openDb(join(dataDir, 'corle.sqlite')).close()

    await seedDataDir(dataDir, seedDir)

    assert.deepEqual(readFileSync(join(dataDir, 'source', '5g.gpkg')), own)
    assert.ok(existsSync(join(dataDir, 'source', 'mastid.gpkg')))
    assert.equal(readFileSync(join(dataDir, 'layers', 'static.pmtiles'), 'utf8'), 'existing')
    assert.equal(drawingCount(dataDir), 0)
  })
})
