"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OrderQueueScreen from "./order-queue-screen"
import DeliveryFlowScreen from "./delivery-flow-screen"
import RiderSettlementDashboard from "./rider-settlement-dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LogOut, Truck, Package, BarChart3, WifiOff, Wifi, CloudOff, RefreshCw } from "lucide-react"
import type { Order, User } from "@/types"

interface RiderDashboardProps {
  user: User
}

// Offline queue storage key
const OFFLINE_QUEUE_KEY = "agartha_offline_queue"

interface QueuedAction {
  id: string
  type: "update_order"
  orderId: string
  data: Record<string, any>
  timestamp: number
}

export default function RiderDashboard({ user }: RiderDashboardProps) {
  const router = useRouter()
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState("queue")
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
    try {
      await supabase.auth.signOut()
      // Clear any local storage
      localStorage.removeItem(OFFLINE_QUEUE_KEY)
      localStorage.removeItem("biometric_session")
      // Force full page navigation to ensure clean state
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      window.location.href = "/login"
    }
  }

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order)
    setActiveTab("delivery")
  }

  const handleDeliveryComplete = () => {
    // Clear order first, then switch tab after a brief delay to ensure clean unmount
    setActiveOrder(null)
    // Small delay to ensure DeliveryFlowScreen unmounts cleanly before tab switch
    setTimeout(() => {
      setActiveTab("queue")
    }, 50)
  }

  return (
    <div className="min-h-screen bg-[#fffdf9]">
      {/* Header - Minimalist */}
      <header className="bg-white border-b border-[#ff8303]/30 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
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
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Show tabs only when NOT in active delivery */}
        {!activeOrder ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Only 2 tabs: Orders and Earnings */}
            <TabsList className="grid w-full grid-cols-2 h-12 bg-white border border-[#ff8303]/50 rounded-xl p-1">
              <TabsTrigger 
                value="queue" 
                className="gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#fd5602] data-[state=active]:text-white data-[state=inactive]:text-[#6b6b6b]"
              >
                <Package className="w-4 h-4" />
                Orders
              </TabsTrigger>
              <TabsTrigger 
                value="settlement" 
                className="gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#fd5602] data-[state=active]:text-white data-[state=inactive]:text-[#6b6b6b]"
              >
                <BarChart3 className="w-4 h-4" />
                Earnings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              <OrderQueueScreen 
                riderId={user.id} 
                onSelectOrder={handleSelectOrder} 
              />
            </TabsContent>

            <TabsContent value="settlement" className="mt-4">
              <RiderSettlementDashboard riderId={user.id} />
            </TabsContent>
          </Tabs>
        ) : (
          /* Delivery Flow - No tabs, full screen */
          <DeliveryFlowScreen 
            riderId={user.id} 
            order={activeOrder}
            onBack={() => {
              setActiveOrder(null)
              setActiveTab("queue")
            }}
            onComplete={handleDeliveryComplete}
            isOnline={isOnline}
            addToOfflineQueue={addToOfflineQueue}
          />
        )}
      </div>
    </div>
  )
}
