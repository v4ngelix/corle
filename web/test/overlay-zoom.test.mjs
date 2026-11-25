import assert from 'node:assert/strict'
import test from 'node:test'

Object.defineProperty(globalThis, 'window', { value: { location: { origin: 'http://localhost:5173' } } })

const { OVERLAYS } = await import('../src/config.ts')
const { minzoomOf, zoomToShow } = await import('../src/map/overlayZoom.ts')

const overlay = (id) => OVERLAYS.find((o) => o.id === id)

test('overlay minzoom comes from the WMS option or the vector styles', () => {
  assert.equal(minzoomOf(overlay('katastriandmed')), 15)
  assert.equal(minzoomOf(overlay('seadustusala')), 7)
  assert.equal(minzoomOf(overlay('teostus-maa-alune')), 0)
})

test('turning on a layer below its minzoom zooms the map to it', () => {
  assert.equal(zoomToShow(overlay('katastripiirid'), 11), 14)
  assert.equal(zoomToShow(overlay('katastriandmed'), 16), null)
  assert.equal(zoomToShow(overlay('teostus-ohk'), 5), null)
})