"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, MapPin, User, Phone, Package, 
  Clock, Truck, CheckCircle2, XCircle, Copy,
  CreditCard, Camera, RefreshCw, Scan,
  type LucideIcon
} from "lucide-react"
import { OrderMap, LeafletCSS } from "@/components/maps/dynamic-maps"
import type { Order } from "@/types"

interface AdminOrderDetailsProps {
  order: Order
  onBack: () => void
  onUpdate: () => void
}

export default function AdminOrderDetails({ order: initialOrder, onBack, onUpdate }: AdminOrderDetailsProps) {

  const [order, setOrder] = useState<Order>(initialOrder)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showUpdateFlash, setShowUpdateFlash] = useState(false)
  const [riderDetails, setRiderDetails] = useState<{ full_name: string; phone: string } | null>(null)
  const supabase = createClient()

  // Track if realtime is working
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)

  // Sync with initialOrder prop when it changes
  useEffect(() => {
    setOrder(initialOrder)
  }, [initialOrder])

  // Fetch rider details when rider_id is present
  useEffect(() => {
    async function fetchRiderDetails() {
      if (order.rider_id) {
        const { data } = await supabase
          .from('users')
          .select('full_name,phone')
          .eq('id', order.rider_id)
          .single()
        if (data) {
          setRiderDetails({ full_name: data.full_name, phone: data.phone })
        } else {
          setRiderDetails(null)
        }
      } else {
        setRiderDetails(null)
      }
    }
    fetchRiderDetails()
  }, [order.rider_id, supabase])

  // Define columns to select (exclude large fields like pod_photo_url for polling)
  const orderColumnsForPolling = `
    id,
    order_number,
    package_description,
    cod_amount,
    barcode,
    barcode_image_url,
    pickup_address,
    pickup_latitude,
    pickup_longitude,
    pickup_contact_name,
    pickup_contact_phone,
    delivery_address,
    delivery_latitude,
    delivery_longitude,
    delivery_contact_name,
    delivery_contact_phone,
    status,
    payment_method,
    rider_id,
    accepted_at,
    picked_up_at,
    arrived_at,
    payment_confirmed_at,
    completed_at,
    created_at,
    updated_at
  `

  // Subscribe to real-time updates for this specific order
  useEffect(() => {
    // Only subscribe/poll if order is not completed or failed
    if (order.status === "completed" || order.status === "failed") {
      return
    }

    // Polling fallback - check for updates every 15 seconds (only if realtime not active)
    let lastStatus = order.status
    let lastUpdatedAt = order.updated_at
    
    const pollInterval = setInterval(async () => {
      // Skip polling if realtime is working
      if (isRealtimeActive) return
      
      const { data } = await supabase
        .from("orders")
        .select(orderColumnsForPolling)
        .eq("id", order.id)
        .single()
      
      if (data && (data.status !== lastStatus || data.updated_at !== lastUpdatedAt)) {
        console.log("Order updated via polling:", data)
        lastStatus = data.status
        lastUpdatedAt = data.updated_at
        setOrder(data as Order)
        setLastUpdated(new Date())
        setShowUpdateFlash(true)
        setTimeout(() => setShowUpdateFlash(false), 2000)
        onUpdate()
      }
    }, 15000) // Increased from 3s to 15s

    // Real-time subscription (preferred)
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "orders",
          filter: `id=eq.${order.id}`
        },
        (payload) => {
          console.log("Order updated in real-time:", payload)
          setOrder(payload.new as Order)
          setLastUpdated(new Date())
          setShowUpdateFlash(true)
          setTimeout(() => setShowUpdateFlash(false), 2000)
          onUpdate()
        }
      )
      .subscribe((status) => {
        console.log(`Order ${order.id} subscription status:`, status)
        if (status === "SUBSCRIBED") {
          setIsRealtimeActive(true)
        } else {
          setIsRealtimeActive(false)
        }
      })

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [order.id, isRealtimeActive])

  // Manual refresh function - includes all fields including POD photo
  const handleRefresh = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from("orders")
      .select(`
        *,
        pod_photo_url
      `)
      .eq("id", order.id)
      .single()
    
    if (data) {
      setOrder(data as Order)
      setLastUpdated(new Date())
    }
    setIsLoading(false)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-blue-500",
      accepted: "bg-cyan-500",
      picked_up: "bg-indigo-500",
      delivering: "bg-amber-500",
      arrived: "bg-purple-500",
      payment_pending: "bg-orange-500",
      payment_confirmed: "bg-teal-500",
      completed: "bg-green-500",
      failed: "bg-red-500",
    }
    return colors[status] || "bg-slate-500"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending - Waiting for Rider",
      accepted: "Accepted - Rider En Route to Pickup",
      picked_up: "Picked Up - Package Verified",
      delivering: "Delivering - On Route to Customer",
      arrived: "Arrived - At Customer Location",
      payment_pending: "Payment Pending",
      payment_confirmed: "Payment Confirmed",
      completed: "Completed",
      failed: "Failed",
    }
    return labels[status] || status
  }

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return
    
    setIsLoading(true)
    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", order.id)
    
    setIsLoading(false)
    onUpdate()
    onBack()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Progress bar steps - same as rider panel
  const steps = [
    { key: "en_route_pickup", label: "To Pickup", icon: Truck },
    { key: "at_pickup", label: "Scan", icon: Scan },
    { key: "delivering", label: "Deliver", icon: Package },
    { key: "payment", label: "Payment", icon: CreditCard },
    { key: "proof", label: "POD", icon: Camera },
    { key: "completed", label: "Done", icon: CheckCircle2 },
  ]

  // Map database status to progress bar step
  const statusToStep: Record<string, string> = {
    "pending": "en_route_pickup",
    "accepted": "en_route_pickup",
    "picked_up": "delivering",
    "delivering": "delivering",
    "arrived": "payment",
    "payment_pending": "payment",
    "payment_confirmed": "proof",
    "completed": "completed",
  }
  
  const currentStep = statusToStep[order.status] || "en_route_pickup"
  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="min-h-screen bg-[#fffdf9]">
      {/* Load Leaflet CSS */}
      <LeafletCSS />
      
      {/* Header */}
      <header className="bg-white border-b border-[#ff8303]/30 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#2d2d2d]">{order.order_number}</h1>
            <p className="text-[10px] text-[#6b6b6b]">
              {lastUpdated ? (
                <span className="text-[#fd5602]">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : (
                "Order Details"
              )}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Badge className="bg-[#ff8303]/50 text-[#2d2d2d] border-0 text-[10px]">
            {order.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Real-time Update Flash */}
        {showUpdateFlash && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in duration-300">
            <div className="bg-[#fd5602] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm">
              <RefreshCw className="w-3 h-3" />
              <span className="font-medium">Updated!</span>
            </div>
          </div>
        )}

        {/* Live Status Indicator for active orders */}
        {order.status !== "completed" && order.status !== "failed" && (
          <div className="flex items-center justify-center gap-2 text-xs text-[#fd5602] bg-[#ff8303]/20 rounded-lg py-2 border border-[#ff8303]/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fd5602] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fd5602]"></span>
            </span>
            Live updates enabled
          </div>
        )}

        {/* Progress Bar - Cell Style with Icons (same as rider panel) */}
        <Card className="p-2 border border-[#ff8303]/30">
          <div className="flex gap-1">
            {steps.map((s, i) => {
              const Icon = s.icon
              const isActive = i <= currentStepIndex
              const isCurrent = s.key === currentStep
              return (
                <div
                  key={s.key}
                  className={`flex-1 py-2 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isCurrent
                      ? "bg-[#fd5602] text-white ring-2 ring-[#fd5602]/30"
                      : isActive
                      ? "bg-[#fd5602] text-white"
                      : "bg-[#ff8303]/10 text-[#6b6b6b]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[7px] font-medium leading-tight text-center">
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Package Description */}
        {order.package_description && (
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-[#fd5602]" />
              </div>
              <div>
                <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide">PACKAGE</p>
                <p className="text-sm font-semibold text-[#2d2d2d]">{order.package_description}</p>
              </div>
            </div>
          </Card>
        )}

        {/* COD Amount */}
        <Card className="p-4 bg-white border border-[#ff8303]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#fd5602]/10 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#fd5602]" />
              </div>
              <div>
                <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide">COD AMOUNT</p>
                <p className="text-2xl font-bold text-[#fd5602]">
                  ₱{order.cod_amount.toLocaleString()}
                </p>
              </div>
            </div>
            {order.payment_method && (
              <Badge className="bg-[#ff8303]/20 text-[#fd5602] border-0 text-[10px]">
                {order.payment_method.toUpperCase()}
              </Badge>
            )}
          </div>
        </Card>

        {/* Barcode */}
        <Card className="p-4 bg-white border border-[#ff8303]/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-[#fd5602]" />
            </div>
            <h3 className="font-semibold text-[#2d2d2d] text-sm">Barcode</h3>
          </div>
          
          <div className="bg-[#fffdf9] p-3 rounded-lg border border-[#ff8303]/20 text-center">
            {order.barcode_image_url ? (
              <img 
                src={order.barcode_image_url} 
                alt="Barcode"
                className="mx-auto max-h-16"
              />
            ) : (
              <div className="h-16 flex items-center justify-center">
                <p className="text-[#6b6b6b] text-sm">No barcode image</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="font-mono text-xs text-[#2d2d2d]">{order.barcode}</p>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => copyToClipboard(order.barcode)}
                className="h-6 w-6 p-0 text-[#6b6b6b] hover:text-[#fd5602] hover:bg-[#ff8303]/10"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Pickup Info */}
        <Card className="p-4 bg-white border border-[#ff8303]/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-green-500/10 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-[#2d2d2d] text-sm">Pickup</h3>
          </div>
          
          {/* Map for pickup location */}
          {order.pickup_latitude && order.pickup_longitude && (
            <div className="mb-2">
              <OrderMap
                pickupLat={order.pickup_latitude}
                pickupLng={order.pickup_longitude}
                pickupAddress={order.pickup_address}
                showRoute={false}
                height="120px"
              />
            </div>
          )}
          
          {/* Address */}
          <div className="bg-[#ff8303]/10 rounded-lg p-3 text-sm text-[#2d2d2d] break-words mb-2">
            {order.pickup_address}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b6b]">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {order.pickup_contact_name}
            </span>
            {order.pickup_contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {order.pickup_contact_phone}
              </span>
            )}
          </div>
        </Card>

        {/* Delivery Info */}
        <Card className="p-4 bg-white border border-[#ff8303]/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="font-semibold text-[#2d2d2d] text-sm">Delivery</h3>
          </div>
          
          {/* Map for delivery location */}
          {order.delivery_latitude && order.delivery_longitude && (
            <div className="mb-2">
              <OrderMap
                deliveryLat={order.delivery_latitude}
                deliveryLng={order.delivery_longitude}
                deliveryAddress={order.delivery_address}
                showRoute={false}
                height="120px"
              />
            </div>
          )}
          
          {/* Address */}
          <div className="bg-[#ff8303]/10 rounded-lg p-3 text-sm text-[#2d2d2d] break-words mb-2">
            {order.delivery_address}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b6b]">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {order.delivery_contact_name}
            </span>
            {order.delivery_contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {order.delivery_contact_phone}
              </span>
            )}
          </div>
        </Card>

        {/* Rider Assignment */}
        {order.rider_id && (
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
                <Truck className="w-4 h-4 text-[#fd5602]" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d] text-sm">Rider</h3>
            </div>
            <p className="text-xs text-[#6b6b6b]">ID: {order.rider_id}</p>
            {riderDetails && (
              <div className="mt-1 text-xs text-[#2d2d2d]">
                <span className="font-medium">Name:</span> {riderDetails.full_name}<br />
                <span className="font-medium">Phone:</span> {riderDetails.phone}
              </div>
            )}
            {order.accepted_at && (
              <p className="text-[10px] text-[#6b6b6b] mt-1">
                Accepted: {new Date(order.accepted_at).toLocaleString()}
              </p>
            )}
          </Card>
        )}

        {/* Proof of Delivery */}
        {order.pod_photo_url && (
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-[#fd5602]" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d] text-sm">Proof of Delivery</h3>
            </div>
            <img 
              src={order.pod_photo_url} 
              alt="Proof of Delivery"
              className="rounded-lg w-full"
            />
            {order.pod_latitude && order.pod_longitude && (
              <p className="text-[10px] text-[#6b6b6b] mt-2">
                📍 {order.pod_latitude}, {order.pod_longitude}
              </p>
            )}
          </Card>
        )}

        {/* Cash Audit Note */}
        {order.cash_audit_note && (
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[#fd5602]" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d] text-sm">Cash Note</h3>
            </div>
            <p className="text-xs text-[#6b6b6b]">{order.cash_audit_note}</p>
          </Card>
        )}

        {/* Timestamps */}
        <Card className="p-4 bg-white border border-[#ff8303]/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#fd5602]" />
            </div>
            <h3 className="font-semibold text-[#2d2d2d] text-sm">Timeline</h3>
          </div>
          
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6b6b6b]">Created</span>
              <span className="text-[#2d2d2d]">{new Date(order.created_at).toLocaleString()}</span>
            </div>
            {order.accepted_at && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b]">Accepted</span>
                <span className="text-[#2d2d2d]">{new Date(order.accepted_at).toLocaleString()}</span>
              </div>
            )}
            {order.picked_up_at && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b]">Picked Up</span>
                <span className="text-[#2d2d2d]">{new Date(order.picked_up_at).toLocaleString()}</span>
              </div>
            )}
            {order.arrived_at && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b]">Arrived</span>
                <span className="text-[#2d2d2d]">{new Date(order.arrived_at).toLocaleString()}</span>
              </div>
            )}
            {order.payment_confirmed_at && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b]">Payment</span>
                <span className="text-[#2d2d2d]">{new Date(order.payment_confirmed_at).toLocaleString()}</span>
              </div>
            )}
            {order.completed_at && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b]">Completed</span>
                <span className="text-[#fd5602] font-medium">{new Date(order.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        {order.status !== "completed" && order.status !== "failed" && (
          <Button
            onClick={handleCancelOrder}
            disabled={isLoading}
            variant="outline"
            className="w-full h-12 text-red-500 border-red-200 hover:bg-red-50 text-sm font-medium"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel Order
          </Button>
        )}
      </div>
    </div>
  )
}

