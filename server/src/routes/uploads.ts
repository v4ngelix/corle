import express, { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { requireAuth, type Sessions } from '../auth.ts'
import { abandonedUploads, deleteUpload, getUpload, insertUpload } from '../db.ts'
import { readDxf } from '../dxf.ts'
import { handled, UploadError } from '../validate.ts'

const MAX_UPLOAD = '50mb'
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

function parseFilename(value: unknown): string {
  const name = typeof value === 'string' ? basename(value.replaceAll('\\', '/')).trim() : ''
  if (!name) throw new UploadError('Faili nimi puudub.')
  if (!/\.dxf$/i.test(name)) throw new UploadError('Lubatud on ainult DXF-failid (.dxf).')
  if (name.length > 255) throw new UploadError('Faili nimi on liiga pikk.')
  return name
}

/** DXF upload with a per-layer preview, and download of the original file. All routes need a login. */
export function uploads(db: DatabaseSync, dataDir: string, sessions: Sessions) {
  const dir = join(dataDir, 'uploads')
  const router = Router()
  router.use(requireAuth(sessions))

  async function removeAbandoned(): Promise<void> {
    for (const upload of abandonedUploads(db, new Date(Date.now() - ABANDONED_AFTER_MS))) {
      deleteUpload(db, upload.id)
      await rm(join(dataDir, upload.storedPath), { force: true })
    }
  }

  router.post(
    '/',
    express.raw({ type: () => true, limit: MAX_UPLOAD }),
    handled(async (req, res) => {
      const filename = parseFilename(req.query.filename)
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new UploadError('Fail puudub.')

      await mkdir(dir, { recursive: true })
      const tmp = join(dir, `.${randomUUID()}.tmp`)
      try {
        await writeFile(tmp, req.body)
        const { layers, ignored } = await readDxf(tmp)
        const upload = insertUpload(db, filename)
        await rename(tmp, join(dataDir, upload.storedPath))
        await removeAbandoned()
        res.json({
          uploadId: upload.id,
          filename,
          layers: layers.map(({ name, lines, lengthM, swapped, inEstonia, wgs }) => ({
            name,
            lines,
            lengthM,
            swapped,
            inEstonia,
            geometry: wgs,
          })),
          ignored,
        })
      } finally {
        await rm(tmp, { force: true })
      }
    }),
  )

  router.get('/:id/file', (req, res) => {
    const upload = getUpload(db, Number(req.params.id))
    if (!upload) {
      res.status(404).json({ error: 'Faili ei leitud.' })
      return
    }
    res.set('Cache-Control', 'no-store')
    res.download(join(dataDir, upload.storedPath), upload.originalFilename, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Faili ei leitud.' })
    })
  })

  return router
}
