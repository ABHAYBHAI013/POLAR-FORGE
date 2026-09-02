import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Polar Hazard Definitions (Realistic geographic coordinates)
const HAZARD_ZONES = {
  blizzards: [
    {
      name: 'Bonney-Larsemann Coastal Blizzard WARNING',
      severity: 'Critical (Wind > 85 km/h, Whiteout)',
      color: '#f4614b',
      coords: [
        [-68.8, 65.0], [-67.9, 75.0], [-70.2, 80.0],
        [-71.0, 73.0], [-69.5, 66.0],
      ],
    },
    {
      name: 'Schirmacher Oasis Gale Corridor',
      severity: 'Warning (Wind 65-75 km/h)',
      color: '#f4b860',
      coords: [
        [-70.0, 8.0], [-70.0, 15.0], [-71.5, 16.0], [-71.5, 7.0],
      ],
    },
  ],
  crevasses: [
    {
      name: 'Larsemann Shelf Crevasse Field',
      description: 'Active glacial fractures - No surface travel',
      color: '#f4b860',
      coords: [
        [-69.8, 74.0], [-69.2, 77.0], [-70.5, 78.0], [-70.7, 75.0],
      ],
    },
    {
      name: 'Queen Maud Land Glacial Fault Zone',
      description: 'Deep crevasses - Snowcat convoy prohibited',
      color: '#f4b860',
      coords: [
        [-71.2, 10.0], [-71.0, 13.0], [-72.2, 14.0], [-72.3, 9.0],
      ],
    },
  ],
  seaIce: [
    {
      name: 'Antarctic Fast-Ice Navigational Boundary',
      color: '#7fd8f0',
      coords: [
        [-65.0, 0.0], [-65.0, 50.0], [-64.0, 100.0], [-66.0, 150.0],
        [-67.0, -150.0], [-65.0, -100.0], [-65.0, -50.0], [-65.0, 0.0]
      ],
    }
  ]
}

const MODE_ICONS = {
  ship: '🚢',
  aircraft: '✈️',
  helicopter: '🚁',
  snow_vehicle: '🚜',
  sledge: '🛷',
}

export default function MapWidget({
  stations = [],
  shipments = [],
  activeTracking = {},
  height = '540px',
  onSelectStation,
  onSelectShipment,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef({ stations: null, shipments: null, hazards: null })

  const [showBlizzards, setShowBlizzards] = useState(true)
  const [showCrevasses, setShowCrevasses] = useState(true)
  const [showSeaIce, setShowSeaIce] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [region, setRegion] = useState('antarctica')

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [-72.0, 50.0],
      zoom: 3,
      zoomControl: false,
      preferCanvas: true,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)

    // Dark carto tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    layersRef.current.stations = L.layerGroup().addTo(map)
    layersRef.current.shipments = L.layerGroup().addTo(map)
    layersRef.current.hazards = L.layerGroup().addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Handle region camera movement
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (region === 'antarctica') {
      map.flyTo([-72.0, 50.0], 3, { animate: true })
    } else if (region === 'arctic') {
      map.flyTo([78.5, 15.0], 5, { animate: true })
    } else {
      map.flyTo([-10.0, 20.0], 2, { animate: true })
    }
  }, [region])

  // Render Stations
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layersRef.current.stations
    if (!map || !layer) return

    layer.clearLayers()

    stations.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return

      const isArctic = s.latitude > 0
      const badgeColor = isArctic ? '#6fe0b0' : '#7fd8f0'

      const stationIcon = L.divIcon({
        className: 'polar-station-marker',
        html: `<div style="background: ${badgeColor}; box-shadow: 0 0 12px ${badgeColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const marker = L.marker([s.latitude, s.longitude], { icon: stationIcon })

      const popupHtml = `
        <div style="color: #e8f1f5; font-family: system-ui; padding: 4px;">
          <div style="color: ${badgeColor}; font-weight: bold; font-size: 14px;">${s.name}</div>
          <div style="font-size: 11px; color: #a9bccb; margin-top: 2px; font-family: monospace;">CODE: ${s.code} | ${s.latitude.toFixed(4)}°, ${s.longitude.toFixed(4)}°</div>
          <div style="margin-top: 8px; font-size: 12px;">
            Region: <span style="color: #ffffff;">${isArctic ? 'Arctic' : 'Antarctica'}</span><br/>
            Status: <span style="color: #6fe0b0; font-weight: 600;">● Operational Base</span>
          </div>
        </div>
      `

      marker.bindPopup(popupHtml, { className: 'polar-popup' })
      marker.on('click', () => {
        if (onSelectStation) onSelectStation(s)
      })

      layer.addLayer(marker)
    })
  }, [stations, onSelectStation])

  // Render Hazard Overlays
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layersRef.current.hazards
    if (!map || !layer) return

    layer.clearLayers()

    if (showBlizzards) {
      HAZARD_ZONES.blizzards.forEach((b) => {
        const poly = L.polygon(b.coords, {
          color: b.color,
          fillColor: b.color,
          fillOpacity: 0.25,
          dashArray: '4, 8',
          weight: 2,
        })
        poly.bindTooltip(`🌪️ ${b.name} (${b.severity})`, { sticky: true })
        layer.addLayer(poly)
      })
    }

    if (showCrevasses) {
      HAZARD_ZONES.crevasses.forEach((c) => {
        const poly = L.polygon(c.coords, {
          color: c.color,
          fillColor: c.color,
          fillOpacity: 0.3,
          dashArray: '2, 6',
          weight: 2,
        })
        poly.bindTooltip(`⚠️ ${c.name}: ${c.description}`, { sticky: true })
        layer.addLayer(poly)
      })
    }

    if (showSeaIce) {
      HAZARD_ZONES.seaIce.forEach((s) => {
        const poly = L.polyline(s.coords, {
          color: s.color,
          dashArray: '6, 6',
          weight: 2,
          opacity: 0.65,
        })
        poly.bindTooltip(`🧊 ${s.name}`, { sticky: true })
        layer.addLayer(poly)
      })
    }
  }, [showBlizzards, showCrevasses, showSeaIce])

  // Render Shipment Routes & Tracking
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layersRef.current.shipments
    if (!map || !layer) return

    layer.clearLayers()
    if (!showRoutes) return

    shipments.forEach((shp) => {
      const origin = stations.find((s) => s.station_id === shp.origin_station_id)
      const dest = stations.find((s) => s.station_id === shp.destination_station_id)

      if (!origin || !dest || origin.latitude == null || dest.latitude == null) return

      const points = [
        [origin.latitude, origin.longitude],
        [dest.latitude, dest.longitude],
      ]

      const isInTransit = shp.status === 'in_transit'
      const line = L.polyline(points, {
        color: isInTransit ? '#7fd8f0' : '#6d8296',
        weight: isInTransit ? 3 : 1.5,
        dashArray: isInTransit ? '6, 8' : '2, 4',
        opacity: 0.85,
      })

      line.bindTooltip(`📦 ${shp.shipment_code} (${shp.transport_mode} - ${shp.status})`, { sticky: true })
      line.on('click', () => {
        if (onSelectShipment) onSelectShipment(shp)
      })
      layer.addLayer(line)

      // Active Tracking Waypoint
      const tracks = activeTracking[shp.shipment_id] || []
      if (tracks.length > 0) {
        const current = tracks[0]
        const modeIcon = MODE_ICONS[shp.transport_mode] || '📦'

        const convoyIcon = L.divIcon({
          className: 'convoy-marker',
          html: `<div style="font-size: 20px; filter: drop-shadow(0 0 8px #7fd8f0);">${modeIcon}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        })

        const currentMarker = L.marker([current.latitude, current.longitude], { icon: convoyIcon })
        currentMarker.bindPopup(`
          <div style="color: #e8f1f5; font-family: system-ui; padding: 4px;">
            <div style="font-weight: bold; color: #7fd8f0;">${shp.shipment_code}</div>
            <div style="font-size: 12px; margin-top: 4px;">
              Mode: ${shp.transport_mode}<br/>
              Ambient Temp: <b style="color: #f4b860;">${current.ambient_temp_c != null ? current.ambient_temp_c + '°C' : 'N/A'}</b><br/>
              Status: <span style="color: #6fe0b0;">${shp.status}</span>
            </div>
          </div>
        `, { className: 'polar-popup' })
        layer.addLayer(currentMarker)
      }
    })
  }, [shipments, stations, activeTracking, showRoutes, onSelectShipment])

  return (
    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Region selector */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          gap: 6,
          background: 'rgba(15, 24, 38, 0.90)',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          backdropFilter: 'blur(6px)',
          fontSize: 12,
          color: 'var(--frost)',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--ice)', marginRight: 2 }}>Region:</span>
        <button
          type="button"
          className={`btn btn-sm ${region === 'antarctica' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => setRegion('antarctica')}
        >
          Antarctica
        </button>
        <button
          type="button"
          className={`btn btn-sm ${region === 'arctic' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => setRegion('arctic')}
        >
          Arctic
        </button>
        <button
          type="button"
          className={`btn btn-sm ${region === 'global' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => setRegion('global')}
        >
          Global
        </button>
      </div>

      {/* Layer Toggles */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          background: 'rgba(15, 24, 38, 0.92)',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          fontSize: 11,
          backdropFilter: 'blur(8px)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBlizzards}
            onChange={(e) => setShowBlizzards(e.target.checked)}
          />
          <span style={{ color: '#f4614b', fontWeight: 500 }}>🌪️ Blizzard Warnings</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showCrevasses}
            onChange={(e) => setShowCrevasses(e.target.checked)}
          />
          <span style={{ color: '#f4b860', fontWeight: 500 }}>⚠️ Crevasse Zones</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showSeaIce}
            onChange={(e) => setShowSeaIce(e.target.checked)}
          />
          <span style={{ color: '#7fd8f0', fontWeight: 500 }}>🧊 Fast-Ice Limit</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showRoutes}
            onChange={(e) => setShowRoutes(e.target.checked)}
          />
          <span style={{ color: '#a9bccb', fontWeight: 500 }}>🚚 Convoy Routes</span>
        </label>
      </div>

      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
    </div>
  )
}
