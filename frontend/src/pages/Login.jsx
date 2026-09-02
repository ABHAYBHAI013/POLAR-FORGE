import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@moes.gov.in', password: 'Manan@2007', icon: '👑', desc: 'Full System Control & Users' },
  { role: 'Inventory Manager', email: 'inventory@moes.gov.in', password: 'Inventory@2026', icon: '📦', desc: 'FEFO Allocation & Batches' },
  { role: 'Logistics Manager', email: 'logistics@moes.gov.in', password: 'Logistics@2026', icon: '🚚', desc: 'Shipments & Route Manifests' },
  { role: 'Expedition Team', email: 'expedition@moes.gov.in', password: 'Expedition@2026', icon: '❄️', desc: 'Field Requests & QR Scans' },
  { role: 'Maintenance Team', email: 'maintenance@moes.gov.in', password: 'Maintenance@2026', icon: '🔧', desc: 'Storage Temps & Alerts' },
]

export default function Login() {
  const [email, setEmail] = useState('admin@moes.gov.in')
  const [password, setPassword] = useState('Manan@2007')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLoginSubmit = async (targetEmail = email, targetPass = password) => {
    setError('')
    setSubmitting(true)
    try {
      await login(targetEmail, targetPass)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed — check your credentials')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickLogin = (demo) => {
    setEmail(demo.email)
    setPassword(demo.password)
    handleLoginSubmit(demo.email, demo.password)
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-brand">
          <div className="login-mark" />
          <h1>Integrated Polar Expedition<br />Logistics &amp; Asset Management</h1>
          <p>SIH26062 · MoES / NCPOR Build</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={(e) => { e.preventDefault(); handleLoginSubmit() }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@moes.gov.in" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 6 }}>
            {submitting ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ice)', marginBottom: 8, textAlign: 'center' }}>
            ⚡ 1-CLICK DEMO LOGIN (SELECT ROLE):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin(demo)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', textAlign: 'left', fontSize: 12 }}
              >
                <span><b>{demo.icon} {demo.role}</b></span>
                <span className="text-faint mono" style={{ fontSize: 11 }}>{demo.email.split('@')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

