import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { CookieOptions, Request, RequestHandler } from 'express'

export const SESSION_COOKIE = 'corle_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS,
  path: '/',
}

/** In-memory sessions: a restart logs everyone out. */
export class Sessions {
  private readonly expiresAt = new Map<string, number>()

  create(): string {
    const token = randomBytes(32).toString('base64url')
    this.expiresAt.set(token, Date.now() + SESSION_TTL_MS)
    return token
  }

  isValid(token: string | undefined): boolean {
    if (!token) return false
    const expires = this.expiresAt.get(token)
    if (expires === undefined) return false
    if (expires < Date.now()) {
      this.expiresAt.delete(token)
      return false
    }
    return true
  }

  delete(token: string | undefined): void {
    if (token) this.expiresAt.delete(token)
  }
}

export function sessionToken(req: Request): string | undefined {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [name, ...value] = part.trim().split('=')
    if (name === SESSION_COOKIE) return value.join('=')
  }
  return undefined
}

/** Constant-time compare; hashing first makes both sides the same length. */
export function passwordMatches(given: string, expected: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(hash(given), hash(expected))
}

export function requireAuth(sessions: Sessions): RequestHandler {
  return (req, res, next) => {
    if (sessions.isValid(sessionToken(req))) next()
    else res.status(401).json({ error: 'Sisselogimine on vajalik' })
  }
}
