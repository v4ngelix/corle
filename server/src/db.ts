import { DatabaseSync } from 'node:sqlite'
import type { DrawingFields } from './kpo.ts'

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
