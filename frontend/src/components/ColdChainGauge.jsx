const CONDITION_LABELS = {
  ambient: 'Ambient',
  chilled_0_4C: '0–4°C',
  frozen_neg18C: '−18°C',
  deep_frozen_neg40C: '−40°C',
  cryogenic: 'Cryogenic',
  controlled_humidity: 'Humidity ctrl',
  hazmat: 'Hazmat',
}

export default function ColdChainGauge({ condition, currentTemp, targetMin, targetMax, compact }) {
  const label = CONDITION_LABELS[condition] || condition
  return (
    <div className="flex items-center gap-12">
      <div className={`cold-strip ${condition}`} style={{ height: compact ? 28 : 40 }} />
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--frost)' }}>{label}</div>
        {currentTemp !== undefined && currentTemp !== null && (
          <div className="text-faint" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            now {currentTemp}°C
            {targetMin != null && targetMax != null ? ` · target ${targetMin}–${targetMax}°C` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
