import { Router } from 'express'

export interface ElasaOptions {
  /** ELASA WMS address. */
  upstream?: string
  /** Requests allowed per IP per minute. */
  maxPerMinute?: number
}

const DEFAULT_UPSTREAM = 'https://kaart.elasa.ee/wms/elasa'
const REFERER = 'https://kaart.elasa.ee/'
const TIMEOUT_MS = 10_000
const CACHE_SIZE = 1000
const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_SIZE = 2048

const FIXED: Record<string, string> = {
  SERVICE: 'WMS',
  VERSION: '1.1.1',
  REQUEST: 'GetMap',
  LAYERS: 'avalik_trassid',
  STYLES: '',
  FORMAT: 'image/png',
  TRANSPARENT: 'true',
  SRS: 'EPSG:3857',
}
const ALLOWED = new Set([...Object.keys(FIXED), 'WIDTH', 'HEIGHT', 'BBOX'])

interface Tile {
  type: string
  body: Buffer
  expires: number
}

function checkedQuery(query: Record<string, unknown>): URLSearchParams | undefined {
  const keys = Object.keys(query)
  if (keys.some((key) => !ALLOWED.has(key)) || keys.length !== ALLOWED.size) return undefined
  if (Object.values(query).some((value) => typeof value !== 'string')) return undefined
  const params = query as Record<string, string>

  for (const [key, value] of Object.entries(FIXED)) if (params[key] !== value) return undefined
  for (const key of ['WIDTH', 'HEIGHT']) {
    if (!/^\d+$/.test(params[key])) return undefined
    const size = Number(params[key])
    if (size < 1 || size > MAX_SIZE) return undefined
  }
  const bbox = params.BBOX.split(',')
  if (bbox.length !== 4 || bbox.some((n) => n.trim() === '' || !Number.isFinite(Number(n)))) return undefined

  return new URLSearchParams({
    ...FIXED,
    WIDTH: params.WIDTH,
    HEIGHT: params.HEIGHT,
    BBOX: bbox.map(Number).join(','),
  })
}

export function elasa({ upstream = DEFAULT_UPSTREAM, maxPerMinute = 600 }: ElasaOptions = {}) {
  const router = Router()
  const cache = new Map<string, Tile>()
  const counts = new Map<string, number>()
  let windowStart = Date.now()

  router.get('/wms', async (req, res) => {
    const now = Date.now()
    if (now - windowStart >= 60_000) {
      counts.clear()
      windowStart = now
    }
    const ip = req.ip ?? ''
    const count = (counts.get(ip) ?? 0) + 1
    counts.set(ip, count)
    if (count > maxPerMinute) {
      res.status(429).json({ error: 'Too many requests' })
      return
    }

    const params = checkedQuery(req.query)
    if (!params) {
      res.status(400).json({ error: 'Invalid WMS parameters' })
      return
    }
    const url = `${upstream}?${params}`

    let tile = cache.get(url)
    if (tile && tile.expires > now) {
      cache.delete(url)
      cache.set(url, tile)
    } else {
      cache.delete(url)
      tile = await fetchTile(url)
      if (!tile) {
        res.status(502).json({ error: 'ELASA did not return an image' })
        return
      }
      cache.set(url, tile)
      if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
    }

    res.set('Cache-Control', 'public, max-age=3600').type(tile.type).send(tile.body)
  })

  return router
}

async function fetchTile(url: string): Promise<Tile | undefined> {
  try {
    const upstreamRes = await fetch(url, {
      headers: { Referer: REFERER },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const type = upstreamRes.headers.get('content-type') ?? ''
    if (upstreamRes.status !== 200 || !type.startsWith('image/')) return undefined
    return { type, body: Buffer.from(await upstreamRes.arrayBuffer()), expires: Date.now() + CACHE_TTL_MS }
  } catch {
    return undefined
  }
}
