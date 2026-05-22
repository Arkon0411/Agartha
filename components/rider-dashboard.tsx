"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import OrderQueueScreen from "./order-queue-screen"
import DeliveryFlowScreen from "./delivery-flow-screen"
import RiderSettlementDashboard from "./rider-settlement-dashboard"
import RiderHistoryScreen from "./rider-history-screen"
import RiderProfileScreen from "./rider-profile-screen"
import RiderStatsCards from "./rider-stats-cards"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LogOut, Package, BarChart3, WifiOff, CloudOff, RefreshCw, Home, History, UserCircle, ChevronRight } from "lucide-react"
import type { Order, User } from "@/types"
import { forceLogout } from "@/lib/utils/logout"

interface RiderDashboardProps {
  user: User
  onUserUpdate?: (user: User) => void
}

// Offline queue storage key
const OFFLINE_QUEUE_KEY = "agartha_offline_queue"

interface QueuedAction {
  id: string
  type: "update_order"
  orderId: string
  data: Record<string, unknown>
  timestamp: number
}

type RiderTab = "home" | "orders" | "history" | "earnings" | "profile"

const navItems: Array<{
  value: RiderTab
  label: string
  icon: typeof Home
}> = [
  { value: "home", label: "Home", icon: Home },
  { value: "orders", label: "Orders", icon: Package },
  { value: "history", label: "History", icon: History },
  { value: "earnings", label: "Earnings", icon: BarChart3 },
  { value: "profile", label: "Profile", icon: UserCircle },
]

export default function RiderDashboard({ user, onUserUpdate }: RiderDashboardProps) {
  const router = useRouter()
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<RiderTab>("home")
  const [isOnline, setIsOnline] = useState(true)
  const [offlineQueue, setOfflineQueue] = useState<QueuedAction[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const supabase = createClient()

  // Monitor online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    // Load offline queue from localStorage
    const savedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue))
    }

    const handleOnline = () => {
      setIsOnline(true)
      // Sync queued actions when back online
      syncOfflineQueue()
    }
    
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Sync offline queue when back online
  const syncOfflineQueue = async () => {
    const savedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!savedQueue) return
    
    const queue: QueuedAction[] = JSON.parse(savedQueue)
    if (queue.length === 0) return

    setIsSyncing(true)
    console.log(`Syncing ${queue.length} offline actions...`)

    const failedActions: QueuedAction[] = []

    for (const action of queue) {
      try {
        if (action.type === "update_order") {
          const { error } = await supabase
            .from("orders")
            .update(action.data)
            .eq("id", action.orderId)

          if (error) {
            console.error("Failed to sync action:", error)
            failedActions.push(action)
          } else {
            console.log(`Synced action for order ${action.orderId}`)
          }
        }
      } catch (err) {
        console.error("Sync error:", err)
        failedActions.push(action)
      }
    }

    // Update queue with only failed actions
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedActions))
    setOfflineQueue(failedActions)
    setIsSyncing(false)
  }

  // Add action to offline queue
  const addToOfflineQueue = (action: Omit<QueuedAction, "id" | "timestamp">) => {
    const newAction: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    const newQueue = [...offlineQueue, newAction]
    setOfflineQueue(newQueue)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue))
    console.log("Action queued for offline sync:", newAction)
  }

  const handleLogout = async () => {
    // Use forceful logout to clear all sessions, storage, and cookies
    await forceLogout()
  }

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order)
  }

  const handleDeliveryComplete = () => {
    // Clear order first, then switch tab after a brief delay to ensure clean unmount
    setActiveOrder(null)
    // Small delay to ensure DeliveryFlowScreen unmounts cleanly before tab switch
    setTimeout(() => {
      setActiveTab("orders")
    }, 50)
  }

  const displayName = user.full_name || user.email

  const renderActivePane = () => {
    if (activeTab === "orders") {
      return (
        <OrderQueueScreen
          riderId={user.id}
          onSelectOrder={handleSelectOrder}
        />
      )
    }

    if (activeTab === "history") {
      return <RiderHistoryScreen riderId={user.id} />
    }

    if (activeTab === "earnings") {
      return <RiderSettlementDashboard riderId={user.id} />
    }

    if (activeTab === "profile") {
      return <RiderProfileScreen user={user} onUserUpdate={onUserUpdate} />
    }

    return (
      <div className="space-y-4">
        <Card className="p-5 bg-[#fd5602] text-white border-0 overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute right-8 bottom-4 w-14 h-14 rounded-full bg-[#ff8303]/40" />
          <div className="relative">
            <p className="text-white/80 text-xs font-semibold tracking-wide">RIDER HOME</p>
            <h2 className="text-2xl font-black mt-1">Welcome, {displayName}</h2>
            <p className="text-white/80 text-sm mt-2">Your next delivery starts from here.</p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card
            className="p-4 bg-white border border-[#ff8303]/30 cursor-pointer card-interactive transition-all"
            onClick={() => setActiveTab("orders")}
          >
            <div className="w-10 h-10 bg-[#ff8303]/20 rounded-xl flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-[#fd5602]" />
            </div>
            <p className="text-[#2d2d2d] font-bold">Orders</p>
            <p className="text-[#6b6b6b] text-xs mt-1">Accept next delivery</p>
          </Card>

          <Card
            className="p-4 bg-white border border-[#ff8303]/30 cursor-pointer card-interactive transition-all"
            onClick={() => setActiveTab("earnings")}
          >
            <div className="w-10 h-10 bg-[#ff8303]/20 rounded-xl flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5 text-[#fd5602]" />
            </div>
            <p className="text-[#2d2d2d] font-bold">Earnings</p>
            <p className="text-[#6b6b6b] text-xs mt-1">Track collections</p>
          </Card>
        </div>

        <RiderStatsCards riderId={user.id} />

        <Card
          className="p-4 bg-white border border-[#ff8303]/30 cursor-pointer"
          onClick={() => setActiveTab("history")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#ff8303]/20 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-[#fd5602]" />
              </div>
              <div>
                <p className="text-[#2d2d2d] font-bold">Delivery history</p>
                <p className="text-[#6b6b6b] text-xs">Review completed and failed orders</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#fd5602]" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffdf9] min-w-0">
      {/* Header - Minimalist */}
      <header className="bg-white border-b border-[#ff8303]/30 sticky top-0 z-40">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center">
              <img src="/AGARTHA.svg" alt="Agartha" className="w-11 h-11 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#2d2d2d] tracking-tight">AGARTHA</h1>
              <p className="text-xs text-[#6b6b6b]">{user.full_name || user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online/Offline indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full border border-red-200">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            )}
            {offlineQueue.length > 0 && (
              <div className="flex items-center gap-1 text-xs bg-[#ff8303]/30 text-[#fd5602] px-2 py-1 rounded-full border border-[#ff8303]">
                <CloudOff className="w-3 h-3" />
                {offlineQueue.length}
              </div>
            )}
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-[#fd5602] text-white px-4 py-2 text-center text-sm font-medium">
          <WifiOff className="w-4 h-4 inline mr-2" />
          Offline mode - Actions will sync when back online
        </div>
      )}

      {/* Syncing Banner */}
      {isSyncing && (
        <div className="bg-[#ff8303] text-[#2d2d2d] px-4 py-2 text-center text-sm font-medium">
          <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />
          Syncing {offlineQueue.length} actions...
        </div>
      )}

      {/* Main Content */}
      <div className={`w-full max-w-lg mx-auto px-4 py-4 min-w-0 ${!activeOrder ? "pb-28" : ""}`}>
        {!activeOrder ? (
          <div className="w-full max-w-lg mx-auto min-w-0">{renderActivePane()}</div>
        ) : (
          /* Delivery Flow - No tabs, full screen */
          <DeliveryFlowScreen 
            riderId={user.id} 
            order={activeOrder}
            onBack={() => {
              setActiveOrder(null)
              setActiveTab("orders")
            }}
            onComplete={handleDeliveryComplete}
            isOnline={isOnline}
            addToOfflineQueue={addToOfflineQueue}
          />
        )}
      </div>

      {!activeOrder && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#ff8303]/30 safe-area-bottom shadow-[0_-8px_24px_rgba(45,45,45,0.08)]">
          <div className="w-full max-w-lg mx-auto grid grid-cols-5 px-2 py-2 min-w-0">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setActiveTab(item.value)}
                  className={`touch-target flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors ${
                    isActive
                      ? "bg-[#fd5602] text-white"
                      : "text-[#6b6b6b] hover:bg-[#ff8303]/20 hover:text-[#2d2d2d]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
