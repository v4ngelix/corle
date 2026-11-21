import express from 'express'
import { join } from 'node:path'
import { Sessions } from './auth.ts'
import { auth } from './routes/auth.ts'
import { drawings } from './routes/drawings.ts'
import { elasa, type ElasaOptions } from './routes/elasa.ts'
import { layerFiles } from './routes/layerFiles.ts'
import { layers } from './routes/layers.ts'
import { uploads } from './routes/uploads.ts'

export interface AppOptions {
  dataDir: string
  /** Shared login password. Unset → nobody can log in. */
  adminPassword?: string
  elasa?: ElasaOptions
}

export function buildApp({ dataDir, adminPassword, elasa: elasaOptions }: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  const sessions = new Sessions()

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api', drawings)
  app.use('/api/elasa', elasa(elasaOptions))
  app.use('/api/auth', auth(sessions, adminPassword))
  app.use('/api/layers', layerFiles(dataDir, sessions))
  app.use('/api/uploads', uploads)
  app.use('/layers', layers(join(dataDir, 'layers')))

  return app
}
