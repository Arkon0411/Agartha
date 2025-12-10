"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Shield, Loader2, User, Fingerprint, UserPlus } from "lucide-react"
import { startAuthentication } from "@simplewebauthn/browser"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"rider" | "admin">("rider")
  const [mounted, setMounted] = useState(false)
  const [hasBiometric, setHasBiometric] = useState(false)

  const supabase = createClient()

  // Check if WebAuthn is supported
  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      setHasBiometric(true)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setIsLoading(false)
        return
      }

      if (!data.user) {
        setError("Login failed")
        setIsLoading(false)
        return
      }

      // Wait a moment for the trigger to create the user profile
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check user role in the users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, phone, role, is_active")
        .eq("id", data.user.id)
        .single()

      console.log("User data:", userData, "Error:", userError)

      // If no user profile exists, create one
      if (userError || !userData) {
        const newRole = mode === "admin" ? "admin" : "rider"
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: data.user.email?.split("@")[0] || "User",
            role: newRole,
            is_active: true,
          })
          .select()
          .single()

        if (insertError) {
          console.error("Failed to create user profile:", insertError)
        }

        if (mode === "admin") {
          router.push("/admin")
        } else {
          router.push("/")
        }
        router.refresh()
        return
      }

      // Check if trying to login as admin but doesn't have admin role
      if (mode === "admin" && userData.role !== "admin") {
        setError("You don't have admin access. Your role is: " + userData.role)
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      // Redirect based on selected MODE
      if (mode === "admin") {
        router.push("/admin")
      } else {
        router.push("/")
      }
      router.refresh()
    } catch (err) {
      console.error("Login error:", err)
      setError("Connection error. Please try again.")
      setIsLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    setError("")
    setIsBiometricLoading(true)

    try {
      // Get authentication options
      const optionsRes = await fetch("/api/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
      })

      if (!optionsRes.ok) {
        throw new Error("Failed to get authentication options")
      }

      const options = await optionsRes.json()

      // Start biometric authentication
      const credential = await startAuthentication(options)

      // Verify the credential
      const verifyRes = await fetch("/api/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          challenge: options.challenge,
        }),
      })

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json()
        throw new Error(errorData.error || "Authentication failed")
      }

      const result = await verifyRes.json()

      if (result.verified && result.user) {
        // Check role matches mode
        if (mode === "admin" && result.user.role !== "admin") {
          setError("You don't have admin access")
          setIsBiometricLoading(false)
          return
        }

        let sessionCreated = false

        // If we have a session token, verify it with Supabase to create a session
        if (result.sessionToken) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: result.sessionToken,
            type: "magiclink",
          })
          if (!verifyError) {
            sessionCreated = true
          } else {
            console.error("Session verification error:", verifyError)
          }
        }

        // If no Supabase session, store biometric session in localStorage as fallback
        if (!sessionCreated) {
          const biometricSession = {
            user: result.user,
            verified: true,
            timestamp: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
          }
          localStorage.setItem("biometric_session", JSON.stringify(biometricSession))
        }

        // Redirect based on role
        if (result.user.role === "admin") {
          window.location.href = "/admin"
        } else {
          window.location.href = "/"
        }
      }
    } catch (err: any) {
      console.error("Biometric login error:", err)
      if (err.name === "NotAllowedError") {
        setError("Biometric authentication was cancelled")
      } else if (err.name === "NotSupportedError") {
        setError("Biometric not supported on this device")
      } else {
        setError(err.message || "Biometric login failed")
      }
    } finally {
      setIsBiometricLoading(false)
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <img src="/AGARTHA.svg" alt="Agartha" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-[#2d2d2d] tracking-tight">AGARTHA</h1>
        <p className="text-[#6b6b6b] text-sm mt-1">Cashless COD Delivery</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 p-1 bg-[#ff8303]/20 rounded-xl">
        <Button
          type="button"
          onClick={() => setMode("rider")}
          className={`flex-1 h-12 text-sm font-semibold transition-all rounded-lg ${
            mode === "rider"
              ? "bg-[#fd5602] hover:bg-[#e54d00] text-white shadow-sm"
              : "bg-transparent hover:bg-[#ff8303]/30 text-[#6b6b6b]"
          }`}
        >
          <User className="w-4 h-4 mr-2" />
          Rider
        </Button>
        <Button
          type="button"
          onClick={() => setMode("admin")}
          className={`flex-1 h-12 text-sm font-semibold transition-all rounded-lg ${
            mode === "admin"
              ? "bg-[#fd5602] hover:bg-[#e54d00] text-white shadow-sm"
              : "bg-transparent hover:bg-[#ff8303]/30 text-[#6b6b6b]"
          }`}
        >
          <Shield className="w-4 h-4 mr-2" />
          Admin
        </Button>
      </div>

      <Card className="p-6 border-[#ff8303]/30 bg-white shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <Input
              type="email"
              placeholder={mode === "admin" ? "admin@agartha.ph" : "rider@agartha.ph"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-[#fffdf9] border-[#ff8303]/50 text-[#2d2d2d] placeholder:text-[#6b6b6b]/50 rounded-lg focus:border-[#fd5602] focus:ring-[#fd5602]/20"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-[#fffdf9] border-[#ff8303]/50 text-[#2d2d2d] placeholder:text-[#6b6b6b]/50 rounded-lg focus:border-[#fd5602] focus:ring-[#fd5602]/20"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-sm font-semibold rounded-lg bg-[#fd5602] hover:bg-[#e54d00] text-white mt-2"
            disabled={isLoading || isBiometricLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing In...
              </>
            ) : (
              `Sign In as ${mode === "admin" ? "Admin" : "Rider"}`
            )}
          </Button>

          {/* Biometric Login */}
          {hasBiometric && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#ff8303]/30" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#6b6b6b]">or</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleBiometricLogin}
                variant="outline"
                className="w-full h-12 text-sm font-semibold rounded-lg border-[#ff8303]/50 text-[#fd5602] hover:bg-[#ff8303]/10"
                disabled={isLoading || isBiometricLoading || !email}
              >
                {isBiometricLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 mr-2" />
                    {email ? "Login with Face ID / Biometric" : "Enter email first for biometric"}
                  </>
                )}
              </Button>
            </>
          )}
        </form>
      </Card>

      {/* Registration Link - Only for Riders */}
      {mode === "rider" && (
        <div className="mt-4 text-center">
          <p className="text-sm text-[#6b6b6b]">
            New rider?{" "}
            <button
              onClick={() => router.push("/register")}
              className="text-[#fd5602] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <UserPlus className="w-3 h-3" />
              Register here
            </button>
          </p>
        </div>
      )}

      <div className="mt-6 text-center text-[10px] text-[#6b6b6b]">
        <p className="font-medium mb-1">Test Credentials</p>
        <p>Admin: admin@agartha.ph / admin123456</p>
        <p>Rider: rider@agartha.ph / rider123456</p>
      </div>
    </div>
  )
}

function LoginFallback() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <img src="/AGARTHA.svg" alt="Agartha" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-[#2d2d2d] tracking-tight">AGARTHA</h1>
        <p className="text-[#6b6b6b] text-sm mt-1">Cashless COD Delivery</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#fd5602]" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffdf9] p-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
