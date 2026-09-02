import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import MapWidget from '../components/MapWidget'
import { inventoryApi, alertsApi, shipmentsApi, stationsApi } from '../api/endpoints'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [expiring, setExpiring] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [alerts, setAlerts] = useState([])
  const [inTransitShipments, setInTransitShipments] = useState(0)
  const [stations, setStations] = useState([])
  const [shipments, setShipments] = useState([])
  const [tracking, setTracking] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const [expiringRes, lowStockRes, alertsRes, shipmentsRes, stationsRes] = await Promise.all([
          inventoryApi.expiringBatches(),
          inventoryApi.lowStock(),
          alertsApi.list({ is_resolved: false }),
          shipmentsApi.list({ status_filter: 'in_transit' }),
          stationsApi.list(),
        ])
        setExpiring(expiringRes.data.slice(0, 6))
        setLowStock(lowStockRes.data.slice(0, 6))
        setAlerts(alertsRes.data.slice(0, 8))
        setInTransitShipments(shipmentsRes.data.length)
        setStations(stationsRes.data)
        setShipments(shipmentsRes.data)

        const trackMap = {}
        for (const s of shipmentsRes.data) {
          try {
            const { data } = await shipmentsApi.getTracking(s.shipment_id)
            trackMap[s.shipment_id] = data
          } catch (e) {}
        }
        setTracking(trackMap)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live polar telemetry, cold-chain readiness, and inter-station logistics"
        actions={
          <div className="flex gap-8">
            <Link to="/map" className="btn btn-secondary btn-sm">🗺️ Polar Map</Link>
            <Link to="/reports" className="btn btn-primary btn-sm">📄 Generate Reports</Link>
          </div>
        }
      />
      <div className="page-content">
        {loading ? (
          <div className="flex items-center justify-between" style={{ justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : (
          <>
            <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <StatCard label="Active Polar Stations" value={stations.length} accent="ice" />
              <StatCard label="Shipments In Transit" value={inTransitShipments} accent="ice" />
              <StatCard label="Batches Expiring ≤30d" value={expiring.length} accent="amber" />
              <StatCard label="Active Cold Alarms" value={alerts.length} accent="coral" />
            </div>

            <div className="panel mt-24">
              <div className="panel-header">
                <h3>Live Polar Telemetry & Hazard Map</h3>
                <Link to="/map" className="text-sm">Open full command center →</Link>
              </div>
              <div style={{ padding: 12 }}>
                <MapWidget
                  stations={stations}
                  shipments={shipments}
                  activeTracking={tracking}
                  height="360px"
                />
              </div>
            </div>


            <div className="grid grid-2 mt-24">
              <div className="panel">
                <div className="panel-header">
                  <h3>Expiring soon (FEFO priority)</h3>
                  <Link to="/inventory" className="text-sm">View inventory →</Link>
                </div>
                <div className="table-wrap">
                  {expiring.length === 0 ? (
                    <div className="empty-state"><div className="icon">✓</div>Nothing expiring in the next 30 days</div>
                  ) : (
                    <table>
                      <thead><tr><th>Asset</th><th>Station</th><th>Qty</th><th>Expiry</th></tr></thead>
                      <tbody>
                        {expiring.map((b) => (
                          <tr key={b.batch_id}>
                            <td>{b.asset_name}</td>
                            <td className="text-faint">{b.station_name}</td>
                            <td className="mono">{b.quantity_remaining} {b.unit_of_measure}</td>
                            <td><Badge value={b.days_to_expiry < 0 ? 'expired' : b.days_to_expiry <= 7 ? 'urgent' : 'watch'} label={b.expiry_date} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Low stock</h3>
                  <Link to="/inventory" className="text-sm">View inventory →</Link>
                </div>
                <div className="table-wrap">
                  {lowStock.length === 0 ? (
                    <div className="empty-state"><div className="icon">✓</div>All stock above reorder threshold</div>
                  ) : (
                    <table>
                      <thead><tr><th>Asset</th><th>Remaining</th><th>Threshold</th></tr></thead>
                      <tbody>
                        {lowStock.map((s, i) => (
                          <tr key={i}>
                            <td>{s.name}</td>
                            <td className="mono">{s.total_remaining}</td>
                            <td className="mono text-faint">{s.reorder_threshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="panel mt-24">
              <div className="panel-header">
                <h3>Recent alerts</h3>
                <Link to="/alerts" className="text-sm">View all →</Link>
              </div>
              <div className="table-wrap">
                {alerts.length === 0 ? (
                  <div className="empty-state"><div className="icon">✓</div>No open alerts</div>
                ) : (
                  <table>
                    <thead><tr><th>Severity</th><th>Title</th><th>Message</th><th>Raised</th></tr></thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.alert_id}>
                          <td><Badge value={a.severity} /></td>
                          <td>{a.title}</td>
                          <td className="text-faint">{a.message}</td>
                          <td className="text-faint mono text-sm">{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
