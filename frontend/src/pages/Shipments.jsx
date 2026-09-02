import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { shipmentsApi, stationsApi } from '../api/endpoints'

const TRANSPORT_MODES = ['ship', 'aircraft', 'helicopter', 'snow_vehicle', 'sledge']
const SHIPMENT_STATUSES = ['planned', 'dispatched', 'in_transit', 'delayed', 'arrived', 'cancelled']

const EMPTY_SHIPMENT = { shipment_code: '', origin_station_id: '', destination_station_id: '', transport_mode: 'ship', planned_departure: '', planned_arrival: '' }

export default function Shipments() {
  const [shipments, setShipments] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SHIPMENT)
  const [error, setError] = useState('')
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [tracking, setTracking] = useState([])
  const [trackForm, setTrackForm] = useState({ latitude: '', longitude: '', ambient_temp_c: '' })

  const load = async () => {
    setLoading(true)
    const [shipRes, stationRes] = await Promise.all([shipmentsApi.list(), stationsApi.list()])
    setShipments(shipRes.data)
    setStations(stationRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const stationName = (id) => stations.find((s) => s.station_id === id)?.name || id

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      if (!payload.planned_departure) delete payload.planned_departure
      if (!payload.planned_arrival) delete payload.planned_arrival
      await shipmentsApi.create(payload)
      setShowModal(false)
      setForm(EMPTY_SHIPMENT)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create shipment')
    }
  }

  const handleStatusChange = async (shipmentId, status) => {
    await shipmentsApi.update(shipmentId, { status })
    load()
  }

  const openTracking = async (shipment) => {
    setSelectedShipment(shipment)
    const { data } = await shipmentsApi.getTracking(shipment.shipment_id)
    setTracking(data)
  }

  const handleAddTracking = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await shipmentsApi.addTracking({
        shipment_id: selectedShipment.shipment_id,
        latitude: parseFloat(trackForm.latitude),
        longitude: parseFloat(trackForm.longitude),
        ambient_temp_c: trackForm.ambient_temp_c ? parseFloat(trackForm.ambient_temp_c) : undefined,
      })
      setTrackForm({ latitude: '', longitude: '', ambient_temp_c: '' })
      const { data } = await shipmentsApi.getTracking(selectedShipment.shipment_id)
      setTracking(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not log tracking point')
    }
  }

  return (
    <>
      <PageHeader
        title="Shipments & Tracking"
        subtitle="Inter-station transport, live telemetry, and official manifests"
        actions={
          <div className="flex gap-8">
            <Link to="/map" className="btn btn-secondary btn-sm">🗺️ Polar Map</Link>
            <Link to="/reports" className="btn btn-secondary btn-sm">📄 Reports</Link>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ New shipment</button>
          </div>
        }
      />
      <div className="page-content">
        <div className="panel">
          <div className="table-wrap">
            {loading ? (
              <div className="flex items-center justify-between" style={{ justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : shipments.length === 0 ? (
              <div className="empty-state"><div className="icon">◌</div>No shipments recorded yet</div>
            ) : (
              <table>
                <thead><tr><th>Code</th><th>Route</th><th>Mode</th><th>Status</th><th>Planned departure</th><th>Actions</th></tr></thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr key={s.shipment_id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{s.shipment_code}</td>
                      <td className="text-faint">{stationName(s.origin_station_id)} → {stationName(s.destination_station_id)}</td>
                      <td className="text-faint">{s.transport_mode.replace(/_/g, ' ')}</td>
                      <td>
                        <select value={s.status} onChange={(e) => handleStatusChange(s.shipment_id, e.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--frost)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}>
                          {SHIPMENT_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td className="text-faint text-sm">{s.planned_departure ? new Date(s.planned_departure).toLocaleString() : '—'}</td>
                      <td>
                        <div className="flex gap-6">
                          <button className="btn btn-secondary btn-sm" onClick={() => openTracking(s)}>GPS Track</button>
                          <Link to="/reports" className="btn btn-secondary btn-sm" title="View Manifest">Manifest</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>


      {showModal && (
        <Modal title="New shipment" onClose={() => setShowModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="field"><label>Shipment code</label>
              <input value={form.shipment_code} onChange={(e) => setForm((f) => ({ ...f, shipment_code: e.target.value }))} placeholder="SHP-2027-014" required />
            </div>
            <div className="field"><label>Origin station</label>
              <select value={form.origin_station_id} onChange={(e) => setForm((f) => ({ ...f, origin_station_id: e.target.value }))} required>
                <option value="">Select…</option>
                {stations.map((s) => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Destination station</label>
              <select value={form.destination_station_id} onChange={(e) => setForm((f) => ({ ...f, destination_station_id: e.target.value }))} required>
                <option value="">Select…</option>
                {stations.map((s) => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Transport mode</label>
              <select value={form.transport_mode} onChange={(e) => setForm((f) => ({ ...f, transport_mode: e.target.value }))}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Planned departure</label>
                <input type="datetime-local" value={form.planned_departure} onChange={(e) => setForm((f) => ({ ...f, planned_departure: e.target.value }))} />
              </div>
              <div className="field"><label>Planned arrival</label>
                <input type="datetime-local" value={form.planned_arrival} onChange={(e) => setForm((f) => ({ ...f, planned_arrival: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create shipment</button>
          </form>
        </Modal>
      )}

      {selectedShipment && (
        <Modal title={`Tracking — ${selectedShipment.shipment_code}`} onClose={() => setSelectedShipment(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleAddTracking} className="mt-8" style={{ marginBottom: 18 }}>
            <div className="grid grid-3">
              <div className="field"><label>Lat</label>
                <input type="number" step="any" value={trackForm.latitude} onChange={(e) => setTrackForm((f) => ({ ...f, latitude: e.target.value }))} required />
              </div>
              <div className="field"><label>Lng</label>
                <input type="number" step="any" value={trackForm.longitude} onChange={(e) => setTrackForm((f) => ({ ...f, longitude: e.target.value }))} required />
              </div>
              <div className="field"><label>Temp °C</label>
                <input type="number" step="any" value={trackForm.ambient_temp_c} onChange={(e) => setTrackForm((f) => ({ ...f, ambient_temp_c: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" type="submit">Log position</button>
          </form>

          <div className="text-faint text-sm" style={{ marginBottom: 8 }}>Recent positions</div>
          {tracking.length === 0 ? (
            <div className="text-faint text-sm">No positions logged yet</div>
          ) : (
            <table>
              <thead><tr><th>Time</th><th>Lat</th><th>Lng</th><th>Temp</th></tr></thead>
              <tbody>
                {tracking.map((p) => (
                  <tr key={p.tracking_id}>
                    <td className="text-sm">{new Date(p.recorded_at).toLocaleString()}</td>
                    <td className="mono text-sm">{Number(p.latitude).toFixed(4)}</td>
                    <td className="mono text-sm">{Number(p.longitude).toFixed(4)}</td>
                    <td className="mono text-sm">{p.ambient_temp_c ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  )
}
