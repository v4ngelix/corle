import type { RequestHandler } from 'express'

/** A problem with the user's file or input: answered with 400 and this (Estonian) message. */
export class UploadError extends Error {}

/** L-EST97 box around Estonia, from the old tile grid (PLAN.md §5). */
const ESTONIA = { minE: 300_000, maxE: 800_000, minN: 6_300_000, maxN: 6_700_000 }

export type Extent = [minE: number, minN: number, maxE: number, maxN: number]

export function inEstonia([minE, minN, maxE, maxN]: Extent): boolean {
  return minE >= ESTONIA.minE && maxE <= ESTONIA.maxE && minN >= ESTONIA.minN && maxN <= ESTONIA.maxN
}

export function checkInEstonia(extent: Extent | undefined): void {
  if (!extent) throw new UploadError('Kihi ulatust ei õnnestunud lugeda.')
  if (!inEstonia(extent)) throw new UploadError('Andmed jäävad Eestist välja. Kontrolli koordinaatsüsteemi.')
}

/** Turns `UploadError` into 400, anything else into a logged 500. */
export function handled(work: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await work(req, res, next)
    } catch (err) {
      if (err instanceof UploadError) {
        res.status(400).json({ error: err.message })
      } else {
        console.error(`${req.method} ${req.originalUrl} failed:`, err)
        res.status(500).json({ error: 'Serveri viga.' })
      }
    }
  }
}
