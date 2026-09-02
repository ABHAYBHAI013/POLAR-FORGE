import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import { reportsApi, shipmentsApi, stationsApi } from '../api/endpoints'

export default function Reports() {
  const [tab, setTab] = useState('manifest')
  const [shipments, setShipments] = useState([])
  const [stations, setStations] = useState([])
  const [selectedShipmentId, setSelectedShipmentId] = useState('')
  const [manifestData, setManifestData] = useState(null)
  const [dispatchData, setDispatchData] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditFilter, setAuditFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([shipmentsApi.list(), stationsApi.list()]).then(([sRes, stRes]) => {
      setShipments(sRes.data)
      setStations(stRes.data)
      if (sRes.data.length > 0) {
        setSelectedShipmentId(sRes.data[0].shipment_id)
      }
    })
  }, [])

  useEffect(() => {
    if (tab === 'manifest' && selectedShipmentId) {
      setLoading(true)
      reportsApi.manifest(selectedShipmentId)
        .then(({ data }) => setManifestData(data))
        .catch(() => setError('Failed to compile manifest'))
        .finally(() => setLoading(false))
    } else if (tab === 'dispatch' && selectedShipmentId) {
      setLoading(true)
      reportsApi.dispatch(selectedShipmentId)
        .then(({ data }) => setDispatchData(data))
        .catch(() => setError('Failed to compile customs dispatch sheet'))
        .finally(() => setLoading(false))
    } else if (tab === 'audit') {
      setLoading(true)
      reportsApi.auditLog({ event_type: auditFilter })
        .then(({ data }) => setAuditLogs(data))
        .catch(() => setError('Failed to load audit logs'))
        .finally(() => setLoading(false))
    }
  }, [tab, selectedShipmentId, auditFilter])

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports and Manifests"
          subtitle="Official polar dispatch notes, Cargo manifests, and consolidated audit trails"
          actions={
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              Print / Save PDF
            </button>
          }
        />
      </div>

      <div className="page-content">
        <div className="flex gap-8 no-print" style={{ marginBottom: 16 }}>
          <button
            className={`btn btn-sm ${tab === 'manifest' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('manifest')}
          >
            Cargo Manifest
          </button>
          <button
            className={`btn btn-sm ${tab === 'dispatch' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('dispatch')}
          >
            Customs and Dispatch Sheet
          </button>
          <button
            className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('audit')}
          >
            Audit Log Trail
          </button>
        </div>

        {(tab === 'manifest' || tab === 'dispatch') && (
          <div className="no-print flex items-center gap-12" style={{ marginBottom: 16, background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, color: 'var(--ice)' }}>Select Shipment Convoy:</span>
            <select
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              style={{ background: 'var(--bg-panel)', color: 'var(--frost)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 4, maxWidth: 360 }}
            >
              {shipments.map((s) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.shipment_code} ({s.transport_mode} - {s.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : tab === 'manifest' && manifestData ? (
          /* MANIFEST DOCUMENT */
          <div className="polar-doc">
            <div className="doc-header">
              <div className="doc-brand">
                <div className="doc-emblem" />
                <div>
                  <div className="doc-govt">GOVERNMENT OF INDIA - MINISTRY OF EARTH SCIENCES</div>
                  <div className="doc-authority">NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR)</div>
                  <div className="doc-title">OFFICIAL POLAR EXPEDITION CARGO MANIFEST</div>
                </div>
              </div>
              <div className="doc-qr">
                {manifestData.qr_code_base64 && (
                  <img src={manifestData.qr_code_base64} alt="QR code" style={{ width: 100, height: 100 }} />
                )}
                <div className="mono" style={{ fontSize: 10, textAlign: 'center', marginTop: 4 }}>{manifestData.manifest_id}</div>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-section-title">TRANSPORT AND ROUTE DIRECTIVES</div>
              <div className="doc-grid">
                <div>
                  <span className="label">SHIPMENT CODE:</span>
                  <span className="value mono">{manifestData.shipment.shipment_code}</span>
                </div>
                <div>
                  <span className="label">TRANSPORT MODE:</span>
                  <span className="value" style={{ textTransform: 'uppercase' }}>{manifestData.shipment.transport_mode}</span>
                </div>
                <div>
                  <span className="label">ORIGIN STATION:</span>
                  <span className="value">{manifestData.origin_station.name} ({manifestData.origin_station.code})</span>
                </div>
                <div>
                  <span className="label">DESTINATION:</span>
                  <span className="value">{manifestData.destination_station.name} ({manifestData.destination_station.code})</span>
                </div>
                <div>
                  <span className="label">STATUS:</span>
                  <span className="value" style={{ textTransform: 'uppercase' }}>{manifestData.shipment.status}</span>
                </div>
                <div>
                  <span className="label">GENERATED AT:</span>
                  <span className="value mono">{new Date(manifestData.generated_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-section-title">CARGO ITEMS AND COLD-CHAIN REGIMES</div>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>SKU</th>
                    <th>Batch #</th>
                    <th>Storage Regime</th>
                    <th>Qty</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestData.cargo_items.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 12 }}>General Expedition Equipment and Fuel Cargo (No Perishable Batches)</td></tr>
                  ) : (
                    manifestData.cargo_items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                        <td className="mono">{item.sku}</td>
                        <td className="mono">{item.batch_number}</td>
                        <td>{item.storage_condition.replace(/_/g, ' ')}</td>
                        <td className="mono">{item.quantity} {item.unit}</td>
                        <td className="mono">{item.expiry_date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="doc-section">
              <div className="doc-section-title">COMPLIANCE AND EXPEDITION DEPLOYMENT VERIFICATION</div>
              <div className="doc-grid">
                <div><span className="label">TOTAL LINE ITEMS:</span> <span className="value">{manifestData.summary.total_items_count}</span></div>
                <div><span className="label">EST. GROSS WEIGHT:</span> <span className="value mono">{manifestData.summary.total_weight_est_kg} KG</span></div>
                <div><span className="label">COLD-CHAIN ROUTE:</span> <span className="value">{manifestData.summary.cold_chain_required ? 'ACTIVE MONITORING REQUIRED' : 'STANDARD'}</span></div>
                <div><span className="mono value">[PASSED] Antarctic Treaty Environmental Protocol Certified</span></div>
              </div>
            </div>

            <div className="doc-signatures">
              <div className="sign-box">
                <div className="sign-line" />
                <div className="sign-title">Cargo Dispatch Officer</div>
                <div className="sign-subtitle">Logistics Commander / MoES</div>
              </div>
              <div className="sign-box">
                <div className="sign-line" />
                <div className="sign-title">Receiving Station Chief</div>
                <div className="sign-subtitle">Inventory Control Division</div>
              </div>
              <div className="sign-box">
                <div className="sign-line" />
                <div className="sign-title">Customs and Treaty Inspector</div>
                <div className="sign-subtitle">NCPOR Polar Compliance</div>
              </div>
            </div>
          </div>
        ) : tab === 'dispatch' && dispatchData ? (
          /* CUSTOMS / DISPATCH SHEET */
          <div className="polar-doc">
            <div className="doc-header">
              <div className="doc-brand">
                <div className="doc-emblem" />
                <div>
                  <div className="doc-govt">GOVERNMENT OF INDIA - MINISTRY OF EARTH SCIENCES</div>
                  <div className="doc-authority">NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR)</div>
                  <div className="doc-title" style={{ color: '#1a5276' }}>POLAR CUSTOMS AND CARGO DISPATCH CERTIFICATE</div>
                </div>
              </div>
              <div className="doc-qr">
                {dispatchData.manifest.qr_code_base64 && (
                  <img src={dispatchData.manifest.qr_code_base64} alt="QR code" style={{ width: 100, height: 100 }} />
                )}
                <div className="mono" style={{ fontSize: 10, textAlign: 'center', marginTop: 4 }}>{dispatchData.dispatch_sheet_id}</div>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-section-title">DISPATCH AUTHORIZATION AND PROTOCOL</div>
              <div className="doc-grid">
                <div>
                  <span className="label">AUTHORIZED OFFICER:</span>
                  <span className="value">{dispatchData.authorized_officer} (CODE: {dispatchData.officer_code})</span>
                </div>
                <div>
                  <span className="label">PROTOCOL STANDARD:</span>
                  <span className="value">{dispatchData.protocol}</span>
                </div>
                <div>
                  <span className="label">SHIPMENT ROUTE:</span>
                  <span className="value">{dispatchData.manifest.origin_station.name} to {dispatchData.manifest.destination_station.name}</span>
                </div>
                <div>
                  <span className="label">CLEARANCE VERDICT:</span>
                  <span className="value" style={{ color: '#1a5276', fontWeight: 700 }}>{dispatchData.clearance_status}</span>
                </div>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-section-title">MANDATORY COMPLIANCE CHECKLIST</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {dispatchData.compliance_declarations.map((decl, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: '#1a5276', fontWeight: 'bold' }}>[NCPOR-VERIFIED]</span>
                    <span>{decl}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="doc-signatures">
              <div className="sign-box">
                <div className="sign-line" />
                <div className="sign-title">Dispatch Officer</div>
                <div className="sign-subtitle">{dispatchData.authorized_officer}</div>
              </div>
              <div className="sign-box">
                <div className="sign-line" />
                <div className="sign-title">Polar Customs Authority</div>
                <div className="sign-subtitle">MoES Inspection Stamp</div>
              </div>
            </div>
          </div>
        ) : (
          /* AUDIT LOG REPORT */
          <div>
            <div className="no-print flex gap-8 items-center" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--frost-faint)' }}>Filter Events:</span>
              {['all', 'scan', 'inventory', 'temperature'].map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${auditFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAuditFilter(f)}
                >
                  {f === 'all' ? 'All Events' : f === 'scan' ? 'QR Scans' : f === 'inventory' ? 'Inventory' : 'Cold-Chain Alerts'}
                </button>
              ))}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>System-Wide Audit Trail</h3>
                <span className="badge badge-ice">{auditLogs.length} records</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Performed By</th>
                      <th>Station / Location</th>
                      <th>Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((event) => (
                      <tr key={event.id}>
                        <td><Badge value="info" label={event.event_category} /></td>
                        <td style={{ fontWeight: 600 }}>{event.action}</td>
                        <td className="mono">{event.entity_id}</td>
                        <td>{event.performed_by}</td>
                        <td className="text-faint">{event.station_name}</td>
                        <td className="text-faint" style={{ maxWidth: 300 }}>{event.notes}</td>
                        <td className="mono text-faint text-sm">{new Date(event.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
