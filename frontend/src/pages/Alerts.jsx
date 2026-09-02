import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import { alertsApi } from '../api/endpoints'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [resolvingId, setResolvingId] = useState(null)

  const load = async () => {
    setLoading(true)
    const params = filter === 'open' ? { is_resolved: false } : filter === 'resolved' ? { is_resolved: true } : {}
    const { data } = await alertsApi.list(params)
    setAlerts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleResolve = async (alertId) => {
    setResolvingId(alertId)
    try {
      await alertsApi.resolve(alertId)
      load()
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <>
      <PageHeader title="Alerts" subtitle="Temperature breaches, expiry warnings, and low stock" />
      <div className="page-content">
        <div className="flex gap-8" style={{ marginBottom: 16 }}>
          {['open', 'resolved', 'all'].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="table-wrap">
            {loading ? (
              <div className="flex items-center justify-between" style={{ justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : alerts.length === 0 ? (
              <div className="empty-state"><div className="icon">✓</div>No alerts in this view</div>
            ) : (
              <table>
                <thead><tr><th>Severity</th><th>Type</th><th>Title</th><th>Message</th><th>Raised</th><th></th></tr></thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.alert_id}>
                      <td><Badge value={a.severity} /></td>
                      <td className="text-faint text-sm">{a.alert_type.replace(/_/g, ' ')}</td>
                      <td>{a.title}</td>
                      <td className="text-faint" style={{ maxWidth: 340 }}>{a.message}</td>
                      <td className="text-faint mono text-sm">{new Date(a.created_at).toLocaleString()}</td>
                      <td>
                        {!a.is_resolved && (
                          <button className="btn btn-secondary btn-sm" disabled={resolvingId === a.alert_id} onClick={() => handleResolve(a.alert_id)}>
                            {resolvingId === a.alert_id ? <span className="spinner" /> : 'Resolve'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
