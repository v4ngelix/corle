import express from 'express'
import { join } from 'node:path'
import { Sessions } from './auth.ts'
import { openDb } from './db.ts'
import { auth } from './routes/auth.ts'
import { drawings } from './routes/drawings.ts'
import { elasa, type ElasaOptions } from './routes/elasa.ts'
import { layerFiles } from './routes/layerFiles.ts'
import { layers } from './routes/layers.ts'
import { uploads } from './routes/uploads.ts'

export interface AppOptions {
  dataDir: string
  adminPassword?: string
  elasa?: ElasaOptions
  webDir?: string
}

export function buildApp({ dataDir, adminPassword, elasa: elasaOptions, webDir }: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  const sessions = new Sessions()
  const db = openDb(join(dataDir, 'corle.sqlite'))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api', drawings(db, dataDir, sessions))
  app.use('/api/elasa', elasa(elasaOptions))
  app.use('/api/auth', auth(sessions, adminPassword))
  app.use('/api/layers', layerFiles(dataDir, sessions))
  app.use('/api/uploads', uploads(db, dataDir, sessions))
  app.use('/layers', layers(join(dataDir, 'layers')))
  if (webDir) app.use(express.static(webDir))

  return app
}
