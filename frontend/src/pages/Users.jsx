import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { authApi } from '../api/endpoints'

const USER_ROLES = [
  { value: 'admin', label: 'Admin (System Administrator)' },
  { value: 'inventory_manager', label: 'Inventory Manager (Cold-Chain/FEFO)' },
  { value: 'logistics_manager', label: 'Logistics Manager (Shipments/Routes)' },
  { value: 'expedition_team', label: 'Expedition Team (Field Operations)' },
  { value: 'maintenance_team', label: 'Maintenance Team (Station Thermal/Engineers)' },
]

const ROLE_BADGE_MAP = {
  admin: 'urgent',
  super_admin: 'urgent',
  inventory_manager: 'safe',
  inventory_clerk: 'safe',
  logistics_manager: 'watch',
  logistics_officer: 'watch',
  station_manager: 'watch',
  expedition_team: 'ice',
  field_member: 'ice',
  maintenance_team: 'amber',
}

const EMPTY_USER = { employee_code: '', full_name: '', email: '', password: '', role: 'expedition_team' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_USER)
  const [error, setError] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data } = await authApi.listUsers()
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await authApi.createUser(form)
      setShowModal(false)
      setForm(EMPTY_USER)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create user')
    }
  }

  return (
    <>
      <PageHeader
        title="Team and User Management"
        subtitle="Role-based access control across polar expedition stations"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Add Team Member
          </button>
        }
      />

      <div className="page-content">
        <div className="panel">
          <div className="panel-header">
            <h3>Registered Personnel</h3>
            <span className="badge badge-ice">{users.length} members</span>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="flex items-center justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Emp Code</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Assigned Role</th>
                    <th>Account Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id}>
                      <td className="mono">{u.employee_code}</td>
                      <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                      <td className="text-faint">{u.email}</td>
                      <td>
                        <Badge
                          value={ROLE_BADGE_MAP[u.role] || 'info'}
                          label={u.role.replace(/_/g, ' ').toUpperCase()}
                        />
                      </td>
                      <td>
                        <span style={{ color: u.is_active ? '#6fe0b0' : '#f4614b', fontSize: 13 }}>
                          {u.is_active ? '● Active' : '○ Deactivated'}
                        </span>
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
        <Modal title="Provision New Team Member" onClose={() => setShowModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Employee Code</label>
              <input
                value={form.employee_code}
                onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
                placeholder="e.g. MNT009"
                required
              />
            </div>
            <div className="field">
              <label>Role / User Designation</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Expedition Field Lead / Station Engineer"
                required
              />

            </div>
            <div className="field">
              <label>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="officer@moes.gov.in"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Initial password"
                required
              />
            </div>
            <div className="field">
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: 8 }}>
              Create Account
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
