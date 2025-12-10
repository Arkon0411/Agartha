"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, ChevronRight, Package, RefreshCw, Loader2 } from "lucide-react"
import type { Order } from "@/types"

interface OrderQueueScreenProps {
  riderId: string
  onSelectOrder: (order: Order) => void
}

export default function OrderQueueScreen({ riderId, onSelectOrder }: OrderQueueScreenProps) {
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [riderId])

  const fetchOrders = async () => {
    setIsLoading(true)
    
    // Define the columns needed for order display (exclude large fields like pod_photo_url)
    const orderColumns = `
      id,
      order_number,
      package_description,
      cod_amount,
      barcode,
      pickup_address,
      pickup_contact_name,
      pickup_contact_phone,
      delivery_address,
      delivery_contact_name,
      delivery_contact_phone,
      status,
      payment_method,
      rider_id,
      accepted_at,
      created_at,
      completed_at
    `
    
    // Fetch available orders (pending, no rider assigned)
    const { data: available } = await supabase
      .from("orders")
      .select(orderColumns)
      .eq("status", "pending")
      .is("rider_id", null)
      .order("created_at", { ascending: false })
      .limit(20)

    // Fetch my active orders
    const { data: mine } = await supabase
      .from("orders")
      .select(orderColumns)
      .eq("rider_id", riderId)
      .not("status", "in", '("completed","failed")')
      .order("created_at", { ascending: false })
      .limit(10)

    // Fetch my completed orders (today) - limited to 5 for summary
    const today = new Date().toISOString().split("T")[0]
    const { data: completed } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        cod_amount,
        delivery_contact_name,
        payment_method,
        completed_at
      `)
      .eq("rider_id", riderId)
      .eq("status", "completed")
      .gte("completed_at", today)
      .order("completed_at", { ascending: false })
      .limit(5)

    setAvailableOrders((available as Order[]) || [])
    setMyOrders((mine as Order[]) || [])
    setCompletedOrders((completed as Order[]) || [])
    setIsLoading(false)
  }

  const handleAcceptOrder = async (order: Order) => {
    setAcceptingOrderId(order.id)

    const { error } = await supabase
      .from("orders")
      .update({
        rider_id: riderId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending") // Only accept if still pending
      .is("rider_id", null)

    if (!error) {
      // Immediately select the order to start delivery
      const updatedOrder = { ...order, rider_id: riderId, status: "accepted" as const }
      onSelectOrder(updatedOrder)
    }

    setAcceptingOrderId(null)
    fetchOrders()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-blue-100 text-blue-800",
      accepted: "bg-cyan-100 text-cyan-800",
      picked_up: "bg-indigo-100 text-indigo-800",
      delivering: "bg-amber-100 text-amber-800",
      arrived: "bg-purple-100 text-purple-800",
      payment_pending: "bg-orange-100 text-orange-800",
      payment_confirmed: "bg-teal-100 text-teal-800",
      completed: "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-slate-100 text-slate-800"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Available",
      accepted: "Accepted",
      picked_up: "Picked Up",
      delivering: "Delivering",
      arrived: "Arrived",
      payment_pending: "Payment",
      payment_confirmed: "Paid",
      completed: "Completed",
    }
    return labels[status] || status
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#fd5602] mb-4" />
        <p className="text-[#6b6b6b]">Loading orders...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#2d2d2d]">Orders</h2>
          <p className="text-[#6b6b6b] text-xs">
            {myOrders.length} active • {availableOrders.length} available
          </p>
        </div>
        <Button 
          onClick={fetchOrders} 
          variant="ghost" 
          size="sm" 
          className="text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* My Active Orders */}
      {myOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#fd5602] mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Active Orders
          </h3>
          <div className="space-y-2">
            {myOrders.map((order) => (
              <Card
                key={order.id}
                className="p-4 bg-[#ff8303]/20 border border-[#fd5602]/30 hover:border-[#fd5602] transition-colors cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-bold text-[#2d2d2d]">{order.order_number}</h4>
                      <Badge className="bg-[#fd5602]/20 text-[#fd5602] border-0 text-[10px]">
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-[#6b6b6b] mb-1">
                      <MapPin className="w-3 h-3 text-[#fd5602] flex-shrink-0 mt-0.5" />
                      <span className="break-words line-clamp-2">{order.delivery_address}</span>
                    </div>

                    {order.package_description && (
                      <div className="flex items-center gap-1 text-xs text-[#6b6b6b] bg-white/50 px-1.5 py-0.5 rounded w-fit mb-1">
                        <Package className="w-3 h-3 text-[#fd5602]" />
                        <span>{order.package_description}</span>
                      </div>
                    )}

                    <p className="text-xs text-[#2d2d2d]">
                      {order.delivery_contact_name}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <p className="text-lg font-bold text-[#fd5602]">
                      ₱{order.cod_amount.toLocaleString()}
                    </p>
                    <ChevronRight className="w-5 h-5 text-[#fd5602]" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Orders */}
      <div>
        <h3 className="text-sm font-semibold text-[#6b6b6b] mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Available Orders
        </h3>

        {availableOrders.length === 0 ? (
          <Card className="p-8 text-center bg-white border border-[#ff8303]/30">
            <Package className="w-10 h-10 mx-auto text-[#ff8303] mb-3" />
            <p className="text-[#6b6b6b]">No orders available</p>
            <p className="text-[#6b6b6b]/60 text-xs mt-1">Pull to refresh</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {availableOrders.map((order) => (
              <Card
                key={order.id}
                className="p-4 bg-white border border-[#ff8303]/30 hover:border-[#fd5602]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-bold text-[#2d2d2d]">{order.order_number}</h4>
                      <Badge className="bg-[#ff8303]/50 text-[#2d2d2d] border-0 text-[10px]">New</Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#6b6b6b]">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="break-words line-clamp-2">{order.pickup_address}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="break-words line-clamp-2">{order.delivery_address}</span>
                      </div>
                      {order.package_description && (
                        <div className="flex items-start gap-1.5">
                          <Package className="w-3 h-3 text-[#fd5602] flex-shrink-0 mt-0.5" />
                          <span className="break-words">{order.package_description}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#6b6b6b]">
                      <Clock className="w-3 h-3" />
                      {new Date(order.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-[#6b6b6b] mb-0.5">COD</p>
                    <p className="text-xl font-bold text-[#fd5602]">
                      ₱{order.cod_amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => handleAcceptOrder(order)}
                  disabled={acceptingOrderId === order.id}
                  className="w-full h-16 text-lg font-semibold bg-[#fd5602] hover:bg-[#e54d00] text-white"
                >
                  {acceptingOrderId === order.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Accept Order"
                  )}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Today */}
      {completedOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#6b6b6b] mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Completed Today
          </h3>
          <div className="space-y-1.5">
            {completedOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-white border border-[#ff8303]/30 rounded-lg"
              >
                <div>
                  <span className="font-medium text-[#2d2d2d] text-sm">{order.order_number}</span>
                  <span className="text-[#6b6b6b] text-xs ml-2">
                    {order.delivery_contact_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#fd5602] text-sm">
                    ₱{order.cod_amount.toLocaleString()}
                  </span>
                  <Badge className="bg-[#ff8303]/50 text-[#2d2d2d] border-0 text-[10px]">
                    {order.payment_method?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
