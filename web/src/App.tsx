import type { Map as MapLibreMap } from 'maplibre-gl'
import { useState } from 'react'
import { AddressSearch } from './components/AddressSearch'
import { Logo } from './components/Logo'
import { MapView } from './map/MapView'

export default function App() {
  const [map, setMap] = useState<MapLibreMap | null>(null)

  return (
    <>
      <MapView onReady={setMap} />
      <div className="map-controls-container">
        <Logo />
        <AddressSearch map={map} />
      </div>
    </>
  )
}
