"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import RiderDashboard from "@/components/rider-dashboard"
import { Loader2 } from "lucide-react"
import type { AuthChangeEvent, PostgrestSingleResponse } from "@supabase/supabase-js"
import type { User } from "@/types"

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const profileSelect = "id, email, full_name, phone, role, is_active, avatar_url, birthdate, address, created_at"
  const baseProfileSelect = "id, email, full_name, phone, role, is_active, created_at"

  const fetchUserProfile = async (userId: string): Promise<PostgrestSingleResponse<User>> => {
    const result = await supabase
      .from("users")
      .select(profileSelect)
      .eq("id", userId)
      .single()

    if (!result.error) return result as PostgrestSingleResponse<User>

    const missingProfileColumn =
      result.error.message.includes("avatar_url") ||
      result.error.message.includes("birthdate") ||
      result.error.message.includes("address")

    if (!missingProfileColumn) return result as PostgrestSingleResponse<User>

    return supabase
      .from("users")
      .select(baseProfileSelect)
      .eq("id", userId)
      .single() as Promise<PostgrestSingleResponse<User>>
  }

  useEffect(() => {
    setMounted(true)
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
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
              const { data: userData, error } = await fetchUserProfile(biometricSession.user.id)

              if (!error && userData) {
                // Redirect admin to admin panel
                if (userData.role === "admin") {
                  router.push("/admin")
                  return
                }
                setUser(userData)
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
      const { data: userData, error } = await fetchUserProfile(authUser.id)

      if (error || !userData) { 
        // User exists in auth but not in users table - create profile
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Rider",
            phone: authUser.phone || null,
            avatar_url: null,
            birthdate: null,
            address: null,
            role: "rider",
            is_active: true,
          })
          .select(profileSelect)
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

      setUser(userData)
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
      <RiderDashboard user={user} onUserUpdate={setUser} />
    </main>
  )
}
