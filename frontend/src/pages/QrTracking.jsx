import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import { qrApi, stationsApi } from '../api/endpoints'

const ENTITY_TYPES = ['asset_batch', 'asset_unit', 'shipment', 'storage_bin']
const SCAN_ACTIONS = ['check_in', 'check_out', 'transfer', 'issue', 'inspection']

export default function QrTracking() {
  const [genForm, setGenForm] = useState({ entity_type: 'asset_batch', entity_id: '' })
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError] = useState('')

  const [scanForm, setScanForm] = useState({ qr_token: '', action: 'check_in', station_id: '' })
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [stations, setStations] = useState([])

  const [historyQuery, setHistoryQuery] = useState({ entity_type: 'asset_batch', entity_id: '' })
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => { stationsApi.list().then(({ data }) => setStations(data)) }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenError('')
    setGenResult(null)
    try {
      const { data } = await qrApi.generate(genForm)
      setGenResult(data)
    } catch (err) {
      setGenError(err.response?.data?.detail || 'Could not generate QR code')
    }
  }

  const handleScan = async (e) => {
    e.preventDefault()
    setScanError('')
    setScanResult(null)
    try {
      const payload = { ...scanForm }
      if (!payload.station_id) delete payload.station_id
      const { data } = await qrApi.scan(payload)
      setScanResult(data)
    } catch (err) {
      setScanError(err.response?.data?.detail || 'Scan failed — check the token')
    }
  }

  const handleHistory = async (e) => {
    e.preventDefault()
    setHistoryError('')
    setHistory(null)
    try {
      const { data } = await qrApi.entityHistory(historyQuery.entity_type, historyQuery.entity_id)
      setHistory(data)
    } catch (err) {
      setHistoryError(err.response?.data?.detail || 'No history found for this entity')
    }
  }

  return (
    <>
      <PageHeader title="QR Scan & Trace" subtitle="Generate codes, log scans, and view full traceability chains" />
      <div className="page-content">
        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-header"><h3>Generate QR code</h3></div>
            <div className="panel-body">
              {genError && <div className="error-banner">{genError}</div>}
              <form onSubmit={handleGenerate}>
                <div className="field"><label>Entity type</label>
                  <select value={genForm.entity_type} onChange={(e) => setGenForm((f) => ({ ...f, entity_type: e.target.value }))}>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field"><label>Entity ID</label>
                  <input value={genForm.entity_id} onChange={(e) => setGenForm((f) => ({ ...f, entity_id: e.target.value }))} placeholder="paste batch/shipment ID" required />
                </div>
                <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Generate</button>
              </form>

              {genResult && (
                <div className="mt-16 flex-col items-center" style={{ alignItems: 'center', textAlign: 'center' }}>
                  {genResult.qr_image_base64 && (
                    <img src={genResult.qr_image_base64} alt="QR code" style={{ width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 8 }} />
                  )}
                  <div className="mono text-sm mt-8">{genResult.qr_token}</div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>Log a scan</h3></div>
            <div className="panel-body">
              {scanError && <div className="error-banner">{scanError}</div>}
              <form onSubmit={handleScan}>
                <div className="field"><label>QR token</label>
                  <input value={scanForm.qr_token} onChange={(e) => setScanForm((f) => ({ ...f, qr_token: e.target.value }))} required />
                </div>
                <div className="field"><label>Action</label>
                  <select value={scanForm.action} onChange={(e) => setScanForm((f) => ({ ...f, action: e.target.value }))}>
                    {SCAN_ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field"><label>Station (optional)</label>
                  <select value={scanForm.station_id} onChange={(e) => setScanForm((f) => ({ ...f, station_id: e.target.value }))}>
                    <option value="">—</option>
                    {stations.map((s) => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Record scan</button>
              </form>

              {scanResult && (
                <div className="mt-16">
                  <Badge value="in_stock" label={`recorded: ${scanResult.action.replace(/_/g, ' ')}`} />
                  <div className="text-faint text-sm mt-8">{new Date(scanResult.scanned_at).toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel mt-24">
          <div className="panel-header"><h3>Entity traceability history</h3></div>
          <div className="panel-body">
            {historyError && <div className="error-banner">{historyError}</div>}
            <form onSubmit={handleHistory} className="flex gap-12" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label>Entity type</label>
                <select value={historyQuery.entity_type} onChange={(e) => setHistoryQuery((f) => ({ ...f, entity_type: e.target.value }))}>
                  {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, flex: 2 }}>
                <label>Entity ID</label>
                <input value={historyQuery.entity_id} onChange={(e) => setHistoryQuery((f) => ({ ...f, entity_id: e.target.value }))} required />
              </div>
              <button className="btn btn-secondary" type="submit">Look up</button>
            </form>

            {history && (
              <div className="table-wrap mt-16">
                {history.scans.length === 0 ? (
                  <div className="empty-state"><div className="icon">◌</div>No scans recorded for this entity yet</div>
                ) : (
                  <table>
                    <thead><tr><th>Action</th><th>Time</th><th>Notes</th></tr></thead>
                    <tbody>
                      {history.scans.map((s) => (
                        <tr key={s.scan_id}>
                          <td><Badge value="in_stock" label={s.action.replace(/_/g, ' ')} /></td>
                          <td className="text-sm">{new Date(s.scanned_at).toLocaleString()}</td>
                          <td className="text-faint text-sm">{s.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
