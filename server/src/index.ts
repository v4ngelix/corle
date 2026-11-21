import { resolve } from 'node:path'
import { buildApp } from './app.ts'
import { seedDataDir } from './seed.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'
const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dirname}/../../data`)
const webDir = resolve(process.env.WEB_DIR ?? `${import.meta.dirname}/../../web/dist`)
const seedDir = resolve(process.env.SEED_DIR ?? `${import.meta.dirname}/../../seed`)

const adminPassword = process.env.ADMIN_PASSWORD || undefined
if (!adminPassword) console.warn('ADMIN_PASSWORD is not set: login is disabled.')

await seedDataDir(dataDir, seedDir)

buildApp({ dataDir, adminPassword, webDir }).listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`)
})
