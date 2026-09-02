import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_SECTIONS = [
  {
    label: 'Operations',
    links: [
      { to: '/', label: 'Dashboard', end: true },
      { to: '/alerts', label: 'Alerts' },
    ],
  },
  {
    label: 'Assets',
    links: [
      { to: '/inventory', label: 'Inventory' },
      { to: '/stations', label: 'Stations & Storage' },
    ],
  },
  {
    label: 'Movement',
    links: [
      { to: '/shipments', label: 'Shipments & Tracking' },
      { to: '/qr', label: 'QR Scan & Trace' },
    ],
  },
]

const ROLE_COLOR_MAP = {
  admin: '#f4614b',
  super_admin: '#f4614b',
  inventory_manager: '#6fe0b0',
  inventory_clerk: '#6fe0b0',
  logistics_manager: '#7fd8f0',
  logistics_officer: '#7fd8f0',
  station_manager: '#7fd8f0',
  expedition_team: '#a6e8fa',
  field_member: '#a6e8fa',
  maintenance_team: '#f4b860',
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function Layout() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const navSections = [
    {
      label: 'Telemetry & Overview',
      links: [
        { to: '/', label: 'Operations Dashboard', end: true },
        { to: '/map', label: 'Polar Telemetry Map' },
        { to: '/alerts', label: 'Alerts & Anomalies' },
      ],
    },
    {
      label: 'Assets & Cold-Chain',
      links: [
        { to: '/inventory', label: 'Inventory (FEFO)' },
        { to: '/stations', label: 'Stations & Thermal Units' },
      ],
    },
    {
      label: 'Movement & Traceability',
      links: [
        { to: '/shipments', label: 'Shipments & Tracking' },
        { to: '/qr', label: 'QR Scan & Trace' },
        { to: '/reports', label: 'Reports & Manifests' },
      ],
    },
    ...(isAdmin ? [
      {
        label: 'Administration',
        links: [
          { to: '/users', label: 'Team & Role Access' },
        ],
      }
    ] : []),
  ]

  const roleColor = ROLE_COLOR_MAP[user?.role] || '#7fd8f0'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" />
          <div className="sidebar-brand-text">
            Polar Logistics
            <small>SIH26062 · MoES / NCPOR</small>
          </div>
        </div>

        <nav>
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="nav-eyebrow">{section.label}</div>
              {section.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <span className="dot" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar" style={{ border: `2px solid ${roleColor}`, color: roleColor }}>
              {initials(user?.full_name)}
            </div>
            <div className="user-meta">
              <div className="name">{user?.full_name || '—'}</div>
              <div className="role" style={{ color: roleColor, fontWeight: 600 }}>
                ● {user?.role?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main-col">
        <Outlet />
      </div>
    </div>
  )
}

