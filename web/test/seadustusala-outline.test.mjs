import assert from 'node:assert/strict'
import test from 'node:test'

Object.defineProperty(globalThis, 'window', { value: { location: { origin: 'http://localhost:5173' } } })

const { OVERLAYS } = await import('../src/config.ts')

test('Seadustusala draws a distinct thicker outline over its fill', () => {
  const overlay = OVERLAYS.find((o) => o.id === 'seadustusala')
  assert.equal(overlay.kind, 'vector')
  const [fill, line] = overlay.styles
  assert.equal(fill.type, 'fill')
  assert.equal(fill.paint['fill-opacity'], 0.5)
  assert.equal(line.type, 'line')
  assert.equal(line.paint['line-color'], '#b71c1c')
  assert.equal(line.paint['line-width'], 2)
})