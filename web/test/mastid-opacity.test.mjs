import assert from 'node:assert/strict'
import test from 'node:test'

Object.defineProperty(globalThis, 'window', { value: { location: { origin: 'http://localhost:5173' } } })

const { OVERLAYS } = await import('../src/config.ts')

test('Mastid polygons retain their outline with 0.5 fill opacity', () => {
  const mastid = OVERLAYS.find((overlay) => overlay.id === 'mastid')
  assert.equal(mastid.kind, 'vector')
  assert.equal(mastid.styles[0].paint['fill-opacity'], 0.5)
  assert.equal(mastid.styles[1].paint['line-color'], '#dc4523')
})
