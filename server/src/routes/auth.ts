import { Router } from 'express'
import { notImplemented } from './notImplemented.ts'

export const auth = Router()

auth.post('/login', notImplemented)
auth.post('/logout', notImplemented)
auth.get('/me', notImplemented)
