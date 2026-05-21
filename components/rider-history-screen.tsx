"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar, CreditCard, Loader2, MapPin, Package, RefreshCw } from "lucide-react"
import type { Order } from "@/types"

interface RiderHistoryScreenProps {
  riderId: string
}

function formatDate(value: string | null) {
  if (!value) return "--"

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getPaymentStatus(order: Order) {
  if (order.status === "failed") return "Failed"
  if (order.payment_error) return "Issue"
  if (order.status === "completed") return "Confirmed"
  return "Pending"
}

export default function RiderHistoryScreen({ riderId }: RiderHistoryScreenProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
  }, [riderId])

  const fetchHistory = async () => {
    setIsRefreshing(true)

    const { data } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        package_description,
        cod_amount,
        delivery_address,
        delivery_contact_name,
        delivery_contact_phone,
        status,
        payment_method,
        payment_error,
        rider_id,
        completed_at,
        created_at,
        updated_at
      `)
      .eq("rider_id", riderId)
      .in("status", ["completed", "failed"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100)

    setOrders((data as Order[]) || [])
    setIsLoading(false)
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#fd5602] mb-4" />
        <p className="text-[#6b6b6b]">Loading history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#2d2d2d]">History</h2>
          <p className="text-[#6b6b6b] text-xs">{orders.length} past order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          onClick={fetchHistory}
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          className="text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card className="p-8 text-center bg-white border border-[#ff8303]/30">
          <Package className="w-10 h-10 mx-auto text-[#ff8303] mb-3" />
          <p className="text-[#2d2d2d] font-semibold">No past orders yet</p>
          <p className="text-[#6b6b6b] text-xs mt-1">Completed and failed deliveries appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-4 bg-white border border-[#ff8303]/30">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#2d2d2d]">{order.order_number}</h3>
                    <Badge className={order.status === "completed" ? "bg-green-100 text-green-800 border-0 text-[10px]" : "bg-red-100 text-red-800 border-0 text-[10px]"}>
                      {order.status === "completed" ? "Completed" : "Failed"}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#2d2d2d]">{order.delivery_contact_name}</p>
                </div>
                <p className="text-xl font-black text-[#fd5602]">₱{order.cod_amount.toLocaleString()}</p>
              </div>

              <div className="space-y-2 text-xs text-[#6b6b6b]">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#fd5602] mt-0.5 flex-shrink-0" />
                  <span className="break-words">{order.delivery_address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#fd5602]" />
                  <span>{order.completed_at ? `Completed ${formatDate(order.completed_at)}` : `Created ${formatDate(order.created_at)}`}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#ff8303]/10 border border-[#ff8303]/30 px-3 py-2">
                  <span className="flex items-center gap-2 text-[#2d2d2d] font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-[#fd5602]" />
                    {order.payment_method ? order.payment_method.toUpperCase() : "NO METHOD"}
                  </span>
                  <span className="font-semibold text-[#6b6b6b]">{getPaymentStatus(order)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
