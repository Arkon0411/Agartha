"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  DollarSign, Calendar, CheckCircle2, QrCode, Banknote, 
  RefreshCw, Loader2, ArrowLeft, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Order } from "@/types"

interface RiderSettlementDashboardProps {
  riderId: string
}

interface SettlementStats {
  totalDeliveries: number
  completedDeliveries: number
  qrphAmount: number
  qrphCount: number
  cashAmount: number
  cashCount: number
  totalCollected: number
}

interface SettlementRecord {
  id: string
  rider_id: string
  date: string
  amount: number
  payment_reference: string
  settled_at: string
  status: "pending" | "confirmed"
  amount_paid?: number
}

export default function RiderSettlementDashboard({ riderId }: RiderSettlementDashboardProps) {
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [recentDeliveries, setRecentDeliveries] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  
  // Settlement states
  const [showSettlement, setShowSettlement] = useState(false)
  const [settlementStep, setSettlementStep] = useState<"waiting" | "success">("waiting")
  const [todaySettlement, setTodaySettlement] = useState<SettlementRecord | null>(null)
  const [staticQrUrl, setStaticQrUrl] = useState<string | null>(null)
  const [settlementId, setSettlementId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [amountPaid, setAmountPaid] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    fetchSettlement()

    // Subscribe to real-time updates for settlements
    const channel = supabase
      .channel("settlements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_settlements", filter: `rider_id=eq.${riderId}` },
        () => {
          fetchSettlement()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [riderId, selectedDate])

  const fetchSettlement = async () => {
    setIsLoading(true)

    // Fetch completed orders for the selected date - only needed columns
    const startOfDay = `${selectedDate}T00:00:00`
    const endOfDay = `${selectedDate}T23:59:59`

    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        cod_amount,
        payment_method,
        delivery_contact_name,
        completed_at
      `)
      .eq("rider_id", riderId)
      .eq("status", "completed")
      .gte("completed_at", startOfDay)
      .lte("completed_at", endOfDay)
      .order("completed_at", { ascending: false })
      .limit(50)

    // Check if there's already a settlement for this date
    const { data: settlement } = await supabase
      .from("rider_settlements")
      .select("*")
      .eq("rider_id", riderId)
      .eq("date", selectedDate)
      .single()

    // Only show as settled if status is confirmed
    if (settlement && settlement.status === "confirmed") {
      setTodaySettlement(settlement as SettlementRecord)
    } else {
      setTodaySettlement(null)
    }

    if (orders) {
      const completedOrders = orders as Order[]
      
      const qrphOrders = completedOrders.filter(o => o.payment_method === "qrph")
      const cashOrders = completedOrders.filter(o => o.payment_method === "cash")

      setStats({
        totalDeliveries: completedOrders.length,
        completedDeliveries: completedOrders.length,
        qrphAmount: qrphOrders.reduce((sum, o) => sum + o.cod_amount, 0),
        qrphCount: qrphOrders.length,
        cashAmount: cashOrders.reduce((sum, o) => sum + o.cod_amount, 0),
        cashCount: cashOrders.length,
        totalCollected: completedOrders.reduce((sum, o) => sum + o.cod_amount, 0),
      })

      setRecentDeliveries(completedOrders.slice(0, 10))
    } else {
      setStats({
        totalDeliveries: 0,
        completedDeliveries: 0,
        qrphAmount: 0,
        qrphCount: 0,
        cashAmount: 0,
        cashCount: 0,
        totalCollected: 0,
      })
      setRecentDeliveries([])
    }

    setIsLoading(false)
  }

  const handleStartSettlement = async () => {
    setShowSettlement(true)
    setSettlementStep("waiting")
    setAmountPaid(0)
    setIsPolling(true)
    
    // Initiate settlement
    try {
      const response = await fetch("/api/settlements/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderId: riderId,
          date: selectedDate,
          amount: stats?.cashAmount || 0,
        }),
      })
      const data = await response.json()
      
      if (data.success) {
        setStaticQrUrl(data.staticQrImageUrl)
        setSettlementId(data.settlementId)
      } else {
        console.error("Settlement initiation error:", data.error)
        // Close modal on error
        setShowSettlement(false)
        setIsPolling(false)
      }
    } catch (err) {
      console.error("Settlement initiation error:", err)
      setShowSettlement(false)
      setIsPolling(false)
    }
  }

  // Poll for settlement confirmation via webhook
  useEffect(() => {
    if (!isPolling || !settlementId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/settlements/check-status?settlementId=${settlementId}`)
        const data = await response.json()

        if (data.amountPaid > amountPaid) {
          setAmountPaid(data.amountPaid)
        }

        if (data.isSettlementComplete) {
          // Settlement confirmed via webhook!
          setIsPolling(false)
          setSettlementStep("success")
          setTodaySettlement({
            id: settlementId,
            rider_id: riderId,
            date: selectedDate,
            amount: stats?.cashAmount || 0,
            payment_reference: data.paymentReference || settlementId || "",
            settled_at: data.settledAt || new Date().toISOString(),
            status: "confirmed",
          })
        }
      } catch (err) {
        console.error("Settlement poll error:", err)
      }
    }, 10000) // Poll every 10 seconds (reduced from 3s to save egress)

    return () => clearInterval(pollInterval)
  }, [isPolling, settlementId, amountPaid, riderId, selectedDate, stats?.cashAmount])


  const handleCloseSettlement = () => {
    setShowSettlement(false)
    setSettlementStep("waiting")
    setIsPolling(false)
    // Refresh data to show updated settlement status
    fetchSettlement()
  }

  const isToday = selectedDate === new Date().toISOString().split("T")[0]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 animate-spin text-[#fd5602] mb-4" />
        <p className="text-[#6b6b6b] text-lg">Loading settlement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#2d2d2d]">Earnings</h2>
          <p className="text-[#6b6b6b] flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            {isToday ? "Today" : new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Button onClick={fetchSettlement} variant="outline" size="sm" className="gap-2 border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Date Selector */}
      <Card className="p-3 border border-[#ff8303]/30">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full h-12 px-4 text-lg border border-[#ff8303]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fd5602]/30"
        />
      </Card>

      {!stats || stats.totalDeliveries === 0 ? (
        <Card className="p-8 text-center border border-[#ff8303]/30">
          <div className="w-14 h-14 bg-[#ff8303]/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <DollarSign className="w-7 h-7 text-[#fd5602]" />
          </div>
          <p className="text-[#2d2d2d] text-lg font-medium">No deliveries completed</p>
          <p className="text-[#6b6b6b] text-sm">
            {isToday ? "Start delivering to see your earnings" : "No data for this date"}
          </p>
        </Card>
      ) : (
        <>
          {/* Total Collected */}
          <Card className="p-5 bg-[#fd5602] text-white border-0">
            <p className="text-white/80 text-xs font-medium tracking-wide mb-1">TOTAL COLLECTED</p>
            <p className="text-4xl font-black">₱{stats.totalCollected.toLocaleString()}</p>
            <p className="text-white/80 text-sm mt-2">
              {stats.completedDeliveries} deliveries completed
            </p>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-white border border-[#ff8303]/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-[10px] text-green-600 font-semibold tracking-wide">QRPH</span>
              </div>
              <p className="text-2xl font-bold text-[#2d2d2d]">
                ₱{stats.qrphAmount.toLocaleString()}
              </p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                {stats.qrphCount} transaction{stats.qrphCount !== 1 ? "s" : ""}
              </p>
            </Card>

            <Card className="p-4 bg-white border border-[#ff8303]/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-[10px] text-amber-600 font-semibold tracking-wide">CASH</span>
              </div>
              <p className="text-2xl font-bold text-[#2d2d2d]">
                ₱{stats.cashAmount.toLocaleString()}
              </p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                {stats.cashCount} transaction{stats.cashCount !== 1 ? "s" : ""}
              </p>
            </Card>
          </div>

          {/* Payment Breakdown Bar */}
          <Card className="p-4 border border-[#ff8303]/30">
            <h3 className="font-semibold text-[#2d2d2d] text-sm mb-3">Payment Breakdown</h3>
            
            {stats.totalCollected > 0 && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#6b6b6b]">QRPH</span>
                    <span className="text-xs font-bold text-green-600">
                      {((stats.qrphAmount / stats.totalCollected) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(stats.qrphAmount / stats.totalCollected) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#6b6b6b]">Cash</span>
                    <span className="text-xs font-bold text-amber-600">
                      {((stats.cashAmount / stats.totalCollected) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${(stats.cashAmount / stats.totalCollected) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Settlement Status */}
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            {todaySettlement ? (
              // Already settled
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 text-sm">Settled!</h4>
                    <p className="text-xs text-[#6b6b6b]">
                      ₱{todaySettlement.amount.toLocaleString()} remitted
                    </p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-[10px] text-green-600 font-medium">REFERENCE NUMBER</p>
                  <p className="font-mono text-sm text-green-800">{todaySettlement.payment_reference}</p>
                  <p className="text-[10px] text-green-600 mt-1">
                    {new Date(todaySettlement.settled_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : stats.cashAmount > 0 ? (
              // Has cash to settle
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[#2d2d2d] text-sm mb-1">Cash to Remit</h4>
                    <p className="text-2xl font-bold text-[#fd5602]">
                      ₱{stats.cashAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#6b6b6b] mt-1">
                      Settle via QRPH to complete your daily remittance
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleStartSettlement}
                  className="w-full h-12 bg-[#fd5602] hover:bg-[#e54d00] text-white font-bold"
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  Settle Now via QRPH
                </Button>
              </div>
            ) : (
              // No cash to settle
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-700 text-sm">All Clear!</h4>
                  <p className="text-xs text-[#6b6b6b]">
                    No cash to remit - all payments were via QRPH
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Recent Deliveries */}
          {recentDeliveries.length > 0 && (
            <Card className="p-4 border border-[#ff8303]/30">
              <h3 className="font-semibold text-[#2d2d2d] text-sm mb-3">Recent Deliveries</h3>

              <div className="space-y-2">
                {recentDeliveries.map((delivery) => (
                  <div 
                    key={delivery.id} 
                    className="flex items-center justify-between p-3 bg-[#fffdf9] rounded-xl border border-[#ff8303]/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2d2d2d] text-sm">{delivery.order_number}</p>
                      <p className="text-xs text-[#6b6b6b] truncate">
                        {delivery.delivery_contact_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-[#fd5602]">
                          ₱{delivery.cod_amount.toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        className={
                          delivery.payment_method === "qrph"
                            ? "bg-green-500 text-white text-[10px]"
                            : "bg-amber-500 text-white text-[10px]"
                        }
                      >
                        {delivery.payment_method?.toUpperCase()}
                      </Badge>
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Settlement Modal */}
      {showSettlement && stats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-[#ff8303]/30 flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCloseSettlement}
                className="text-[#6b6b6b] hover:bg-[#ff8303]/10"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="font-bold text-[#2d2d2d]">Cash Settlement</h2>
                <p className="text-xs text-[#6b6b6b]">Remit via QRPH</p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {settlementStep === "waiting" && (
                <>
                  {/* Amount to Settle */}
                  <div className="bg-[#fd5602] text-white rounded-xl p-4 text-center">
                    <p className="text-xs text-white/80 font-medium">AMOUNT TO REMIT</p>
                    <p className="text-3xl font-black">₱{stats.cashAmount.toLocaleString()}</p>
                    {amountPaid > 0 && (
                      <p className="text-sm text-white/90 mt-1">
                        Received: ₱{amountPaid.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Static QRPH QR Code Display */}
                  <div className="bg-white border border-[#ff8303]/30 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-[#2d2d2d] mb-3">Scan to Pay Company</p>
                    
                    <div className="bg-[#fffdf9] p-3 rounded-lg border border-[#ff8303]/20 inline-block">
                      <img 
                        src={staticQrUrl || "/static-qrph.png"} 
                        alt="Company QRPH QR Code" 
                        className="w-44 h-44 object-contain mx-auto"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="hidden w-44 h-44 bg-[#ff8303]/5 rounded-lg flex items-center justify-center">
                        <div className="text-center p-4">
                          <QrCode className="w-12 h-12 text-[#fd5602] mx-auto mb-2" />
                          <p className="text-sm font-bold text-[#fd5602]">QRPH</p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-[#6b6b6b] mt-3">GCash • Maya • Bank Apps</p>
                  </div>

                  {/* Polling indicator */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </div>
                    <p className="text-xs text-green-700">
                      Waiting for payment confirmation...
                    </p>
                  </div>
                </>
              )}


              {settlementStep === "success" && todaySettlement && (
                <>
                  {/* Success */}
                  <div className="text-center py-4">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-700 mb-1">Settlement Complete!</h3>
                    <p className="text-sm text-[#6b6b6b]">
                      Your cash remittance has been recorded
                    </p>
                  </div>

                  {/* Details */}
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-green-600">Amount Settled</span>
                      <span className="font-bold text-green-800">₱{todaySettlement.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-green-600">Reference</span>
                      <span className="font-mono text-sm text-green-800">{todaySettlement.payment_reference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-green-600">Date</span>
                      <span className="text-sm text-green-800">{new Date(todaySettlement.settled_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleCloseSettlement}
                    className="w-full h-12 bg-[#fd5602] hover:bg-[#e54d00] text-white font-bold"
                  >
                    Done
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
