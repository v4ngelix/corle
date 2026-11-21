import { Router } from 'express'
import { notImplemented } from './notImplemented.ts'

export const layers = Router()

layers.get('/:name.geojson', notImplemented)
