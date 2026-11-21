import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'
import { dxf } from './dxf.ts'

const PASSWORD = 'test-password'
const dataDir = mkdtempSync(join(tmpdir(), 'corle-uploads-'))
const uploadsDir = join(dataDir, 'uploads')

const E = 540000
const N = 6580000
const FILENAME = 'Kolkja_õhuliin.dxf'
const SAMPLE = dxf([
  { type: 'line', layer: 'SITRASS', from: [E, N], to: [E + 300, N + 400] },
  { type: 'line', layer: 'SIKAEV', from: [E, N], to: [E + 5, N] },
  { type: 'line', layer: 'PIIR', from: [E, N], to: [E, N + 1000] },
  { type: 'line', layer: 'FAR', from: [100, 100], to: [200, 200] },
  { type: 'text', layer: 'MOOTNR', at: [E, N], text: '101' },
])

let server: Server
let base: string
let cookie: string

interface Preview {
  uploadId: number
  filename: string
  layers: { name: string; lines: number; lengthM: number; swapped: boolean; inEstonia: boolean; geometry: { type: string } }[]
  ignored: { points: number; polygons: number; other: number }
}

interface Drawing {
  id: number
  name: string
  municipality: string | null
  settlement: string | null
  location: string
  surveyor: string | null
  surveyedOn: string | null
  accuracyClass: number | null
  lengthM: number
  uploadId: number | null
  originalFilename: string | null
  bbox: [number, number, number, number]
  attrs: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const auth = () => ({ Cookie: cookie })

function upload(body: string, filename: string | null = FILENAME, withCookie = true) {
  const query = filename === null ? '' : `?filename=${encodeURIComponent(filename)}`
  return fetch(`${base}/api/uploads${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(withCookie ? auth() : {}) },
    body,
  })
}

function json(method: string, path: string, body: unknown, withCookie = true) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(withCookie ? auth() : {}) },
    body: JSON.stringify(body),
  })
}

async function preview(): Promise<Preview> {
  const res = await upload(SAMPLE)
  assert.equal(res.status, 200, await res.clone().text())
  return res.json() as Promise<Preview>
}

const fields = {
  name: 'Kolkja_CO3350',
  municipality: 'Peipsiääre vald',
  settlement: 'Kolkja alevik',
  location: 'underground',
  surveyor: 'Geo S.T. OÜ',
  surveyedOn: '2026-11-11',
}

async function publicIds(): Promise<number[]> {
  const body = (await (await fetch(`${base}/api/drawings.geojson`)).json()) as { features: { id: number }[] }
  return body.features.map((f) => f.id)
}

before(async () => {
  server = buildApp({ dataDir, adminPassword: PASSWORD }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const res = await json('POST', '/api/auth/login', { password: PASSWORD }, false)
  cookie = res.headers.getSetCookie()[0].split(';')[0]
})

after(() => {
  server.close()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('login required', () => {
  const routes = [
    ['GET', '/api/drawings'],
    ['POST', '/api/drawings'],
    ['PATCH', '/api/drawings/1'],
    ['DELETE', '/api/drawings/1'],
    ['POST', '/api/uploads'],
    ['GET', '/api/uploads/1/file'],
  ] as const

  for (const [method, path] of routes) {
    test(`${method} ${path} returns 401 without a session`, async () => {
      assert.equal((await fetch(`${base}${path}`, { method })).status, 401)
    })
  }
})

describe('POST /api/uploads', () => {
  const rejected: [string, () => Promise<Response>][] = [
    ['a missing file name', () => upload(SAMPLE, null)],
    ['a file name that is not .dxf', () => upload(SAMPLE, 'joonis.dwg')],
    ['an empty body', () => upload('')],
    ['a file that is not a DXF', () => upload('not a dxf')],
    ['a DXF without lines', () => upload(dxf([{ type: 'point', layer: 'P', at: [E, N] }]))],
  ]

  for (const [name, send] of rejected) {
    test(`rejects ${name} with 400 and stores nothing`, async () => {
      const res = await send()
      assert.equal(res.status, 400)
      assert.ok(((await res.json()) as { error: string }).error)
      assert.deepEqual(existsSync(uploadsDir) ? readdirSync(uploadsDir) : [], [])
    })
  }

  test('returns a per-layer preview in WGS84 and keeps the file', async () => {
    const body = await preview()
    assert.ok(Number.isInteger(body.uploadId))
    assert.equal(body.filename, FILENAME)
    assert.deepEqual(
      body.layers.map((l) => [l.name, l.lines, l.lengthM, l.swapped, l.inEstonia, l.geometry.type]),
      [
        ['FAR', 1, Math.hypot(100, 100), false, false, 'MultiLineString'],
        ['PIIR', 1, 1000, false, true, 'MultiLineString'],
        ['SIKAEV', 1, 5, false, true, 'MultiLineString'],
        ['SITRASS', 1, 500, false, true, 'MultiLineString'],
      ],
    )
    assert.deepEqual(body.ignored, { points: 1, polygons: 0, other: 0 })
    assert.ok(existsSync(join(uploadsDir, `${body.uploadId}.dxf`)))
  })

  test('deletes previews that were never saved after 24 h', async () => {
    const old = await preview()
    const db = openDb(join(dataDir, 'corle.sqlite'))
    db.prepare('UPDATE uploads SET uploaded_at = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600_000).toISOString(), old.uploadId)
    db.close()
    const fresh = await preview()
    assert.ok(!existsSync(join(uploadsDir, `${old.uploadId}.dxf`)))
    assert.ok(existsSync(join(uploadsDir, `${fresh.uploadId}.dxf`)))
    assert.equal((await fetch(`${base}/api/uploads/${old.uploadId}/file`, { headers: auth() })).status, 404)
  })
})

describe('drawings', () => {
  let uploadId: number
  let drawing: Drawing

  before(async () => {
    uploadId = (await preview()).uploadId
  })

  const invalid: [string, () => object][] = [
    ['no name', () => ({ ...fields, uploadId, layers: ['SITRASS'], name: ' ' })],
    ['an unknown location', () => ({ ...fields, uploadId, layers: ['SITRASS'], location: 'space' })],
    ['a bad date', () => ({ ...fields, uploadId, layers: ['SITRASS'], surveyedOn: '11.11.2026' })],
    ['no layers', () => ({ ...fields, uploadId, layers: [] })],
    ['an unknown layer', () => ({ ...fields, uploadId, layers: ['NOPE'] })],
    ['a layer outside Estonia', () => ({ ...fields, uploadId, layers: ['SITRASS', 'FAR'] })],
  ]

  for (const [name, body] of invalid) {
    test(`save rejects ${name} with 400`, async () => {
      const res = await json('POST', '/api/drawings', body())
      assert.equal(res.status, 400)
      assert.ok(((await res.json()) as { error: string }).error)
    })
  }

  test('save with an unknown upload returns 404', async () => {
    assert.equal((await json('POST', '/api/drawings', { ...fields, uploadId: 9999, layers: ['SITRASS'] })).status, 404)
  })

  test('save merges the chosen layers and the drawing appears on the map', async () => {
    const res = await json('POST', '/api/drawings', { ...fields, uploadId, layers: ['SITRASS', 'SIKAEV'], surveyor: '' })
    assert.equal(res.status, 201, await res.clone().text())
    drawing = (await res.json()) as Drawing
    assert.equal(drawing.name, 'Kolkja_CO3350')
    assert.equal(drawing.location, 'underground')
    assert.equal(drawing.surveyor, null)
    assert.equal(drawing.surveyedOn, '2026-11-11')
    assert.equal(drawing.accuracyClass, null)
    assert.equal(drawing.lengthM, 505)
    assert.equal(drawing.uploadId, uploadId)
    assert.equal(drawing.originalFilename, FILENAME)
    assert.deepEqual(drawing.attrs, { DXF_LAYERS: ['SITRASS', 'SIKAEV'] })
    const [w, s, e, n] = drawing.bbox
    assert.ok(w < e && s < n && w > 24 && n < 60, `bbox ${drawing.bbox}`)
    assert.ok((await publicIds()).includes(drawing.id))
  })

  test('the same upload cannot be saved twice', async () => {
    assert.equal((await json('POST', '/api/drawings', { ...fields, uploadId, layers: ['SITRASS'] })).status, 409)
  })

  test('list returns the drawing with all details and no geometry', async () => {
    const res = await fetch(`${base}/api/drawings`, { headers: auth() })
    assert.equal(res.status, 200)
    const list = (await res.json()) as Record<string, unknown>[]
    const row = list.find((d) => d.id === drawing.id)
    assert.deepEqual(row, drawing as unknown as Record<string, unknown>)
    assert.ok(!('geometry' in row!) && !('geomWgs' in row!))
  })

  test('edit validates and updates the given fields only', async () => {
    assert.equal((await json('PATCH', `/api/drawings/${drawing.id}`, { location: 'space' })).status, 400)
    assert.equal((await json('PATCH', '/api/drawings/9999', { name: 'x' })).status, 404)
    const res = await json('PATCH', `/api/drawings/${drawing.id}`, { name: ' Kolkja_CO3351 ', settlement: '' })
    assert.equal(res.status, 200)
    const updated = (await res.json()) as Drawing
    assert.equal(updated.name, 'Kolkja_CO3351')
    assert.equal(updated.settlement, null)
    assert.equal(updated.municipality, fields.municipality)
    assert.ok(updated.updatedAt >= drawing.updatedAt)
  })

  test('download returns the original file under its own name', async () => {
    const res = await fetch(`${base}/api/uploads/${uploadId}/file`, { headers: auth() })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-disposition') ?? '', /attachment;.*filename\*=UTF-8''Kolkja_%C3%B5huliin\.dxf/)
    assert.equal(await res.text(), SAMPLE)
  })

  test('download of an unknown upload returns 404', async () => {
    assert.equal((await fetch(`${base}/api/uploads/9999/file`, { headers: auth() })).status, 404)
  })

  test('delete removes the drawing and its file', async () => {
    const res = await fetch(`${base}/api/drawings/${drawing.id}`, { method: 'DELETE', headers: auth() })
    assert.equal(res.status, 204)
    assert.ok(!(await publicIds()).includes(drawing.id))
    assert.ok(!existsSync(join(uploadsDir, `${uploadId}.dxf`)))
    assert.equal((await fetch(`${base}/api/uploads/${uploadId}/file`, { headers: auth() })).status, 404)
    assert.equal((await fetch(`${base}/api/drawings/${drawing.id}`, { method: 'DELETE', headers: auth() })).status, 404)
  })
})
