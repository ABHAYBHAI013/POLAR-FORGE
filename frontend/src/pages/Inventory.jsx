import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { inventoryApi, stationsApi } from '../api/endpoints'

const STORAGE_CONDITIONS = ['ambient', 'chilled_0_4C', 'frozen_neg18C', 'deep_frozen_neg40C', 'cryogenic', 'hazmat']

const EMPTY_DEF = { sku: '', name: '', category: '', default_storage_condition: 'ambient', unit_of_measure: 'unit', reorder_threshold: 0 }
const EMPTY_BATCH = { asset_def_id: '', batch_number: '', expiry_date: '', quantity_received: '', unit_of_measure: 'unit', station_id: '' }

function daysToExpiryTone(days) {
  if (days == null) return 'safe'
  if (days < 0) return 'urgent'
  if (days <= 7) return 'urgent'
  if (days <= 30) return 'watch'
  return 'safe'
}

export default function Inventory() {
  const [tab, setTab] = useState('batches')
  const [assetDefs, setAssetDefs] = useState([])
  const [batches, setBatches] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showDefModal, setShowDefModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [defForm, setDefForm] = useState(EMPTY_DEF)
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH)
  const [issueForm, setIssueForm] = useState({ asset_def_id: '', station_id: '', quantity: '' })
  const [issueResult, setIssueResult] = useState(null)

  const loadAll = async () => {
    setLoading(true)
    const [defsRes, batchesRes, stationsRes] = await Promise.all([
      inventoryApi.listAssetDefinitions(),
      inventoryApi.listBatches(),
      stationsApi.list(),
    ])
    setAssetDefs(defsRes.data)
    setBatches(batchesRes.data)
    setStations(stationsRes.data)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const assetName = (id) => assetDefs.find((d) => d.asset_def_id === id)?.name || id
  const stationName = (id) => stations.find((s) => s.station_id === id)?.name || id

  const handleCreateDef = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...defForm, reorder_threshold: parseFloat(defForm.reorder_threshold) || 0 }
      await inventoryApi.createAssetDefinition(payload)
      setShowDefModal(false)
      setDefForm(EMPTY_DEF)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create asset definition')
    }
  }

  const handleCreateBatch = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...batchForm, quantity_received: parseFloat(batchForm.quantity_received) }
      if (!payload.expiry_date) delete payload.expiry_date
      await inventoryApi.createBatch(payload)
      setShowBatchModal(false)
      setBatchForm(EMPTY_BATCH)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create batch')
    }
  }

  const handleIssue = async (e) => {
    e.preventDefault()
    setError('')
    setIssueResult(null)
    try {
      const { data } = await inventoryApi.issueFefo({
        asset_def_id: issueForm.asset_def_id,
        station_id: issueForm.station_id,
        quantity: parseFloat(issueForm.quantity),
      })
      setIssueResult(data)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not issue stock — insufficient quantity available')
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Asset catalog, cold-chain batches, and FEFO issuing"
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDefModal(true)}>+ Asset type</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBatchModal(true)}>+ Receive batch</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowIssueModal(true)}>Issue stock (FEFO)</button>
          </>
        }
      />
      <div className="page-content">
        <div className="flex gap-8 mt-8" style={{ marginBottom: 16 }}>
          {['batches', 'catalog'].map((t) => (
            <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t === 'batches' ? 'Batches (perishables)' : 'Catalog'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-between" style={{ justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : (
          <div className="panel">
            <div className="table-wrap">
              {tab === 'batches' && (
                batches.length === 0 ? (
                  <div className="empty-state"><div className="icon">◌</div>No batches recorded yet</div>
                ) : (
                  <table>
                    <thead><tr><th>Asset</th><th>Batch #</th><th>Station</th><th>Remaining</th><th>Expiry</th><th>Status</th></tr></thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.batch_id}>
                          <td>{assetName(b.asset_def_id)}</td>
                          <td className="mono">{b.batch_number}</td>
                          <td className="text-faint">{stationName(b.station_id)}</td>
                          <td className="mono">{b.quantity_remaining} / {b.quantity_received} {b.unit_of_measure}</td>
                          <td>
                            {b.expiry_date ? (
                              <Badge value={daysToExpiryTone(Math.floor((new Date(b.expiry_date) - new Date()) / 86400000))} label={b.expiry_date} />
                            ) : <span className="text-faint">—</span>}
                          </td>
                          <td><Badge value={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {tab === 'catalog' && (
                assetDefs.length === 0 ? (
                  <div className="empty-state"><div className="icon">◌</div>No asset types defined yet</div>
                ) : (
                  <table>
                    <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Default condition</th><th>Reorder threshold</th></tr></thead>
                    <tbody>
                      {assetDefs.map((d) => (
                        <tr key={d.asset_def_id}>
                          <td className="mono">{d.sku}</td>
                          <td>{d.name}</td>
                          <td className="text-faint">{d.category}</td>
                          <td><Badge value={d.default_storage_condition} label={d.default_storage_condition.replace(/_/g, ' ')} /></td>
                          <td className="text-faint mono">{d.reorder_threshold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {showDefModal && (
        <Modal title="New asset type" onClose={() => setShowDefModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreateDef}>
            <div className="field"><label>SKU</label>
              <input value={defForm.sku} onChange={(e) => setDefForm((f) => ({ ...f, sku: e.target.value }))} required />
            </div>
            <div className="field"><label>Name</label>
              <input value={defForm.name} onChange={(e) => setDefForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field"><label>Category</label>
              <input value={defForm.category} onChange={(e) => setDefForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. food, fuel, medical" required />
            </div>
            <div className="field"><label>Default storage condition</label>
              <select value={defForm.default_storage_condition} onChange={(e) => setDefForm((f) => ({ ...f, default_storage_condition: e.target.value }))}>
                {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Unit of measure</label>
                <input value={defForm.unit_of_measure} onChange={(e) => setDefForm((f) => ({ ...f, unit_of_measure: e.target.value }))} />
              </div>
              <div className="field"><label>Reorder threshold</label>
                <input type="number" value={defForm.reorder_threshold} onChange={(e) => setDefForm((f) => ({ ...f, reorder_threshold: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create asset type</button>
          </form>
        </Modal>
      )}

      {showBatchModal && (
        <Modal title="Receive batch" onClose={() => setShowBatchModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreateBatch}>
            <div className="field"><label>Asset type</label>
              <select value={batchForm.asset_def_id} onChange={(e) => setBatchForm((f) => ({ ...f, asset_def_id: e.target.value }))} required>
                <option value="">Select…</option>
                {assetDefs.map((d) => <option key={d.asset_def_id} value={d.asset_def_id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Batch number</label>
              <input value={batchForm.batch_number} onChange={(e) => setBatchForm((f) => ({ ...f, batch_number: e.target.value }))} required />
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Quantity received</label>
                <input type="number" step="any" value={batchForm.quantity_received} onChange={(e) => setBatchForm((f) => ({ ...f, quantity_received: e.target.value }))} required />
              </div>
              <div className="field"><label>Unit</label>
                <input value={batchForm.unit_of_measure} onChange={(e) => setBatchForm((f) => ({ ...f, unit_of_measure: e.target.value }))} />
              </div>
            </div>
            <div className="field"><label>Expiry date (optional)</label>
              <input type="date" value={batchForm.expiry_date} onChange={(e) => setBatchForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="field"><label>Station</label>
              <select value={batchForm.station_id} onChange={(e) => setBatchForm((f) => ({ ...f, station_id: e.target.value }))} required>
                <option value="">Select…</option>
                {stations.map((s) => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Receive batch</button>
          </form>
        </Modal>
      )}

      {showIssueModal && (
        <Modal title="Issue stock — FEFO" onClose={() => { setShowIssueModal(false); setIssueResult(null) }}>
          {error && <div className="error-banner">{error}</div>}
          <p className="text-faint text-sm mt-8" style={{ marginBottom: 14 }}>
            Automatically allocates from the soonest-expiring batches first, across as many batches as needed.
          </p>
          <form onSubmit={handleIssue}>
            <div className="field"><label>Asset type</label>
              <select value={issueForm.asset_def_id} onChange={(e) => setIssueForm((f) => ({ ...f, asset_def_id: e.target.value }))} required>
                <option value="">Select…</option>
                {assetDefs.map((d) => <option key={d.asset_def_id} value={d.asset_def_id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Station</label>
              <select value={issueForm.station_id} onChange={(e) => setIssueForm((f) => ({ ...f, station_id: e.target.value }))} required>
                <option value="">Select…</option>
                {stations.map((s) => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Quantity</label>
              <input type="number" step="any" value={issueForm.quantity} onChange={(e) => setIssueForm((f) => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Allocate &amp; issue</button>
          </form>

          {issueResult && (
            <div className="mt-16">
              <div className="text-faint text-sm" style={{ marginBottom: 8 }}>Allocated across {issueResult.length} batch(es):</div>
              {issueResult.map((t) => (
                <div key={t.txn_id} className="flex justify-between text-sm mono mt-8">
                  <span>{t.quantity}</span>
                  <Badge value="in_stock" label="issued" />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
