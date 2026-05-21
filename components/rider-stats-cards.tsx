"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2, Route, Trophy, Wallet } from "lucide-react"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

interface RiderStatsCardsProps {
  riderId: string
}

interface CompletedStatsOrder {
  id: string
  cod_amount: number
  pickup_latitude?: number | null
  pickup_longitude?: number | null
  delivery_latitude?: number | null
  delivery_longitude?: number | null
}

function formatPeso(amount: number) {
  return `${String.fromCharCode(8369)}${amount.toLocaleString()}`
}

function getDropoffDistanceKm(order: CompletedStatsOrder) {
  const pickupLatitude = order.pickup_latitude
  const pickupLongitude = order.pickup_longitude
  const deliveryLatitude = order.delivery_latitude
  const deliveryLongitude = order.delivery_longitude

  if (
    typeof pickupLatitude !== "number" ||
    typeof pickupLongitude !== "number" ||
    typeof deliveryLatitude !== "number" ||
    typeof deliveryLongitude !== "number"
  ) {
    return null
  }

  const toRadians = (degrees: number) => degrees * (Math.PI / 180)
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(deliveryLatitude - pickupLatitude)
  const longitudeDelta = toRadians(deliveryLongitude - pickupLongitude)
  const pickupLatRadians = toRadians(pickupLatitude)
  const deliveryLatRadians = toRadians(deliveryLatitude)

  const haversineValue =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(pickupLatRadians) *
      Math.cos(deliveryLatRadians) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
}

export default function RiderStatsCards({ riderId }: RiderStatsCardsProps) {
  const [completedOrders, setCompletedOrders] = useState<CompletedStatsOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let ignore = false

    const fetchCompletedOrders = async () => {
      setIsLoading(true)

      const { data } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          cod_amount,
          pickup_latitude,
          pickup_longitude,
          delivery_latitude,
          delivery_longitude
        `)
        .eq("rider_id", riderId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(500)

      if (!ignore) {
        setCompletedOrders((data as CompletedStatsOrder[]) || [])
        setIsLoading(false)
      }
    }

    fetchCompletedOrders()

    return () => {
      ignore = true
    }
  }, [riderId])

  const completedStats = useMemo(() => {
    const farthestDistance = completedOrders.reduce<number | null>((farthest, order) => {
      const distance = getDropoffDistanceKm(order)
      if (distance === null) return farthest
      if (farthest === null || distance > farthest) return distance
      return farthest
    }, null)

    return {
      completedCount: completedOrders.length,
      totalEarnings: completedOrders.reduce((sum, order) => sum + order.cod_amount, 0),
      farthestDropoff: farthestDistance,
      largestFee: completedOrders.reduce((largest, order) => Math.max(largest, order.cod_amount), 0),
    }
  }, [completedOrders])

  const statsCards = [
    {
      label: "Completed",
      value: completedStats.completedCount.toLocaleString(),
      icon: CheckCircle2,
    },
    {
      label: "Total earning",
      value: formatPeso(completedStats.totalEarnings),
      icon: Wallet,
    },
    {
      label: "Farthest drop-off",
      value: completedStats.farthestDropoff === null ? "--" : `${completedStats.farthestDropoff.toFixed(1)}km`,
      icon: Route,
    },
    {
      label: "Largest fee",
      value: formatPeso(completedStats.largestFee),
      icon: Trophy,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {statsCards.map((stat) => (
          <Card key={stat.label} className="p-3.5 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#fd5602]" />
              <span className="text-[10px] text-[#6b6b6b] font-semibold uppercase tracking-wide truncate">
                {stat.label}
              </span>
            </div>
            <div className="h-6 w-16 mt-2 rounded bg-[#ff8303]/20" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {statsCards.map((stat) => {
        const Icon = stat.icon

        return (
          <Card key={stat.label} className="p-3.5 bg-white border border-[#ff8303]/30">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-[#ff8303]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#fd5602]" />
              </div>
              <span className="text-[10px] text-[#6b6b6b] font-semibold uppercase tracking-wide leading-tight truncate">
                {stat.label}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-[#fd5602] leading-tight truncate">{stat.value}</p>
          </Card>
        )
      })}
    </div>
  )
}
