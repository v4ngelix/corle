import { DatabaseSync } from 'node:sqlite'
import type { DrawingFields, DrawingLocation } from './kpo.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawings (
  id INTEGER PRIMARY KEY,
  upload_id INTEGER REFERENCES uploads(id),
  name TEXT NOT NULL,
  municipality TEXT,
  settlement TEXT,
  location TEXT NOT NULL CHECK (location IN ('underground', 'overhead')),
  surveyor TEXT,
  surveyed_on TEXT,
  accuracy_class REAL,
  attrs TEXT NOT NULL DEFAULT '{}',
  geom_lest TEXT NOT NULL,
  geom_wgs TEXT NOT NULL,
  length_m REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  db.exec(SCHEMA)
  return db
}

export function transaction(db: DatabaseSync, fn: () => void): void {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export interface NewDrawing extends DrawingFields {
  uploadId: number | null
  /** GeoJSON geometry in EPSG:3301. */
  geomLest: string
  /** GeoJSON geometry in EPSG:4326. */
  geomWgs: string
  lengthM: number
}

export function insertDrawing(db: DatabaseSync, d: NewDrawing): number {
  const now = new Date().toISOString()
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO drawings (upload_id, name, municipality, settlement, location, surveyor, surveyed_on,
         accuracy_class, attrs, geom_lest, geom_wgs, length_m, created_at, updated_at)
       VALUES (:upload_id, :name, :municipality, :settlement, :location, :surveyor, :surveyed_on,
         :accuracy_class, :attrs, :geom_lest, :geom_wgs, :length_m, :now, :now)`,
    )
    .run({
      upload_id: d.uploadId,
      name: d.name,
      municipality: d.municipality,
      settlement: d.settlement,
      location: d.location,
      surveyor: d.surveyor,
      surveyed_on: d.surveyedOn,
      accuracy_class: d.accuracyClass,
      attrs: JSON.stringify(d.attrs),
      geom_lest: d.geomLest,
      geom_wgs: d.geomWgs,
      length_m: d.lengthM,
      now,
    })
  return Number(lastInsertRowid)
}

export function countDrawings(db: DatabaseSync): number {
  return (db.prepare('SELECT count(*) AS n FROM drawings').get() as { n: number }).n
}

/** All drawings for the public map: geometry and location only. Built from the stored strings, no parsing. */
export function drawingsGeoJson(db: DatabaseSync): string {
  const rows = db.prepare('SELECT id, location, geom_wgs FROM drawings ORDER BY id').all() as {
    id: number
    location: string
    geom_wgs: string
  }[]
  const features = rows.map(
    (r) =>
      `{"type":"Feature","id":${r.id},"properties":{"location":${JSON.stringify(r.location)}},"geometry":${r.geom_wgs}}`,
  )
  return `{"type":"FeatureCollection","features":[${features.join(',')}]}`
}

export interface Upload {
  id: number
  originalFilename: string
  /** Relative to the data dir. */
  storedPath: string
  uploadedAt: string
}

/** Inserts an upload row; the file is stored at `uploads/<id>.dxf`. */
export function insertUpload(db: DatabaseSync, originalFilename: string): Upload {
  const uploadedAt = new Date().toISOString()
  let id = 0
  transaction(db, () => {
    id = Number(
      db.prepare(`INSERT INTO uploads (original_filename, stored_path, uploaded_at) VALUES (?, '', ?)`).run(originalFilename, uploadedAt)
        .lastInsertRowid,
    )
    db.prepare('UPDATE uploads SET stored_path = ? WHERE id = ?').run(`uploads/${id}.dxf`, id)
  })
  return { id, originalFilename, storedPath: `uploads/${id}.dxf`, uploadedAt }
}

const UPLOAD_COLUMNS = 'id, original_filename AS originalFilename, stored_path AS storedPath, uploaded_at AS uploadedAt'

export function getUpload(db: DatabaseSync, id: number): Upload | undefined {
  return db.prepare(`SELECT ${UPLOAD_COLUMNS} FROM uploads WHERE id = ?`).get(id) as Upload | undefined
}

export function deleteUpload(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM uploads WHERE id = ?').run(id)
}

export function uploadHasDrawing(db: DatabaseSync, uploadId: number): boolean {
  return db.prepare('SELECT 1 FROM drawings WHERE upload_id = ?').get(uploadId) !== undefined
}

/** A drawing with the same name may exist in the other location (underground/overhead pair). */
export function drawingNameExists(db: DatabaseSync, name: string, location: DrawingLocation): boolean {
  return db.prepare('SELECT 1 FROM drawings WHERE name = ? COLLATE NOCASE AND location = ?').get(name, location) !== undefined
}

/** Uploads older than `before` that never became a drawing: previews nobody saved. */
export function abandonedUploads(db: DatabaseSync, before: Date): Upload[] {
  return db
    .prepare(
      `SELECT ${UPLOAD_COLUMNS} FROM uploads u
       WHERE uploaded_at < ? AND NOT EXISTS (SELECT 1 FROM drawings d WHERE d.upload_id = u.id)`,
    )
    .all(before.toISOString()) as unknown as Upload[]
}

export interface DrawingDetails {
  id: number
  name: string
  municipality: string | null
  settlement: string | null
  location: DrawingLocation
  surveyor: string | null
  surveyedOn: string | null
  accuracyClass: number | null
  lengthM: number
  uploadId: number | null
  originalFilename: string | null
  /** [west, south, east, north] in WGS84. */
  bbox: [number, number, number, number]
  attrs: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function bboxOf(geomWgs: string): DrawingDetails['bbox'] {
  const { coordinates } = JSON.parse(geomWgs) as { coordinates: unknown[] }
  const bbox: DrawingDetails['bbox'] = [Infinity, Infinity, -Infinity, -Infinity]
  const walk = (c: unknown[]) => {
    if (typeof c[0] === 'number') {
      const [x, y] = c as number[]
      bbox[0] = Math.min(bbox[0], x)
      bbox[1] = Math.min(bbox[1], y)
      bbox[2] = Math.max(bbox[2], x)
      bbox[3] = Math.max(bbox[3], y)
    } else for (const child of c) walk(child as unknown[])
  }
  walk(coordinates)
  return bbox
}

const DETAILS_QUERY = `
  SELECT d.id, d.name, d.municipality, d.settlement, d.location, d.surveyor, d.surveyed_on AS surveyedOn,
    d.accuracy_class AS accuracyClass, d.length_m AS lengthM, d.upload_id AS uploadId,
    u.original_filename AS originalFilename, d.attrs, d.geom_wgs AS geomWgs,
    d.created_at AS createdAt, d.updated_at AS updatedAt
  FROM drawings d LEFT JOIN uploads u ON u.id = d.upload_id`

function toDetails({ attrs, geomWgs, ...row }: Record<string, unknown>): DrawingDetails {
  return { ...row, bbox: bboxOf(geomWgs as string), attrs: JSON.parse(attrs as string) } as DrawingDetails
}

/** Every drawing for the management list, without geometry. */
export function listDrawings(db: DatabaseSync): DrawingDetails[] {
  return db.prepare(`${DETAILS_QUERY} ORDER BY d.name COLLATE NOCASE, d.id`).all().map((row) => toDetails(row as Record<string, unknown>))
}

export function getDrawing(db: DatabaseSync, id: number): DrawingDetails | undefined {
  const row = db.prepare(`${DETAILS_QUERY} WHERE d.id = ?`).get(id)
  return row && toDetails(row as Record<string, unknown>)
}

export interface DrawingEdit {
  name?: string
  municipality?: string | null
  settlement?: string | null
  location?: DrawingLocation
  surveyor?: string | null
  surveyedOn?: string | null
}

const EDIT_COLUMNS: Record<keyof DrawingEdit, string> = {
  name: 'name',
  municipality: 'municipality',
  settlement: 'settlement',
  location: 'location',
  surveyor: 'surveyor',
  surveyedOn: 'surveyed_on',
}

/** Returns false if there is no such drawing. */
export function updateDrawing(db: DatabaseSync, id: number, edit: DrawingEdit): boolean {
  const keys = (Object.keys(edit) as (keyof DrawingEdit)[]).filter((k) => k in EDIT_COLUMNS)
  const sets = [...keys.map((k) => `${EDIT_COLUMNS[k]} = :${k}`), 'updated_at = :updatedAt']
  const params = Object.fromEntries(keys.map((k) => [k, edit[k] ?? null]))
  const { changes } = db
    .prepare(`UPDATE drawings SET ${sets.join(', ')} WHERE id = :id`)
    .run({ ...params, updatedAt: new Date().toISOString(), id })
  return changes > 0
}

/** Deletes the drawing; returns its upload id (null for imported drawings), or undefined if there was none. */
export function deleteDrawing(db: DatabaseSync, id: number): number | null | undefined {
  const row = db.prepare('DELETE FROM drawings WHERE id = ? RETURNING upload_id AS uploadId').get(id) as
    | { uploadId: number | null }
    | undefined
  return row?.uploadId
}
