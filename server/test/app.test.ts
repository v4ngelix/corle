import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import { buildApp } from '../src/app.ts'

let server: Server
let base: string
const dataDir = mkdtempSync(join(tmpdir(), 'corle-test-'))
const webDir = mkdtempSync(join(tmpdir(), 'corle-web-'))
const tiles = Buffer.from('0123456789')
const indexHtml = '<!doctype html><title>CORLE</title>'

before(async () => {
  mkdirSync(join(dataDir, 'layers'))
  writeFileSync(join(dataDir, 'layers', 'static.pmtiles'), tiles)
  writeFileSync(join(webDir, 'index.html'), indexHtml)
  server = buildApp({ dataDir, webDir }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.close()
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(webDir, { recursive: true, force: true })
})

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('unknown route returns 404', async () => {
  const res = await fetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
})

test('GET /layers/static.pmtiles serves the file', async () => {
  const res = await fetch(`${base}/layers/static.pmtiles`)
  assert.equal(res.status, 200)
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), tiles)
})

test('GET /layers/static.pmtiles supports range requests', async () => {
  const res = await fetch(`${base}/layers/static.pmtiles`, { headers: { Range: 'bytes=2-5' } })
  assert.equal(res.status, 206)
  assert.equal(await res.text(), '2345')
})

test('missing layer file returns 404', async () => {
  const res = await fetch(`${base}/layers/nope.pmtiles`)
  assert.equal(res.status, 404)
})

test('GET / serves the built frontend', async () => {
  const res = await fetch(`${base}/`)
  assert.equal(res.status, 200)
  assert.equal(await res.text(), indexHtml)
})
