"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import RiderDashboard from "@/components/rider-dashboard"
import { Loader2, Package } from "lucide-react"
import type { User } from "@/types"

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      // If no Supabase auth, check for biometric session
      if (!authUser) {
        const biometricSessionStr = localStorage.getItem("biometric_session")
        if (biometricSessionStr) {
          try {
            const biometricSession = JSON.parse(biometricSessionStr)
            // Check if session is still valid (not expired)
            if (biometricSession.verified && biometricSession.expiresAt > Date.now()) {
              // Fetch fresh user data from database
              const { data: userData, error } = await supabase
                .from("users")
                .select("id, email, full_name, phone, role, is_active")
                .eq("id", biometricSession.user.id)
                .single()

              if (!error && userData) {
                // Redirect admin to admin panel
                if (userData.role === "admin") {
                  router.push("/admin")
                  return
                }
                setUser(userData as User)
                setIsLoading(false)
                return
              }
            } else {
              // Session expired, remove it
              localStorage.removeItem("biometric_session")
            }
          } catch (e) {
            localStorage.removeItem("biometric_session")
          }
        }
        router.push("/login")
        return
      }

      // Fetch user profile
      const { data: userData, error } = await supabase
        .from("users")
        .select("id, email, full_name, phone, role, is_active")
        .eq("id", authUser.id)
        .single()

      if (error || !userData) { 
        // User exists in auth but not in users table - create profile
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Rider",
            role: "rider",
            is_active: true,
          })
          .select()
          .single()

        if (!insertError && newUser) {
          setUser(newUser as User)
        }
        setIsLoading(false)
        return
      }

      // Redirect admin to admin panel
      if (userData.role === "admin") {
        router.push("/admin")
        return
      }

      setUser(userData as User)
      setIsLoading(false)
    } catch (err) {
      console.error("Auth check error:", err)
      router.push("/login")
    }
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
          <p className="text-[#6b6b6b] text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-background">
      <RiderDashboard user={user} />
    </main>
  )
}