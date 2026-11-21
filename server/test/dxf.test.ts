import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, test } from 'node:test'
import { mergeLayers, readDxf } from '../src/dxf.ts'
import { UploadError } from '../src/validate.ts'
import { dxf, type Block, type Entity } from './dxf.ts'

const dir = mkdtempSync(join(tmpdir(), 'corle-dxf-'))
after(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function write(entities: Entity[], blocks?: Block[]): string {
  const file = join(dir, `${n++}.dxf`)
  writeFileSync(file, dxf(entities, blocks))
  return file
}

const E = 540000
const N = 6580000

const mixed = () =>
  write(
    [
      { type: 'line', layer: 'SITRASS', from: [E, N], to: [E + 300, N + 400] },
      { type: 'polyline', layer: 'SITRASS', points: [[E + 300, N + 400], [E + 400, N + 400], [E + 400, N + 500]] },
      { type: 'line', layer: 'PIIR', from: [E, N], to: [E, N + 1000] },
      { type: 'line', layer: 'VORMISTUS', from: [15, 0], to: [1179, 0], paperSpace: true },
      { type: 'point', layer: 'SITRASS', at: [E, N] },
      { type: 'text', layer: 'MOOTNR', at: [E, N], text: '101' },
      { type: 'solid', layer: 'HOONE', corners: [[E, N], [E + 10, N], [E + 10, N + 10]] },
      { type: 'insert', layer: 'SIKAEV', block: 'KAEV', at: [E + 50, N] },
    ],
    [{ name: 'KAEV', entities: [{ type: 'line', layer: '0', from: [0, 0], to: [5, 0] }, { type: 'point', layer: '0', at: [0, 0] }] }],
  )

describe('readDxf', () => {
  test('groups model-space lines by DXF layer, sorted by name', async () => {
    const { layers } = await readDxf(mixed())
    assert.deepEqual(
      layers.map((l) => [l.name, l.lines, l.lengthM]),
      [
        ['PIIR', 1, 1000],
        ['SIKAEV', 1, 5],
        ['SITRASS', 2, 700],
      ],
    )
  })

  test('drops paper space and counts points, text and hatches', async () => {
    const { layers, ignored } = await readDxf(mixed())
    assert.ok(!layers.some((l) => l.name === 'VORMISTUS'))
    assert.deepEqual(ignored, { points: 3, polygons: 1, other: 0 })
  })

  test('keeps the layer geometry in EPSG:3301 without Z', async () => {
    const { layers } = await readDxf(mixed())
    const sitrass = layers.find((l) => l.name === 'SITRASS')!
    assert.deepEqual(sitrass.lest, {
      type: 'MultiLineString',
      coordinates: [
        [
          [E, N],
          [E + 300, N + 400],
        ],
        [
          [E + 300, N + 400],
          [E + 400, N + 400],
          [E + 400, N + 500],
        ],
      ],
    })
  })

  test('reprojects to WGS84 lon/lat with at most 6 decimals', async () => {
    const { layers } = await readDxf(mixed())
    const { wgs } = layers.find((l) => l.name === 'SITRASS')!
    assert.equal(wgs.type, 'MultiLineString')
    const [lon, lat] = wgs.coordinates[0][0]
    assert.ok(lon > 24 && lon < 25.5 && lat > 59 && lat < 59.5, `unexpected WGS84 position ${lon} ${lat}`)
    for (const v of wgs.coordinates.flat(2)) {
      assert.ok((v.toString().split('.')[1] ?? '').length <= 6, `more than 6 decimals: ${v}`)
    }
  })

  test('fixes a layer with swapped X/Y', async () => {
    const { layers } = await readDxf(
      write([
        { type: 'line', layer: 'SWAPPED', from: [N, E], to: [N + 100, E] },
        { type: 'line', layer: 'OK', from: [E, N], to: [E + 100, N] },
      ]),
    )
    const swapped = layers.find((l) => l.name === 'SWAPPED')!
    assert.equal(swapped.swapped, true)
    assert.equal(swapped.inEstonia, true)
    assert.deepEqual(swapped.lest.coordinates, [
      [
        [E, N],
        [E, N + 100],
      ],
    ])
    assert.equal(layers.find((l) => l.name === 'OK')!.swapped, false)
  })

  test('flags a layer outside Estonia', async () => {
    const { layers } = await readDxf(
      write([
        { type: 'line', layer: 'FAR', from: [100, 100], to: [200, 200] },
        { type: 'line', layer: 'OK', from: [E, N], to: [E + 100, N] },
      ]),
    )
    assert.equal(layers.find((l) => l.name === 'FAR')!.inEstonia, false)
    assert.equal(layers.find((l) => l.name === 'OK')!.inEstonia, true)
  })

  test('rejects a file without lines', async () => {
    await assert.rejects(readDxf(write([{ type: 'point', layer: 'P', at: [E, N] }])), UploadError)
  })

  test('rejects a file that is not a DXF', async () => {
    const file = join(dir, 'garbage.dxf')
    writeFileSync(file, 'not a dxf')
    await assert.rejects(readDxf(file), UploadError)
  })
})

describe('mergeLayers', () => {
  test('merges the chosen layers into one MultiLineString', async () => {
    const merged = mergeLayers(await readDxf(mixed()), ['SITRASS', 'SIKAEV'])
    assert.equal(merged.lest.type, 'MultiLineString')
    assert.equal(merged.lest.coordinates.length, 3)
    assert.equal(merged.wgs.coordinates.length, 3)
    assert.equal(merged.lengthM, 705)
  })

  test('rejects an empty, unknown or outside-Estonia selection', async () => {
    const contents = await readDxf(
      write([
        { type: 'line', layer: 'FAR', from: [100, 100], to: [200, 200] },
        { type: 'line', layer: 'OK', from: [E, N], to: [E + 100, N] },
      ]),
    )
    assert.throws(() => mergeLayers(contents, []), UploadError)
    assert.throws(() => mergeLayers(contents, ['NOPE']), UploadError)
    assert.throws(() => mergeLayers(contents, ['OK', 'FAR']), UploadError)
  })
})

const SAMPLE = join(process.env.HOME ?? '', 'Downloads/22M6081_CO3350_Kolkja/22M6081_CO3350_Kolkja.dxf')

test('client sample: SITRASS is about 1.2 km and paper space is gone', { skip: !existsSync(SAMPLE) }, async () => {
  const { layers } = await readDxf(SAMPLE)
  const sitrass = layers.find((l) => l.name === 'SITRASS')!
  assert.ok(Math.abs(sitrass.lengthM - 1189) < 5, `SITRASS ${sitrass.lengthM}`)
  assert.ok(layers.every((l) => l.inEstonia), layers.filter((l) => !l.inEstonia).map((l) => l.name).join())
})
