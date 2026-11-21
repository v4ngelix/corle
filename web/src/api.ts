/** Backend calls. Errors carry the server's (Estonian) message, ready to show. */

export interface LayerFile {
  id: string
  label: string
  updatedAt: string
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 413) return 'Fail on liiga suur.'
  try {
    const { error } = (await res.json()) as { error?: string }
    if (error) return error
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return `Viga (${res.status}).`
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', ...init })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res
}

export async function isLoggedIn(): Promise<boolean> {
  return (await fetch('/api/auth/me', { credentials: 'same-origin' })).ok
}

export async function login(password: string): Promise<void> {
  await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' })
}

export async function listLayerFiles(): Promise<LayerFile[]> {
  return (await request('/api/layers')).json()
}

export function layerFileUrl(id: string): string {
  return `/api/layers/${encodeURIComponent(id)}.gpkg`
}

export async function uploadLayerFile(id: string, file: File): Promise<void> {
  await request(`/api/layers/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
}

export type DrawingLocation = 'underground' | 'overhead'

export interface Drawing {
  id: number
  name: string
  municipality: string | null
  settlement: string | null
  location: DrawingLocation
  surveyor: string | null
  surveyedOn: string | null
  accuracyClass: number | null
  lengthM: number
  uploadId: number | null
  originalFilename: string | null
  /** [west, south, east, north] */
  bbox: [number, number, number, number]
  attrs: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** The fields edited in the form. Empty strings are stored as null. */
export interface DrawingForm {
  name: string
  municipality: string
  settlement: string
  location: DrawingLocation | ''
  surveyor: string
  surveyedOn: string
}

export interface MultiLineString {
  type: 'MultiLineString'
  coordinates: number[][][]
}

export interface PreviewLayer {
  name: string
  lines: number
  lengthM: number
  swapped: boolean
  inEstonia: boolean
  geometry: MultiLineString
}

export interface UploadPreview {
  uploadId: number
  filename: string
  layers: PreviewLayer[]
  ignored: { points: number; polygons: number; other: number }
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function listDrawings(): Promise<Drawing[]> {
  return (await request('/api/drawings')).json()
}

export async function uploadDxf(file: File): Promise<UploadPreview> {
  const res = await request(`/api/uploads?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
  return res.json()
}

export async function saveDrawing(uploadId: number, layers: string[], form: DrawingForm): Promise<Drawing> {
  return (await request('/api/drawings', sendJson('POST', { uploadId, layers, ...form }))).json()
}

export async function updateDrawing(id: number, form: DrawingForm): Promise<Drawing> {
  return (await request(`/api/drawings/${id}`, sendJson('PATCH', form))).json()
}

export async function deleteDrawing(id: number): Promise<void> {
  await request(`/api/drawings/${id}`, { method: 'DELETE' })
}

export function uploadFileUrl(uploadId: number): string {
  return `/api/uploads/${uploadId}/file`
}
