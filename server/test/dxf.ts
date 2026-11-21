/** Hand-written ASCII DXF fixtures: the bundled GDAL can't create DXF files. */

export type Entity =
  | { type: 'line'; layer: string; from: [number, number]; to: [number, number]; paperSpace?: boolean }
  | { type: 'polyline'; layer: string; points: [number, number][] }
  | { type: 'point'; layer: string; at: [number, number] }
  | { type: 'text'; layer: string; at: [number, number]; text: string }
  | { type: 'solid'; layer: string; corners: [[number, number], [number, number], [number, number]] }
  | { type: 'insert'; layer: string; block: string; at: [number, number] }

export interface Block {
  name: string
  entities: Entity[]
}

function entity(e: Entity): (string | number)[] {
  const head = (name: string) => [0, name, 8, e.layer]
  switch (e.type) {
    case 'line':
      return [...head('LINE'), ...(e.paperSpace ? [67, 1] : []), 10, e.from[0], 20, e.from[1], 30, 0, 11, e.to[0], 21, e.to[1], 31, 0]
    case 'polyline':
      return [...head('LWPOLYLINE'), 90, e.points.length, 70, 0, ...e.points.flatMap(([x, y]) => [10, x, 20, y])]
    case 'point':
      return [...head('POINT'), 10, e.at[0], 20, e.at[1], 30, 0]
    case 'text':
      return [...head('TEXT'), 10, e.at[0], 20, e.at[1], 30, 0, 40, 1, 1, e.text]
    case 'solid': {
      const [a, b, c] = e.corners
      return [...head('SOLID'), 10, a[0], 20, a[1], 30, 0, 11, b[0], 21, b[1], 31, 0, 12, c[0], 22, c[1], 32, 0, 13, c[0], 23, c[1], 33, 0]
    }
    case 'insert':
      return [...head('INSERT'), 2, e.block, 10, e.at[0], 20, e.at[1], 30, 0]
  }
}

export function dxf(entities: Entity[], blocks: Block[] = []): string {
  const codes: (string | number)[] = [0, 'SECTION', 2, 'HEADER', 0, 'ENDSEC']
  if (blocks.length) {
    codes.push(0, 'SECTION', 2, 'BLOCKS')
    for (const b of blocks) {
      codes.push(0, 'BLOCK', 8, '0', 2, b.name, 70, 0, 10, 0, 20, 0, 30, 0, 3, b.name)
      codes.push(...b.entities.flatMap(entity))
      codes.push(0, 'ENDBLK', 8, '0')
    }
    codes.push(0, 'ENDSEC')
  }
  codes.push(0, 'SECTION', 2, 'ENTITIES', ...entities.flatMap(entity), 0, 'ENDSEC', 0, 'EOF')
  return codes.join('\n') + '\n'
}
