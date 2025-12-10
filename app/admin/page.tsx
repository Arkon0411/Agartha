"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, LogOut, Package, Users, 
  RefreshCw, MapPin, Clock, Truck, Loader2
} from "lucide-react"
import type { Order, User } from "@/types"
import AdminCreateOrder from "@/components/admin/create-order"
import AdminOrderDetails from "@/components/admin/order-details"
import { forceLogout } from "@/lib/utils/logout"

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [riders, setRiders] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateOrder, setShowCreateOrder] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedToday: 0,
    activeRiders: 0,
  })

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track if realtime is working to disable polling
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)

  useEffect(() => {
    if (user) {
      fetchData()
      
      // Polling fallback - only poll every 30s and only if realtime isn't working
      const pollInterval = setInterval(() => {
        if (!isRealtimeActive) {
          fetchOrders()
        }
      }, 30000) // Increased from 5s to 30s

      // Real-time subscriptions (preferred over polling)
      const ordersChannel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            console.log("Real-time order update:", payload)
            fetchOrders() // Refresh all orders on any change
          }
        )
        .subscribe((status) => {
          console.log("Orders subscription status:", status)
          if (status === "SUBSCRIBED") {
            setIsRealtimeActive(true)
            console.log("Real-time is working! Polling disabled.")
          } else {
            setIsRealtimeActive(false)
          }
        })

      // Subscribe to realtime rider/user updates
      const usersChannel = supabase
        .channel("users-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users" },
          (payload) => {
            console.log("Real-time user update:", payload)
            fetchRiders()
          }
        )
        .subscribe((status) => {
          console.log("Users subscription status:", status)
        })

      return () => {
        clearInterval(pollInterval)
        supabase.removeChannel(ordersChannel)
        supabase.removeChannel(usersChannel)
      }
    }
  }, [user, isRealtimeActive])

  const checkAuth = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      // If no Supabase auth, check for biometric session
      if (!authUser) {
        const biometricSessionStr = localStorage.getItem("biometric_session")
        if (biometricSessionStr) {
          try {
            const biometricSession = JSON.parse(biometricSessionStr)
            if (biometricSession.verified && biometricSession.expiresAt > Date.now()) {
              // Fetch fresh user data
              const { data: userData, error } = await supabase
                .from("users")
                .select("id, email, full_name, phone, role, is_active")
                .eq("id", biometricSession.user.id)
                .single()

              if (!error && userData && userData.role === "admin") {
                setUser(userData as User)
                setIsLoading(false)
                return
              } else if (userData && userData.role !== "admin") {
                setIsLoading(false)
                router.push("/")
                return
              }
            } else {
              localStorage.removeItem("biometric_session")
            }
          } catch (e) {
            localStorage.removeItem("biometric_session")
          }
        }
        setIsLoading(false)
        router.push("/login?redirect=/admin")
        return
      }

      // Check user role
      const { data: userData, error } = await supabase
        .from("users")
        .select("id, email, full_name, phone, role, is_active")
        .eq("id", authUser.id)
        .single()

      console.log("Admin check - User data:", userData)
      console.log("Admin check - Error:", error)

      if (error || !userData) {
        console.error("No user profile found:", error)
        setIsLoading(false)
        router.push("/login?redirect=/admin")
        return
      }

      if (userData.role !== "admin") {
        console.error("User is not admin, role is:", userData.role)
        setIsLoading(false)
        router.push("/")
        return
      }

      setUser(userData as User)
      setIsLoading(false)
    } catch (err) {
      console.error("Admin auth error:", err)
      setIsLoading(false)
      router.push("/login?redirect=/admin")
    }
  }

  const fetchData = async () => {
    await Promise.all([fetchOrders(), fetchRiders()])
  }

  const fetchOrders = async () => {
    // Only select needed columns - exclude large fields like pod_photo_url
    const { data } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        package_description,
        cod_amount,
        barcode,
        barcode_image_url,
        pickup_address,
        delivery_address,
        delivery_contact_name,
        status,
        payment_method,
        rider_id,
        created_at,
        completed_at
      `)
      .order("created_at", { ascending: false })
      .limit(50)

    if (data) {
      setOrders(data as Order[])
      
      const today = new Date().toISOString().split("T")[0]
      setStats({
        totalOrders: data.length,
        pendingOrders: data.filter(o => o.status === "pending").length,
        completedToday: data.filter(o => 
          o.status === "completed" && 
          o.completed_at?.startsWith(today)
        ).length,
        activeRiders: new Set(data.filter(o => o.rider_id && o.status !== "completed").map(o => o.rider_id)).size,
      })
    }
  }

  const fetchRiders = async () => {
    // Only select needed columns
    const { data } = await supabase
      .from("users")
      .select("id, email, full_name, phone, role, is_active")
      .eq("role", "rider")
      .eq("is_active", true)

    if (data) {
      setRiders(data as User[])
    }
  }

  const handleLogout = async () => {
    // Use forceful logout to clear all sessions, storage, and cookies
    await forceLogout()
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
      failed: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-slate-100 text-slate-800"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      accepted: "Accepted",
      picked_up: "Picked Up",
      delivering: "Delivering",
      arrived: "Arrived",
      payment_pending: "Payment Pending",
      payment_confirmed: "Payment Confirmed",
      completed: "Completed",
      failed: "Failed",
    }
    return labels[status] || status
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fffdf9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img src="/AGARTHA.svg" alt="Agartha" className="w-16 h-16 object-contain" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#fd5602] mx-auto mb-3" />
          <p className="text-[#6b6b6b] text-sm">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  // If not loading but no user, show error message instead of blank screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fffdf9] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img src="/AGARTHA.svg" alt="Agartha" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-[#2d2d2d] mb-2">Authentication Error</h1>
          <p className="text-[#6b6b6b] text-sm mb-6">
            Unable to verify admin access. Please try logging in again.
          </p>
          <Button
            onClick={() => router.push("/login?redirect=/admin")}
            className="bg-[#fd5602] hover:bg-[#e54d00] text-white"
          >
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  if (showCreateOrder) {
    return (
      <AdminCreateOrder 
        onBack={() => setShowCreateOrder(false)}
        onSuccess={() => {
          setShowCreateOrder(false)
          fetchOrders()
        }}
      />
    )
  }

  if (selectedOrder) {
    return (
      <AdminOrderDetails
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onUpdate={fetchOrders}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#fffdf9]">
      {/* Header - Minimalist */}
      <header className="bg-white border-b border-[#ff8303]/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
              <img src="/AGARTHA.svg" alt="Agartha" className="w-10 h-10 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#2d2d2d] tracking-tight">Admin</h1>
              <p className="text-xs text-[#6b6b6b] truncate">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Live indicator */}
            <div className="flex items-center gap-1 text-xs text-[#fd5602] bg-[#ff8303]/30 px-2 py-1 rounded-full border border-[#ff8303]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fd5602] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fd5602]"></span>
              </span>
              <span className="hidden sm:inline">Live</span>
            </div>
            <Button 
              onClick={fetchData} 
              variant="ghost" 
              size="sm"
              className="h-9 w-9 p-0 text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 text-[#6b6b6b] hover:text-[#2d2d2d] hover:bg-[#ff8303]/20"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats - Minimalist */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-1">TOTAL ORDERS</p>
            <p className="text-3xl font-bold text-[#2d2d2d]">{stats.totalOrders}</p>
          </Card>
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <p className="text-[10px] text-[#fd5602] font-medium tracking-wide mb-1">PENDING</p>
            <p className="text-3xl font-bold text-[#fd5602]">{stats.pendingOrders}</p>
          </Card>
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-1">COMPLETED</p>
            <p className="text-3xl font-bold text-[#2d2d2d]">{stats.completedToday}</p>
          </Card>
          <Card className="p-4 bg-white border border-[#ff8303]/30">
            <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-1">RIDERS</p>
            <p className="text-3xl font-bold text-[#2d2d2d]">{stats.activeRiders}</p>
          </Card>
        </div>

        {/* Create Order Button */}
        <Button
          onClick={() => setShowCreateOrder(true)}
          className="w-full h-14 mb-6 bg-[#fd5602] hover:bg-[#e54d00] text-white text-lg font-semibold rounded-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Order
        </Button>

        {/* Tabs - Minimalist */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-white border border-[#ff8303]/50 rounded-xl p-1 mb-4">
            <TabsTrigger 
              value="orders" 
              className="gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#fd5602] data-[state=active]:text-white data-[state=inactive]:text-[#6b6b6b]"
            >
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger 
              value="riders" 
              className="gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#fd5602] data-[state=active]:text-white data-[state=inactive]:text-[#6b6b6b]"
            >
              <Users className="w-4 h-4" />
              Riders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {orders.length === 0 ? (
              <Card className="p-12 text-center bg-white border border-[#ff8303]/30">
                <Package className="w-12 h-12 mx-auto text-[#ff8303] mb-4" />
                <p className="text-[#6b6b6b] mb-4">No orders yet</p>
                <Button 
                  onClick={() => setShowCreateOrder(true)}
                  className="bg-[#fd5602] hover:bg-[#e54d00] text-white"
                >
                  Create First Order
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    className="p-4 bg-white border border-[#ff8303]/30 hover:border-[#fd5602]/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-[#2d2d2d]">
                            {order.order_number}
                          </h3>
                          <Badge className="bg-[#ff8303]/50 text-[#2d2d2d] border-0 text-[10px]">
                            {getStatusLabel(order.status)}
                          </Badge>
                          {order.payment_method && (
                            <Badge className="bg-[#fd5602]/10 text-[#fd5602] border border-[#fd5602]/30 text-[10px]">
                              {order.payment_method.toUpperCase()}
                            </Badge>
                          )}
                        </div>

                        {order.package_description && (
                          <div className="inline-flex items-start gap-1.5 text-xs text-[#6b6b6b] bg-[#ff8303]/20 px-2 py-1 rounded mb-2 max-w-fit">
                            <Package className="w-3 h-3 text-[#fd5602] flex-shrink-0 mt-0.5" />
                            <span className="break-words">{order.package_description}</span>
                          </div>
                        )}

                        {order.barcode && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-[#6b6b6b] bg-[#fd5602]/10 px-2 py-1 rounded mb-2 max-w-fit">
                            <Package className="w-3 h-3 text-[#fd5602] flex-shrink-0" />
                            <span className="font-mono text-[10px]">{order.barcode}</span>
                          </div>
                        )}

                        <div className="space-y-2 mt-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-[#6b6b6b]">From</p>
                              <p className="text-[#2d2d2d] text-xs break-words line-clamp-2">{order.pickup_address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-[#6b6b6b]">To</p>
                              <p className="text-[#2d2d2d] text-xs break-words line-clamp-2">{order.delivery_address}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6b6b6b]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleString()}
                          </span>
                          {order.rider_id && (
                            <span className="flex items-center gap-1 text-[#fd5602]">
                              <Truck className="w-3 h-3" />
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-[#6b6b6b] mb-0.5">COD</p>
                        <p className="text-xl font-bold text-[#fd5602]">
                          ₱{order.cod_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="riders">
            {riders.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No riders registered</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {riders.map((rider) => (
                  <Card key={rider.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                          <Truck className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{rider.full_name}</p>
                          <p className="text-sm text-slate-500">{rider.email}</p>
                        </div>
                      </div>
                      <Badge className={rider.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                        {rider.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
