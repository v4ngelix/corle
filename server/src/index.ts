import { resolve } from 'node:path'
import { buildApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'
const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dirname}/../../data`)

buildApp({ dataDir }).listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`)
})
