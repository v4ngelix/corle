import type { Map as MapLibreMap } from 'maplibre-gl'
import { useCallback, useState } from 'react'
import { AddressSearch } from './components/AddressSearch'
import { DrawingsPanel } from './components/DrawingsPanel'
import { Logo } from './components/Logo'
import { MapView } from './map/MapView'

export default function App() {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [drawingsOpen, setDrawingsOpen] = useState(false)
  const openDrawings = useCallback(() => setDrawingsOpen(true), [])

  return (
    <>
      <MapView onReady={setMap} onLoginChange={setLoggedIn} onOpenDrawings={openDrawings} />
      <div className="map-controls-container">
        <Logo />
        <AddressSearch map={map} />
      </div>
      {map && loggedIn && drawingsOpen && <DrawingsPanel map={map} onClose={() => setDrawingsOpen(false)} />}
    </>
  )
}
