import { Router } from 'express'
import { notImplemented } from './notImplemented.ts'

export const uploads = Router()

uploads.post('/', notImplemented)
uploads.get('/:id/file', notImplemented)
