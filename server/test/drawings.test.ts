import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { get, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ogr2ogr } from './ogr2ogr.ts'
import { after, before, describe, test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { countDrawings, openDb } from '../src/db.ts'
import { importDrawings } from '../src/importDrawings.ts'

const dataDir = mkdtempSync(join(tmpdir(), 'corle-drawings-'))
const fixtures = mkdtempSync(join(tmpdir(), 'corle-drawings-fixtures-'))
const gpkg = join(fixtures, 'teostused.gpkg')

const kpoFeature = (asukoht: string, valineId: string, coordinates: number[][][]) => ({
  type: 'Feature',
  properties: {
    KPO_NIMI: 'CORLE sidevõrk',
    MOODISTAJA: 'Geo S.T. OÜ',
    MOODISTUSE_KPV: '2024-09-30T21:00:00.000Z',
    ASUKOHT: asukoht,
    VALINE_ID: valineId,
    TAPSUSKLASS: 0.1,
    layer: 'Teostus_MA_MKM',
    path: 'C:/x.gpkg',
  },
  geometry: { type: 'MultiLineString', coordinates },
})

const fixture = {
  type: 'FeatureCollection',
  crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3301' } },
  features: [
    kpoFeature('KPO_ASUKOHT_MAA_ALUNE', 'Harku vald//Muraste küla//Muraste_CO5038//30.07.2025', [
      [
        [530000.123, 6585000.456],
        [530300.123, 6585400.456],
      ],
    ]),
    kpoFeature('KPO_ASUKOHT_MAAPEALNE', 'Harku vald//Muraste küla//Muraste_CO5038//ÕHK//30.07.2025', [
      [
        [531000, 6586000],
        [531000, 6586100],
      ],
      [
        [531000, 6586100],
        [531050, 6586100],
      ],
    ]),
  ],
}

before(() => {
  const src = join(fixtures, 'teostused.geojson')
  writeFileSync(src, JSON.stringify(fixture))
  ogr2ogr(gpkg, src, ['-nln', 'liidetud'])
})

after(() => {
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(fixtures, { recursive: true, force: true })
})

describe('importDrawings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corle-import-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  test('imports every feature with mapped columns, both geometries and length', async () => {
    const db = openDb(join(dir, 'corle.sqlite'))
    assert.equal(await importDrawings(db, gpkg, 'liidetud'), 2)
    const rows = db.prepare('SELECT * FROM drawings ORDER BY id').all() as Record<string, unknown>[]
    assert.equal(rows.length, 2)

    const [under, over] = rows
    assert.equal(under.name, 'Muraste_CO5038')
    assert.equal(under.municipality, 'Harku vald')
    assert.equal(under.settlement, 'Muraste küla')
    assert.equal(under.location, 'underground')
    assert.equal(under.surveyor, 'Geo S.T. OÜ')
    assert.equal(under.surveyed_on, '2024-10-01')
    assert.equal(under.accuracy_class, 0.1)
    assert.equal(under.upload_id, null)
    assert.ok(Math.abs((under.length_m as number) - 500) < 1e-6, `length ${under.length_m}`)
    assert.deepEqual(JSON.parse(under.attrs as string), {
      KPO_NIMI: 'CORLE sidevõrk',
      VALINE_ID: 'Harku vald//Muraste küla//Muraste_CO5038//30.07.2025',
    })
    assert.deepEqual(JSON.parse(under.geom_lest as string), fixture.features[0].geometry)

    const wgs = JSON.parse(under.geom_wgs as string) as { type: string; coordinates: number[][][] }
    assert.equal(wgs.type, 'MultiLineString')
    const [lon, lat] = wgs.coordinates[0][0]
    assert.ok(lon > 24 && lon < 25 && lat > 59 && lat < 60.5, `unexpected WGS84 position ${lon} ${lat}`)
    for (const n of wgs.coordinates.flat(2)) {
      assert.ok((n.toString().split('.')[1] ?? '').length <= 6, `more than 6 decimals: ${n}`)
    }

    assert.equal(over.location, 'overhead')
    assert.equal(over.length_m, 150)
    db.close()
  })

  test('refuses to import into a database that already has drawings', async () => {
    const db = openDb(join(dir, 'corle.sqlite'))
    await assert.rejects(importDrawings(db, gpkg, 'liidetud'), /not empty/)
    assert.equal(countDrawings(db), 2)
    db.close()
  })
})

describe('GET /api/drawings.geojson', () => {
  let server: Server
  let base: string

  before(async () => {
    server = buildApp({ dataDir }).listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(() => server.close())

  test('returns an empty FeatureCollection when there are no drawings', async () => {
    const res = await fetch(`${base}/api/drawings.geojson`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /application\/geo\+json/)
    assert.deepEqual(await res.json(), { type: 'FeatureCollection', features: [] })
  })

  test('returns every drawing with only its location as a property', async () => {
    const db = openDb(join(dataDir, 'corle.sqlite'))
    await importDrawings(db, gpkg, 'liidetud')
    db.close()

    const res = await fetch(`${base}/api/drawings.geojson`)
    const body = (await res.json()) as {
      type: string
      features: { type: string; id: number; properties: unknown; geometry: { type: string } }[]
    }
    assert.equal(body.type, 'FeatureCollection')
    assert.equal(body.features.length, 2)
    assert.deepEqual(
      body.features.map((f) => [f.type, f.properties, f.geometry.type]),
      [
        ['Feature', { location: 'underground' }, 'MultiLineString'],
        ['Feature', { location: 'overhead' }, 'MultiLineString'],
      ],
    )
    assert.ok(body.features.every((f) => Number.isInteger(f.id)))
  })

  test('answers 304 when the ETag matches', async () => {
    const first = await fetch(`${base}/api/drawings.geojson`)
    const etag = first.headers.get('etag')
    assert.ok(etag)
    assert.equal(first.headers.get('cache-control'), 'no-cache')
    const status = await new Promise<number | undefined>((resolve, reject) => {
      get(`${base}/api/drawings.geojson`, { headers: { 'If-None-Match': etag } }, (res) => {
        res.resume()
        resolve(res.statusCode)
      }).on('error', reject)
    })
    assert.equal(status, 304)
  })
})
