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
