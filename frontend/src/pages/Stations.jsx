import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ColdChainGauge from '../components/ColdChainGauge'
import { stationsApi } from '../api/endpoints'

const STORAGE_CONDITIONS = ['ambient', 'chilled_0_4C', 'frozen_neg18C', 'deep_frozen_neg40C', 'cryogenic', 'hazmat']

const EMPTY_STATION = { code: '', name: '', latitude: '', longitude: '' }
const EMPTY_UNIT = { code: '', name: '', storage_condition: 'chilled_0_4C', target_temp_min_c: '', target_temp_max_c: '' }

export default function Stations() {
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [storageUnits, setStorageUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showStationModal, setShowStationModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [showTempModal, setShowTempModal] = useState(null)
  const [stationForm, setStationForm] = useState(EMPTY_STATION)
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT)
  const [tempReading, setTempReading] = useState('')
  const [error, setError] = useState('')

  const loadStations = async () => {
    setLoading(true)
    const { data } = await stationsApi.list()
    setStations(data)
    if (!selectedStation && data.length > 0) setSelectedStation(data[0].station_id)
    setLoading(false)
  }

  const loadStorageUnits = async (stationId) => {
    if (!stationId) return
    const { data } = await stationsApi.listStorageUnits(stationId)
    setStorageUnits(data)
  }

  useEffect(() => { loadStations() }, [])
  useEffect(() => { loadStorageUnits(selectedStation) }, [selectedStation])

  const handleCreateStation = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...stationForm }
      payload.latitude = payload.latitude ? parseFloat(payload.latitude) : undefined
      payload.longitude = payload.longitude ? parseFloat(payload.longitude) : undefined
      await stationsApi.create(payload)
      setShowStationModal(false)
      setStationForm(EMPTY_STATION)
      loadStations()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create station')
    }
  }

  const handleCreateUnit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...unitForm,
        station_id: selectedStation,
        target_temp_min_c: unitForm.target_temp_min_c !== '' ? parseFloat(unitForm.target_temp_min_c) : undefined,
        target_temp_max_c: unitForm.target_temp_max_c !== '' ? parseFloat(unitForm.target_temp_max_c) : undefined,
      }
      await stationsApi.createStorageUnit(payload)
      setShowUnitModal(false)
      setUnitForm(EMPTY_UNIT)
      loadStorageUnits(selectedStation)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create storage unit')
    }
  }

  const handleLogTemp = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await stationsApi.logTemperature({ storage_unit_id: showTempModal.storage_unit_id, recorded_temp_c: parseFloat(tempReading) })
      setShowTempModal(null)
      setTempReading('')
      loadStorageUnits(selectedStation)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not log reading')
    }
  }

  const currentStation = stations.find((s) => s.station_id === selectedStation)

  return (
    <>
      <PageHeader
        title="Stations & Storage"
        subtitle="Base stations and cold-chain storage capacity"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowStationModal(true)}>+ New station</button>}
      />
      <div className="page-content">
        <div className="grid" style={{ gridTemplateColumns: '260px 1fr', gap: 20 }}>
          <div className="panel">
            <div className="panel-header"><h3>Stations</h3></div>
            <div style={{ padding: 8 }}>
              {loading ? (
                <div className="flex items-center justify-between" style={{ justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>
              ) : stations.map((s) => (
                <div key={s.station_id} onClick={() => setSelectedStation(s.station_id)} className={`nav-link ${selectedStation === s.station_id ? 'active' : ''}`} style={{ marginBottom: 2 }}>
                  <span className="dot" />
                  <div>
                    <div>{s.name}</div>
                    <div className="text-faint text-sm mono">{s.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>{currentStation ? `Storage units — ${currentStation.name}` : 'Select a station'}</h3>
              {currentStation && <button className="btn btn-secondary btn-sm" onClick={() => setShowUnitModal(true)}>+ Add storage unit</button>}
            </div>
            <div className="panel-body">
              {storageUnits.length === 0 ? (
                <div className="empty-state"><div className="icon">❄</div>No storage units at this station yet</div>
              ) : (
                <div className="grid grid-2">
                  {storageUnits.map((u) => (
                    <div key={u.storage_unit_id} className="panel" style={{ padding: 16 }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div className="text-faint text-sm mono">{u.code}</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowTempModal(u)}>Log temp</button>
                      </div>
                      <div className="mt-16">
                        <ColdChainGauge condition={u.storage_condition} currentTemp={u.current_temp_c} targetMin={u.target_temp_min_c} targetMax={u.target_temp_max_c} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showStationModal && (
        <Modal title="New station" onClose={() => setShowStationModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreateStation}>
            <div className="field"><label>Code</label>
              <input value={stationForm.code} onChange={(e) => setStationForm((f) => ({ ...f, code: e.target.value }))} placeholder="BHARATI" required />
            </div>
            <div className="field"><label>Name</label>
              <input value={stationForm.name} onChange={(e) => setStationForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Latitude</label>
                <input type="number" step="any" value={stationForm.latitude} onChange={(e) => setStationForm((f) => ({ ...f, latitude: e.target.value }))} />
              </div>
              <div className="field"><label>Longitude</label>
                <input type="number" step="any" value={stationForm.longitude} onChange={(e) => setStationForm((f) => ({ ...f, longitude: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create station</button>
          </form>
        </Modal>
      )}

      {showUnitModal && (
        <Modal title="New storage unit" onClose={() => setShowUnitModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreateUnit}>
            <div className="field"><label>Code</label>
              <input value={unitForm.code} onChange={(e) => setUnitForm((f) => ({ ...f, code: e.target.value }))} placeholder="COLDROOM-A1" required />
            </div>
            <div className="field"><label>Name</label>
              <input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field"><label>Storage condition</label>
              <select value={unitForm.storage_condition} onChange={(e) => setUnitForm((f) => ({ ...f, storage_condition: e.target.value }))}>
                {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Target min °C</label>
                <input type="number" step="any" value={unitForm.target_temp_min_c} onChange={(e) => setUnitForm((f) => ({ ...f, target_temp_min_c: e.target.value }))} />
              </div>
              <div className="field"><label>Target max °C</label>
                <input type="number" step="any" value={unitForm.target_temp_max_c} onChange={(e) => setUnitForm((f) => ({ ...f, target_temp_max_c: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create storage unit</button>
          </form>
        </Modal>
      )}

      {showTempModal && (
        <Modal title={`Log temperature — ${showTempModal.name}`} onClose={() => setShowTempModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleLogTemp}>
            <div className="field"><label>Reading (°C)</label>
              <input type="number" step="any" value={tempReading} onChange={(e) => setTempReading(e.target.value)} required autoFocus />
            </div>
            <p className="text-faint text-sm">Readings outside the target range automatically raise a critical alert.</p>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Submit reading</button>
          </form>
        </Modal>
      )}
    </>
  )
}
