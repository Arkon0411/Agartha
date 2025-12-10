"use client"

import { useEffect } from "react"

// Component to load Leaflet CSS
export default function LeafletCSS() {
  useEffect(() => {
    // Check if CSS is already loaded
    const existingLink = document.querySelector('link[href*="leaflet.css"]')
    if (existingLink) return

    // Load Leaflet CSS
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    link.crossOrigin = ""
    document.head.appendChild(link)

    return () => {
      // Cleanup on unmount (optional)
    }
  }, [])

  return null
}

