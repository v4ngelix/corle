import express, { Router } from 'express'
import { setTimeout } from 'node:timers/promises'
import { passwordMatches, SESSION_COOKIE, sessionCookieOptions, sessionToken, type Sessions } from '../auth.ts'

const FAILED_LOGIN_DELAY_MS = 1000

/** Shared-password login. Stand-in until real user accounts exist (PLAN.md §6.1). */
export function auth(sessions: Sessions, adminPassword: string | undefined) {
  const router = Router()

  router.post('/login', express.json(), async (req, res) => {
    const password: unknown = req.body?.password
    if (!adminPassword || typeof password !== 'string' || !passwordMatches(password, adminPassword)) {
      await setTimeout(FAILED_LOGIN_DELAY_MS)
      res.status(401).json({ error: 'Vale parool' })
      return
    }
    res.cookie(SESSION_COOKIE, sessions.create(), sessionCookieOptions)
    res.status(204).end()
  })

  router.post('/logout', (req, res) => {
    sessions.delete(sessionToken(req))
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined })
    res.status(204).end()
  })

  router.get('/me', (req, res) => {
    res.status(sessions.isValid(sessionToken(req)) ? 204 : 401).end()
  })

  return router
}
