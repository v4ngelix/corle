import express, { Router } from 'express'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { requireAuth, type Sessions } from '../auth.ts'
import {
  deleteDrawing,
  deleteUpload,
  type DrawingEdit,
  drawingsGeoJson,
  getDrawing,
  getUpload,
  insertDrawing,
  listDrawings,
  updateDrawing,
  uploadHasDrawing,
} from '../db.ts'
import { mergeLayers, readDxf } from '../dxf.ts'
import { handled, UploadError } from '../validate.ts'

const LOCATIONS = ['underground', 'overhead']
const DATE = /^\d{4}-\d{2}-\d{2}$/

function optionalText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new UploadError(`${label} peab olema tekst.`)
  return value.trim() || null
}

/** Validates the editable fields present in `body`; with `complete`, name and location are required. */
export function parseDrawingEdit(body: unknown, complete: boolean): DrawingEdit {
  if (typeof body !== 'object' || body === null) throw new UploadError('Andmed puuduvad.')
  const input = body as Record<string, unknown>
  const edit: DrawingEdit = {}

  if (complete || 'name' in input) {
    const name = optionalText(input.name, 'Nimi')
    if (!name) throw new UploadError('Nimi on kohustuslik.')
    edit.name = name
  }
  if (complete || 'location' in input) {
    if (!LOCATIONS.includes(input.location as string)) throw new UploadError('Vali asukoht: maa-alune või õhuliin.')
    edit.location = input.location as DrawingEdit['location']
  }
  if ('municipality' in input) edit.municipality = optionalText(input.municipality, 'Omavalitsus')
  if ('settlement' in input) edit.settlement = optionalText(input.settlement, 'Asustusüksus')
  if ('surveyor' in input) edit.surveyor = optionalText(input.surveyor, 'Mõõdistaja')
  if ('surveyedOn' in input) {
    const date = optionalText(input.surveyedOn, 'Mõõdistamise kuupäev')
    if (date && (!DATE.test(date) || Number.isNaN(Date.parse(date)))) {
      throw new UploadError('Mõõdistamise kuupäev peab olema kujul AAAA-KK-PP.')
    }
    edit.surveyedOn = date
  }
  return edit
}

function parseLayers(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new UploadError('Vali vähemalt üks kiht.')
  return value
}

/** Public map GeoJSON, plus the logged-in list, save, edit and delete. */
export function drawings(db: DatabaseSync, dataDir: string, sessions: Sessions) {
  const router = Router()
  const auth = requireAuth(sessions)
  const json = express.json()

  router.get('/drawings.geojson', (_req, res) => {
    res.set('Cache-Control', 'no-cache').type('application/geo+json').send(drawingsGeoJson(db))
  })

  router.get('/drawings', auth, (_req, res) => {
    res.set('Cache-Control', 'no-store').json(listDrawings(db))
  })

  router.post(
    '/drawings',
    auth,
    json,
    handled(async (req, res) => {
      const edit = parseDrawingEdit(req.body, true)
      const layers = parseLayers(req.body.layers)
      const upload = getUpload(db, Number(req.body.uploadId))
      if (!upload) {
        res.status(404).json({ error: 'Üleslaaditud faili ei leitud. Laadi see uuesti üles.' })
        return
      }
      if (uploadHasDrawing(db, upload.id)) {
        res.status(409).json({ error: 'See fail on juba salvestatud.' })
        return
      }
      const { lest, wgs, lengthM } = mergeLayers(await readDxf(join(dataDir, upload.storedPath)), layers)
      const id = insertDrawing(db, {
        name: edit.name!,
        location: edit.location!,
        municipality: edit.municipality ?? null,
        settlement: edit.settlement ?? null,
        surveyor: edit.surveyor ?? null,
        surveyedOn: edit.surveyedOn ?? null,
        accuracyClass: null,
        attrs: { DXF_LAYERS: [...new Set(layers)] },
        uploadId: upload.id,
        geomLest: JSON.stringify(lest),
        geomWgs: JSON.stringify(wgs),
        lengthM,
      })
      res.status(201).json(getDrawing(db, id))
    }),
  )

  router.patch(
    '/drawings/:id',
    auth,
    json,
    handled((req, res) => {
      const id = Number(req.params.id)
      if (!updateDrawing(db, id, parseDrawingEdit(req.body, false))) {
        res.status(404).json({ error: 'Joonist ei leitud.' })
        return
      }
      res.json(getDrawing(db, id))
    }),
  )

  router.delete(
    '/drawings/:id',
    auth,
    handled(async (req, res) => {
      const uploadId = deleteDrawing(db, Number(req.params.id))
      if (uploadId === undefined) {
        res.status(404).json({ error: 'Joonist ei leitud.' })
        return
      }
      const upload = uploadId === null ? undefined : getUpload(db, uploadId)
      if (upload && !uploadHasDrawing(db, upload.id)) {
        deleteUpload(db, upload.id)
        await rm(join(dataDir, upload.storedPath), { force: true })
      }
      res.status(204).end()
    }),
  )

  return router
}
