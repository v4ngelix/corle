import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import { buildApp } from '../src/app.ts'

let server: Server
let base: string

before(async () => {
  server = buildApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => server.close())

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

const stubs = [
  ['GET', '/api/drawings.geojson'],
  ['GET', '/api/drawings'],
  ['POST', '/api/drawings'],
  ['PATCH', '/api/drawings/1'],
  ['DELETE', '/api/drawings/1'],
  ['GET', '/layers/seadustusala.geojson'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/auth/me'],
  ['POST', '/api/uploads'],
  ['GET', '/api/uploads/1/file'],
] as const

for (const [method, path] of stubs) {
  test(`${method} ${path} returns 501`, async () => {
    const res = await fetch(`${base}${path}`, { method })
    assert.equal(res.status, 501)
  })
}

test('unknown route returns 404', async () => {
  const res = await fetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
})
