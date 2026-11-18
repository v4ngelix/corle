import { setWorkerUrl } from 'maplibre-gl'
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw'

// Vite rewrites the worker's dynamic imports via /@vite/client, which breaks
// inside a worker. Loading it from a Blob bypasses Vite's transform.
setWorkerUrl(
  URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })),
)
