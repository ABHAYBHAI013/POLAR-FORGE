const TONE_MAP = {
  // asset / shipment statuses
  in_stock: 'mint',
  in_transit: 'ice',
  issued: 'ice',
  reserved: 'amber',
  under_maintenance: 'amber',
  quarantined: 'coral',
  expired: 'coral',
  damaged: 'coral',
  consumed: 'neutral',
  disposed: 'neutral',
  lost: 'coral',
  // shipment statuses
  planned: 'neutral',
  packed: 'ice',
  dispatched: 'ice',
  delayed: 'amber',
  arrived: 'mint',
  unloaded: 'mint',
  cancelled: 'coral',
  // expedition statuses
  planning: 'neutral',
  staging: 'amber',
  active: 'mint',
  winding_down: 'amber',
  completed: 'ice',
  // alert severity
  info: 'ice',
  warning: 'amber',
  critical: 'coral',
  // shelf-life risk
  safe: 'mint',
  watch: 'amber',
  urgent: 'coral',
}

export default function Badge({ value, label }) {
  if (!value) return null
  const tone = TONE_MAP[value] || 'neutral'
  const text = label || String(value).replace(/_/g, ' ')
  return <span className={`badge badge-${tone}`}>{text}</span>
}
