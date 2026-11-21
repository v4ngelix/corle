import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ogr2ogr } from './ogr2ogr.ts'
import { after, before, describe, test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { ogrinfo } from '../src/gdal.ts'

const PASSWORD = 'test-password'
const dataDir = mkdtempSync(join(tmpdir(), 'corle-layerfiles-'))
const fixtures = mkdtempSync(join(tmpdir(), 'corle-fixtures-'))
const sourceDir = join(dataDir, 'source')
const pmtiles = join(dataDir, 'layers', 'static.pmtiles')

let server: Server
let base: string
let cookie: string

const square = (e: number, n: number, d = 100) => [
  [
    [e, n],
    [e + d, n],
    [e + d, n + d],
    [e, n + d],
    [e, n],
  ],
]
const polygon3301 = { type: 'Polygon', coordinates: square(540000, 6580000) }
const line3301 = {
  type: 'LineString',
  coordinates: [
    [540000, 6580000],
    [541000, 6581000],
  ],
}
const polygon4326 = {
  type: 'Polygon',
  coordinates: [
    [
      [24.7, 59.3],
      [24.71, 59.3],
      [24.71, 59.31],
      [24.7, 59.31],
      [24.7, 59.3],
    ],
  ],
}
const polygonOutside = { type: 'Polygon', coordinates: square(100000, 5000000) }

/** Writes a one-layer GeoPackage from a geometry and returns its path. */
function gpkg(name: string, geometry: object, epsg = 3301): string {
  const geojson = join(fixtures, `${name}.geojson`)
  const out = join(fixtures, `${name}.gpkg`)
  writeFileSync(
    geojson,
    JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nimi: name }, geometry }] }),
  )
  ogr2ogr(out, geojson, ['-nln', name, '-a_srs', `EPSG:${epsg}`])
  return out
}

function login(password: string) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

function upload(id: string, file: string | Buffer, withCookie = true) {
  return fetch(`${base}/api/layers/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(withCookie ? { Cookie: cookie } : {}) },
    body: new Uint8Array(typeof file === 'string' ? readFileSync(file) : file),
  })
}

function historyFiles(id: string): string[] {
  const dir = join(sourceDir, 'history')
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(`${id}-`)) : []
}

before(async () => {
  mkdirSync(sourceDir, { recursive: true })
  execFileSync('cp', [gpkg('seadustusala', polygon3301), join(sourceDir, 'seadustusala.gpkg')])
  execFileSync('cp', [gpkg('5g', line3301), join(sourceDir, '5g.gpkg')])
  execFileSync('cp', [gpkg('mastid', polygon3301), join(sourceDir, 'mastid.gpkg')])
  server = buildApp({ dataDir, adminPassword: PASSWORD }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.close()
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(fixtures, { recursive: true, force: true })
})

describe('auth', () => {
  test('wrong password returns 401 and no cookie', async () => {
    const res = await login('nope')
    assert.equal(res.status, 401)
    assert.deepEqual(res.headers.getSetCookie(), [])
  })

  test('me without cookie returns 401', async () => {
    const res = await fetch(`${base}/api/auth/me`)
    assert.equal(res.status, 401)
  })

  test('right password sets an HttpOnly session cookie', async () => {
    const res = await login(PASSWORD)
    assert.equal(res.status, 204)
    const [setCookie] = res.headers.getSetCookie()
    assert.match(setCookie, /^corle_session=[^;]+/)
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Lax/i)
    cookie = setCookie.split(';')[0]
  })

  test('me with cookie returns 204', async () => {
    const res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
    assert.equal(res.status, 204)
  })

  test('logout ends the session', async () => {
    const res = await login(PASSWORD)
    const other = res.headers.getSetCookie()[0].split(';')[0]
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: other } })).status, 204)
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: other } })).status, 401)
  })

  test('without ADMIN_PASSWORD nobody can log in', async () => {
    const locked = buildApp({ dataDir }).listen(0)
    await new Promise((resolve) => locked.once('listening', resolve))
    try {
      const port = (locked.address() as AddressInfo).port
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '' }),
      })
      assert.equal(res.status, 401)
    } finally {
      locked.close()
    }
  })
})

describe('layer files', () => {
  test('list, download and upload need login', async () => {
    assert.equal((await fetch(`${base}/api/layers`)).status, 401)
    assert.equal((await fetch(`${base}/api/layers/mastid.gpkg`)).status, 401)
    assert.equal((await upload('mastid', gpkg('m0', polygon3301), false)).status, 401)
  })

  test('unknown layer returns 404', async () => {
    assert.equal((await fetch(`${base}/api/layers/nope.gpkg`, { headers: { Cookie: cookie } })).status, 404)
    assert.equal((await upload('nope', gpkg('n0', polygon3301))).status, 404)
  })

  test('list returns the three layers with update times', async () => {
    const res = await fetch(`${base}/api/layers`, { headers: { Cookie: cookie } })
    assert.equal(res.status, 200)
    const body = (await res.json()) as { id: string; label: string; updatedAt: string }[]
    assert.deepEqual(
      body.map((l) => l.id),
      ['seadustusala', '5g', 'mastid'],
    )
    for (const l of body) assert.ok(!Number.isNaN(Date.parse(l.updatedAt)))
  })

  test('download returns the exact file as an attachment', async () => {
    const res = await fetch(`${base}/api/layers/mastid.gpkg`, { headers: { Cookie: cookie } })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="?Mastid_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.gpkg"?/)
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), readFileSync(join(sourceDir, 'mastid.gpkg')))
  })

  const rejected: [string, string, () => string | Buffer][] = [
    ['lines into a polygon layer', 'seadustusala', () => gpkg('bad-lines', line3301)],
    ['polygons into a line layer', '5g', () => gpkg('bad-polys', polygon3301)],
    ['a file outside Estonia', 'mastid', () => gpkg('bad-outside', polygonOutside)],
    ['a file that is not a GeoPackage', 'mastid', () => Buffer.from('not a geopackage')],
    [
      'a file with two layers',
      'mastid',
      () => {
        const file = gpkg('bad-two', polygon3301)
        ogr2ogr(file, gpkg('bad-two-b', polygon3301), ['-nln', 'teine'], true)
        return file
      },
    ],
  ]

  for (const [name, id, make] of rejected) {
    test(`upload rejects ${name} and keeps the old file`, async () => {
      const before = readFileSync(join(sourceDir, `${id}.gpkg`))
      const res = await upload(id, make())
      assert.equal(res.status, 400)
      assert.ok(((await res.json()) as { error: string }).error)
      assert.deepEqual(readFileSync(join(sourceDir, `${id}.gpkg`)), before)
      assert.deepEqual(historyFiles(id), [])
      assert.deepEqual(
        readdirSync(sourceDir).filter((f) => f.endsWith('.tmp')),
        [],
      )
    })
  }

  test('valid upload replaces the file, keeps a history copy and rebuilds the tiles', async () => {
    const old = readFileSync(join(sourceDir, 'mastid.gpkg'))
    const file = gpkg('mastid-new', polygon3301)
    const res = await upload('mastid', file)
    assert.equal(res.status, 200, await res.clone().text())
    assert.deepEqual(readFileSync(join(sourceDir, 'mastid.gpkg')), readFileSync(file))
    const history = historyFiles('mastid')
    assert.equal(history.length, 1)
    assert.deepEqual(readFileSync(join(sourceDir, 'history', history[0])), old)
    assert.ok(statSync(pmtiles).size > 0)
    const layers = (await ogrinfo(pmtiles)).map((l) => l.name)
    assert.deepEqual(layers.sort(), ['5g', 'mastid', 'seadustusala'])
  })

  test('upload in another coordinate system is stored in EPSG:3301', async () => {
    const res = await upload('seadustusala', gpkg('sa-4326', polygon4326, 4326))
    assert.equal(res.status, 200, await res.clone().text())
    assert.equal((await ogrinfo(join(sourceDir, 'seadustusala.gpkg')))[0].epsg, 3301)
  })
})
