"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"

// Custom icons
const pickupIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const deliveryIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const riderIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface OrderMapProps {
  pickupLat?: number | null
  pickupLng?: number | null
  pickupAddress?: string
  deliveryLat?: number | null
  deliveryLng?: number | null
  deliveryAddress?: string
  riderLat?: number | null
  riderLng?: number | null
  showRoute?: boolean
  height?: string
}

// Component to fit bounds
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [points, map])
  
  return null
}

export default function OrderMap({
  pickupLat,
  pickupLng,
  pickupAddress,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  riderLat,
  riderLng,
  showRoute = true,
  height = "200px",
}: OrderMapProps) {
  const [route, setRoute] = useState<[number, number][]>([])

  // Default center (Manila)
  const defaultCenter: [number, number] = [14.5995, 120.9842]
  
  // Determine center and points
  const points: [number, number][] = []
  if (pickupLat && pickupLng) points.push([pickupLat, pickupLng])
  if (deliveryLat && deliveryLng) points.push([deliveryLat, deliveryLng])
  if (riderLat && riderLng) points.push([riderLat, riderLng])
  
  const center = points.length > 0 ? points[0] : defaultCenter

  // Fetch route from OSRM (free routing service)
  useEffect(() => {
    if (!showRoute) return
    
    const fetchRoute = async () => {
      if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}?overview=full&geometries=geojson`
          )
          const data = await response.json()
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates.map(
              (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
            )
            setRoute(coords)
          }
        } catch (error) {
          console.error("Route fetch error:", error)
          // Fallback to straight line
          setRoute([
            [pickupLat, pickupLng],
            [deliveryLat, deliveryLng],
          ])
        }
      }
    }
    
    fetchRoute()
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, showRoute])

  if (points.length === 0) {
    return (
      <div 
        className="bg-[#ff8303]/10 rounded-lg flex items-center justify-center text-[#6b6b6b] text-sm"
        style={{ height }}
      >
        No location data available
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden border border-[#ff8303]/30 relative z-0" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Fit all points in view */}
        <FitBounds points={points} />
        
        {/* Pickup Marker */}
        {pickupLat && pickupLng && (
          <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-green-600">📦 Pickup</strong>
                <p className="mt-1 text-xs">{pickupAddress || "Pickup location"}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Delivery Marker */}
        {deliveryLat && deliveryLng && (
          <Marker position={[deliveryLat, deliveryLng]} icon={deliveryIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">📍 Delivery</strong>
                <p className="mt-1 text-xs">{deliveryAddress || "Delivery location"}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Rider Marker */}
        {riderLat && riderLng && (
          <Marker position={[riderLat, riderLng]} icon={riderIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-blue-600">🏍️ Rider</strong>
                <p className="mt-1 text-xs">Current location</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Route Line */}
        {showRoute && route.length > 0 && (
          <Polyline 
            positions={route} 
            color="#fd5602" 
            weight={4} 
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  )
}

