import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { drawingsGeoJson } from '../db.ts'
import { notImplemented } from './notImplemented.ts'

export function drawings(db: DatabaseSync) {
  const router = Router()

  router.get('/drawings.geojson', (_req, res) => {
    res.set('Cache-Control', 'no-cache').type('application/geo+json').send(drawingsGeoJson(db))
  })
  router.get('/drawings', notImplemented)
  router.post('/drawings', notImplemented)
  router.patch('/drawings/:id', notImplemented)
  router.delete('/drawings/:id', notImplemented)

  return router
}
