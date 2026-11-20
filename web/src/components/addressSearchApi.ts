import { ADDRESS_SEARCH } from '../config'

export interface AddressSuggestion {
  label: string
  lngLat: [number, number]
  // Building/parcel outline as [lng, lat] pairs, when IN-ADS returns one.
  extent: [number, number][] | null
}

interface InAdsAddress {
  ipikkaadress?: string
  pikkaadress?: string
  aadresstekst?: string
  viitepunkt_l?: string
  viitepunkt_b?: string
  g_boundingbox?: string
}

// g_boundingbox: "lat,lng lat,lng ..."
function parseExtent(value: string | undefined): [number, number][] | null {
  if (!value) return null
  const ring = value.trim().split(/\s+/).map((pair) => {
    const [lat, lng] = pair.split(',').map(Number)
    return [lng, lat] as [number, number]
  })
  return ring.length >= 4 && ring.every((p) => p.every(Number.isFinite)) ? ring : null
}

function toSuggestion(address: InAdsAddress): AddressSuggestion | null {
  const lng = Number(address.viitepunkt_l)
  const lat = Number(address.viitepunkt_b)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null

  return {
    label: address.ipikkaadress || address.pikkaadress || address.aadresstekst || '',
    lngLat: [lng, lat],
    extent: parseExtent(address.g_boundingbox),
  }
}

export async function searchAddresses(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    address: query,
    results: String(ADDRESS_SEARCH.resultLimit),
    appartment: '1',
    ihist: '0',
    unik: '1',
  })
  const response = await fetch(`${ADDRESS_SEARCH.url}?${params}`, { signal })
  if (!response.ok) throw new Error(`Aadressiotsing: ${response.status}`)

  const data: { addresses?: InAdsAddress[] } = await response.json()
  return (data.addresses ?? []).map(toSuggestion).filter((s): s is AddressSuggestion => s !== null)
}
