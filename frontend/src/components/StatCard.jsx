export default function StatCard({ label, value, delta, accent }) {
  return (
    <div className={`stat-card ${accent ? `accent-${accent}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  )
}
