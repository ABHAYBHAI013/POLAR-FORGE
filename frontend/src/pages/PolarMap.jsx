import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import MapWidget from '../components/MapWidget'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { stationsApi, shipmentsApi } from '../api/endpoints'

export default function PolarMap() {
  const [stations, setStations] = useState([])
  const [shipments, setShipments] = useState([])
  const [tracking, setTracking] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedStation, setSelectedStation] = useState(null)
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showTrackModal, setShowTrackModal] = useState(false)
  const [trackForm, setTrackForm] = useState({ shipment_id: '', latitude: '', longitude: '', ambient_temp_c: '-28.0' })
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [stResult, shpResult] = await Promise.all([stationsApi.list(), shipmentsApi.list()])
      setStations(stResult.data)
      setShipments(shpResult.data)

      const trackMap = {}
      for (const s of shpResult.data) {
        try {
          const { data: tracks } = await shipmentsApi.getTracking(s.shipment_id)
          trackMap[s.shipment_id] = tracks
        } catch (e) {}
      }
      setTracking(trackMap)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleLogTracking = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await shipmentsApi.addTracking({
        shipment_id: trackForm.shipment_id,
        latitude: parseFloat(trackForm.latitude),
        longitude: parseFloat(trackForm.longitude),
        ambient_temp_c: trackForm.ambient_temp_c ? parseFloat(trackForm.ambient_temp_c) : undefined,
      })
      setShowTrackModal(false)
      setTrackForm({ shipment_id: '', latitude: '', longitude: '', ambient_temp_c: '-28.0' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not log telemetry point')
    }
  }

  const stationName = (id) => stations.find((s) => s.station_id === id)?.name || id

  return (
    <>
      <PageHeader
        title="Polar Map & Telemetry"
        subtitle="Interactive Antarctic & Arctic stations, convoy tracks, and live weather/hazard overlays"
        actions={
          <div className="flex gap-8">
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
            >
              ↻ Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowTrackModal(true)}
            >
              + Log Position Track
            </button>
          </div>
        }
      />

      <div className="page-content">
        <div className="grid" style={{ gridTemplateColumns: '1fr 330px', gap: 20 }}>
          <div className="flex-col" style={{ gap: 16 }}>
            <MapWidget
              stations={stations}
              shipments={shipments}
              activeTracking={tracking}
              height="580px"
              onSelectStation={(st) => setSelectedStation(st)}
              onSelectShipment={(shp) => setSelectedShipment(shp)}
            />

            <div className="panel">
              <div className="panel-header">
                <h3>Polar Environmental & Hazard Intelligence</h3>
              </div>
              <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ color: '#f4614b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🌪️ Blizzard Corridors
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--frost-faint)', marginTop: 4 }}>
                    Larsemann & Schirmacher Coast. Warning: 85km/h winds; all aircraft fuel lines warmed.
                  </div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ color: '#f4b860', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠️ Crevasse Fault Zones
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--frost-faint)', marginTop: 4 }}>
                    Queen Maud Land shelf. Snowcat convoys required to use GPS waypoint prevetted tracks.
                  </div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ color: '#7fd8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧊 Fast-Ice & Pack Ice
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--frost-faint)', marginTop: 4 }}>
                    Sea-ice navigable only for Polar icebreakers (Ivan Papanin class) with heli-escort.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-col" style={{ gap: 16 }}>
            <div className="panel">
              <div className="panel-header">
                <h3>Polar Base Stations</h3>
                <span className="badge badge-ice">{stations.length}</span>
              </div>
              <div style={{ maxHeight: 250, overflowY: 'auto', padding: 8 }}>
                {stations.map((s) => (
                  <div
                    key={s.station_id}
                    onClick={() => setSelectedStation(s)}
                    style={{
                      padding: '8px 10px',
                      marginBottom: 4,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: selectedStation?.station_id === s.station_id ? 'var(--bg-panel-hover)' : 'transparent',
                      border: '1px solid',
                      borderColor: selectedStation?.station_id === s.station_id ? 'var(--ice)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--frost-faint)', marginTop: 2 }}>
                      <span className="mono">{s.code}</span>
                      <span className="mono">{s.latitude?.toFixed(3)}°, {s.longitude?.toFixed(3)}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Active Convoys & Transit</h3>
                <span className="badge badge-ice">{shipments.filter((s) => s.status === 'in_transit').length} active</span>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto', padding: 8 }}>
                {shipments.length === 0 ? (
                  <div className="text-faint text-sm" style={{ padding: 8 }}>No convoys found</div>
                ) : (
                  shipments.map((s) => {
                    const isActive = s.status === 'in_transit'
                    return (
                      <div
                        key={s.shipment_id}
                        onClick={() => setSelectedShipment(s)}
                        style={{
                          padding: '8px 10px',
                          marginBottom: 8,
                          borderRadius: 6,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${isActive ? 'var(--ice)' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="mono" style={{ fontWeight: 600, color: 'var(--ice)' }}>{s.shipment_code}</span>
                          <Badge value={s.status} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--frost-dim)', marginTop: 4 }}>
                          {stationName(s.origin_station_id)} → {stationName(s.destination_station_id)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--frost-faint)', marginTop: 2, textTransform: 'capitalize' }}>
                          Mode: {s.transport_mode.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTrackModal && (
        <Modal title="Log Live GPS Telemetry" onClose={() => setShowTrackModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleLogTracking}>
            <div className="field">
              <label>Shipment Convoy</label>
              <select
                value={trackForm.shipment_id}
                onChange={(e) => setTrackForm((f) => ({ ...f, shipment_id: e.target.value }))}
                required
              >
                <option value="">Select active shipment…</option>
                {shipments.map((s) => (
                  <option key={s.shipment_id} value={s.shipment_id}>
                    {s.shipment_code} ({s.transport_mode}) — {stationName(s.origin_station_id)} → {stationName(s.destination_station_id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={trackForm.latitude}
                  onChange={(e) => setTrackForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="e.g. -70.1250"
                  required
                />
              </div>
              <div className="field">
                <label>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={trackForm.longitude}
                  onChange={(e) => setTrackForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="e.g. 51.4200"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Ambient Polar Temperature (°C)</label>
              <input
                type="number"
                step="any"
                value={trackForm.ambient_temp_c}
                onChange={(e) => setTrackForm((f) => ({ ...f, ambient_temp_c: e.target.value }))}
                placeholder="e.g. -35.0"
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
              Broadcast GPS Waypoint
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
