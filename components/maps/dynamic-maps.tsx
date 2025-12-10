"use client"

import dynamic from "next/dynamic"

// Dynamic imports for map components (Leaflet requires client-side only)
export const LocationPicker = dynamic(
  () => import("./location-picker"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-48 bg-[#ff8303]/10 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-[#6b6b6b] text-sm">Loading map...</span>
      </div>
    )
  }
)

export const OrderMap = dynamic(
  () => import("./order-map"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-48 bg-[#ff8303]/10 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-[#6b6b6b] text-sm">Loading map...</span>
      </div>
    )
  }
)

export const LeafletCSS = dynamic(
  () => import("./leaflet-css"),
  { ssr: false }
)

