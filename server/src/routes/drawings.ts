import { Router } from 'express'
import { notImplemented } from './notImplemented.ts'

export const drawings = Router()

drawings.get('/drawings.geojson', notImplemented)
drawings.get('/drawings', notImplemented)
drawings.post('/drawings', notImplemented)
drawings.patch('/drawings/:id', notImplemented)
drawings.delete('/drawings/:id', notImplemented)
