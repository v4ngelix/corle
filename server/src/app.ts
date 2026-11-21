import express from 'express'
import { join } from 'node:path'
import { auth } from './routes/auth.ts'
import { drawings } from './routes/drawings.ts'
import { layers } from './routes/layers.ts'
import { uploads } from './routes/uploads.ts'

export interface AppOptions {
  dataDir: string
}

export function buildApp({ dataDir }: AppOptions) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api', drawings)
  app.use('/api/auth', auth)
  app.use('/api/uploads', uploads)
  app.use('/layers', layers(join(dataDir, 'layers')))

  return app
}
