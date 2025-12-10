"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Search, MapPin, Loader2, X } from "lucide-react"
import L from "leaflet"

// Fix for default marker icons in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface Location {
  lat: number
  lng: number
  address: string
}

interface LocationPickerProps {
  value?: Location | null
  onChange: (location: Location) => void
  placeholder?: string
  label?: string
}

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Component to recenter map
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

// Geocoding using Nominatim (free, no API key)
async function searchAddress(query: string): Promise<Array<{ lat: number; lng: number; display_name: string }>> {
  if (!query || query.length < 3) return []
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=5`,
      {
        headers: {
          "User-Agent": "AgarthaCODApp/1.0",
        },
      }
    )
    const data = await response.json()
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: item.display_name,
    }))
  } catch (error) {
    console.error("Geocoding error:", error)
    return []
  }
}

// Reverse geocoding - get address from coordinates
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "AgarthaCODApp/1.0",
        },
      }
    )
    const data = await response.json()
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch (error) {
    console.error("Reverse geocoding error:", error)
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

export default function LocationPicker({ value, onChange, placeholder = "Search address...", label }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ lat: number; lng: number; display_name: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Default center (Manila, Philippines)
  const defaultCenter = { lat: 14.5995, lng: 120.9842 }
  const center = value ? { lat: value.lat, lng: value.lng } : defaultCenter

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length >= 3) {
      setIsSearching(true)
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await searchAddress(searchQuery)
        setSearchResults(results)
        setShowResults(true)
        setIsSearching(false)
      }, 500) // 500ms debounce to respect Nominatim rate limits
    } else {
      setSearchResults([])
      setShowResults(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // Handle map click - reverse geocode to get address
  const handleMapClick = async (lat: number, lng: number) => {
    setIsLoadingAddress(true)
    const address = await reverseGeocode(lat, lng)
    onChange({ lat, lng, address })
    setSearchQuery("")
    setShowResults(false)
    setIsLoadingAddress(false)
  }

  // Handle search result selection
  const handleSelectResult = (result: { lat: number; lng: number; display_name: string }) => {
    onChange({ lat: result.lat, lng: result.lng, address: result.display_name })
    setSearchQuery("")
    setShowResults(false)
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-[#2d2d2d]">{label}</label>}
      
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="pl-10 pr-10 h-11 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
          />
          {(isSearching || isLoadingAddress) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fd5602] animate-spin" />
          )}
          {searchQuery && !isSearching && (
            <button
              onClick={() => {
                setSearchQuery("")
                setShowResults(false)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#2d2d2d]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto border border-[#ff8303]/30 shadow-lg">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectResult(result)}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#ff8303]/10 border-b border-[#ff8303]/10 last:border-0 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 text-[#fd5602] flex-shrink-0 mt-0.5" />
                <span className="text-[#2d2d2d] line-clamp-2">{result.display_name}</span>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Selected Address Display */}
      {value && (
        <div className="flex items-start gap-2 p-2 bg-[#ff8303]/10 rounded-lg text-sm">
          <MapPin className="w-4 h-4 text-[#fd5602] flex-shrink-0 mt-0.5" />
          <span className="text-[#2d2d2d] line-clamp-2">{value.address}</span>
        </div>
      )}

      {/* Map */}
      <div className="h-48 rounded-lg overflow-hidden border border-[#ff8303]/30 relative z-0">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={value ? 16 : 12}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          {value && (
            <>
              <Marker position={[value.lat, value.lng]} icon={defaultIcon} />
              <MapRecenter lat={value.lat} lng={value.lng} />
            </>
          )}
        </MapContainer>
      </div>
      
      <p className="text-xs text-[#6b6b6b]">
        Search for an address or tap on the map to select location
      </p>
    </div>
  )
}

