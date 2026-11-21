import express, { Router } from 'express'
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requireAuth, type Sessions } from '../auth.ts'
import gdal from 'gdal-async'
import { buildStaticLayers, ogrinfo, reprojectTo3301 } from '../gdal.ts'

type GeometryFamily = 'line' | 'polygon'

const LAYERS: { id: string; label: string; geometry: GeometryFamily }[] = [
  { id: 'seadustusala', label: 'Seadustusala', geometry: 'polygon' },
  { id: '5g', label: '5G', geometry: 'line' },
  { id: 'mastid', label: 'Mastid', geometry: 'polygon' },
]

const GEOMETRY_TYPES: Record<GeometryFamily, number[]> = {
  line: [gdal.wkbLineString, gdal.wkbMultiLineString],
  polygon: [gdal.wkbPolygon, gdal.wkbMultiPolygon],
}
const GEOMETRY_NAMES: Record<GeometryFamily, string> = { line: 'jooned', polygon: 'pinnad' }

const ESTONIA = { minE: 300_000, maxE: 800_000, minN: 6_300_000, maxN: 6_700_000 }

const MAX_UPLOAD = '50mb'

class UploadError extends Error {}

/** "2026-11-21_15-57" in Tallinn time: safe in file names on every OS. */
function fileTimestamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Tallinn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}`
}

async function validate(file: string, geometry: GeometryFamily): Promise<{ needsReprojection: boolean }> {
  const layers = await ogrinfo(file).catch(() => {
    throw new UploadError('Faili ei saa avada. Kas see on GeoPackage (.gpkg)?')
  })
  if (layers.length !== 1) throw new UploadError(`Failis peab olema täpselt üks kiht, praegu on ${layers.length}.`)
  const [layer] = layers
  if (layer.featureCount === 0) throw new UploadError('Kihis pole ühtegi objekti.')
  if (!GEOMETRY_TYPES[geometry].includes(layer.geometryType)) {
    throw new UploadError(`Selles kihis peavad olema ${GEOMETRY_NAMES[geometry]}, failis on ${layer.geometryName || 'geomeetriata'}.`)
  }
  if (!layer.hasCoordinateSystem) throw new UploadError('Failil puudub koordinaatsüsteem.')
  return { needsReprojection: layer.epsg !== 3301 }
}

function checkInEstonia(extent: [number, number, number, number] | undefined): void {
  if (!extent) throw new UploadError('Kihi ulatust ei õnnestunud lugeda.')
  const [minE, minN, maxE, maxN] = extent
  if (minE < ESTONIA.minE || maxE > ESTONIA.maxE || minN < ESTONIA.minN || maxN > ESTONIA.maxN) {
    throw new UploadError('Andmed jäävad Eestist välja. Kontrolli koordinaatsüsteemi.')
  }
}

/** Download and replace the static layers' source GeoPackages. All routes need a login. */
export function layerFiles(dataDir: string, sessions: Sessions) {
  const sourceDir = join(dataDir, 'source')
  const historyDir = join(sourceDir, 'history')
  const sourceFile = (id: string) => join(sourceDir, `${id}.gpkg`)
  const rebuild = () => buildStaticLayers(dataDir)

  let queue: Promise<unknown> = Promise.resolve()
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work)
    queue = result.catch(() => {})
    return result
  }

  async function replace(id: string, geometry: GeometryFamily, body: Buffer): Promise<void> {
    const uploaded = join(sourceDir, `.${id}.upload.tmp`)
    const reprojected = join(sourceDir, `.${id}.3301.tmp`)
    try {
      await writeFile(uploaded, body)
      const { needsReprojection } = await validate(uploaded, geometry)
      let ready = uploaded
      if (needsReprojection) {
        await reprojectTo3301(uploaded, reprojected).catch(() => {
          throw new UploadError('Koordinaatsüsteemi teisendamine ebaõnnestus.')
        })
        ready = reprojected
      }
      checkInEstonia((await ogrinfo(ready))[0].extent)

      await mkdir(historyDir, { recursive: true })
      const backup = join(historyDir, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.gpkg`)
      await copyFile(sourceFile(id), backup)
      await rename(ready, sourceFile(id))
      try {
        await rebuild()
      } catch (err) {
        await copyFile(backup, uploaded)
        await rename(uploaded, sourceFile(id))
        await rebuild().catch(() => {})
        throw err
      }
    } finally {
      await rm(uploaded, { force: true })
      await rm(reprojected, { force: true })
    }
  }

  const router = Router()
  router.use(requireAuth(sessions))

  router.get('/', async (_req, res) => {
    res.json(
      await Promise.all(
        LAYERS.map(async ({ id, label }) => ({ id, label, updatedAt: (await stat(sourceFile(id))).mtime.toISOString() })),
      ),
    )
  })

  router.get('/:id.gpkg', async (req, res) => {
    const layer = LAYERS.find((l) => l.id === req.params.id)
    if (!layer) {
      res.status(404).json({ error: 'Tundmatu kiht' })
      return
    }
    res.set('Cache-Control', 'no-store')
    const { mtime } = await stat(sourceFile(layer.id))
    res.download(sourceFile(layer.id), `${layer.label}_${fileTimestamp(mtime)}.gpkg`)
  })

  router.post('/:id', express.raw({ type: () => true, limit: MAX_UPLOAD }), async (req, res) => {
    const layer = LAYERS.find((l) => l.id === req.params.id)
    if (!layer) {
      res.status(404).json({ error: 'Tundmatu kiht' })
      return
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Fail puudub.' })
      return
    }
    try {
      await serialized(() => replace(layer.id, layer.geometry, req.body))
      res.json({ id: layer.id, updatedAt: (await stat(sourceFile(layer.id))).mtime.toISOString() })
    } catch (err) {
      if (err instanceof UploadError) {
        res.status(400).json({ error: err.message })
      } else {
        console.error(`Upload of ${layer.id} failed:`, err)
        res.status(500).json({ error: 'Üleslaadimine ebaõnnestus. Vana fail jäi alles.' })
      }
    }
  })

  return router
}
