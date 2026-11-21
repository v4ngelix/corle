import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { buildApp } from '../src/app.ts'

const png = Buffer.from('fake-png')
const dataDir = mkdtempSync(join(tmpdir(), 'corle-elasa-'))

let upstream: Server
let app: Server
let base: string
let calls: IncomingMessage[] = []
let reply: { status: number; type: string; body: Buffer | string } = { status: 200, type: 'image/png', body: png }

const valid = {
  SERVICE: 'WMS',
  VERSION: '1.1.1',
  REQUEST: 'GetMap',
  LAYERS: 'avalik_trassid',
  STYLES: '',
  FORMAT: 'image/png',
  TRANSPARENT: 'true',
  SRS: 'EPSG:3857',
  WIDTH: '256',
  HEIGHT: '256',
  BBOX: '2700000,8200000,2710000,8210000',
}

let bboxCounter = 0
/** Unique BBOX per call, so tests do not hit each other's cache entries. */
function params(overrides: Record<string, string> = {}): URLSearchParams {
  bboxCounter++
  return new URLSearchParams({ ...valid, BBOX: `${bboxCounter},0,${bboxCounter + 1},1`, ...overrides })
}

function get(query: URLSearchParams) {
  return fetch(`${base}/api/elasa/wms?${query}`)
}

before(async () => {
  upstream = createServer((req, res) => {
    calls.push(req)
    res.writeHead(reply.status, { 'Content-Type': reply.type })
    res.end(reply.body)
  }).listen(0)
  await new Promise((resolve) => upstream.once('listening', resolve))
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/wms/elasa`

  app = buildApp({ dataDir, elasa: { upstream: upstreamUrl, maxPerMinute: 1000 } }).listen(0)
  await new Promise((resolve) => app.once('listening', resolve))
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`
})

beforeEach(() => {
  calls = []
  reply = { status: 200, type: 'image/png', body: png }
})

after(() => {
  app.close()
  upstream.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('valid request returns the image and sends the ELASA Referer', async () => {
  const query = params()
  const res = await get(query)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/png')
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600')
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), png)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].headers.referer, 'https://kaart.elasa.ee/')
  const sent = new URL(calls[0].url!, 'http://x').searchParams
  assert.equal(sent.get('LAYERS'), 'avalik_trassid')
  assert.equal(sent.get('BBOX'), query.get('BBOX'))
})

test('same request twice calls upstream once', async () => {
  const query = params()
  assert.equal((await get(query)).status, 200)
  const res = await get(query)
  assert.equal(res.status, 200)
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), png)
  assert.equal(calls.length, 1)
})

const bad: Array<[string, Record<string, string>]> = [
  ['wrong layer', { LAYERS: 'secret' }],
  ['wrong request', { REQUEST: 'GetFeatureInfo' }],
  ['extra param', { URL: 'http://evil' }],
  ['width too big', { WIDTH: '5000' }],
  ['width not a number', { WIDTH: 'abc' }],
  ['bbox with 3 numbers', { BBOX: '1,2,3' }],
  ['bbox not numbers', { BBOX: 'a,b,c,d' }],
]

for (const [name, overrides] of bad) {
  test(`400 for ${name}`, async () => {
    const res = await get(params(overrides))
    assert.equal(res.status, 400)
    assert.equal(calls.length, 0)
  })
}

test('400 for a missing param', async () => {
  const query = params()
  query.delete('HEIGHT')
  assert.equal((await get(query)).status, 400)
  assert.equal(calls.length, 0)
})

test('upstream HTML error → 502, not cached', async () => {
  reply = { status: 200, type: 'text/html', body: '<html>error</html>' }
  const query = params()
  assert.equal((await get(query)).status, 502)
  reply = { status: 200, type: 'image/png', body: png }
  assert.equal((await get(query)).status, 200)
  assert.equal(calls.length, 2)
})

test('upstream 500 → 502', async () => {
  reply = { status: 500, type: 'image/png', body: png }
  assert.equal((await get(params())).status, 502)
})

test('over the per-minute limit → 429', async () => {
  // Separate app with its own limiter, so earlier tests do not count.
  const limited = buildApp({
    dataDir,
    elasa: { upstream: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/wms/elasa`, maxPerMinute: 3 },
  }).listen(0)
  await new Promise((resolve) => limited.once('listening', resolve))
  const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/elasa/wms`
  try {
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await fetch(`${url}?${params()}`)).status)
    assert.deepEqual(statuses, [200, 200, 200, 429])
  } finally {
    limited.close()
  }
})
