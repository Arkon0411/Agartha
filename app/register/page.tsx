"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { User, Mail, Phone, Lock, Loader2, CheckCircle2, Fingerprint, ArrowLeft } from "lucide-react"
import { startRegistration } from "@simplewebauthn/browser"

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<"form" | "biometric" | "success">("form")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  })

  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // Format phone number
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.startsWith('0')) {
      if (digits.length <= 4) return digits
      if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
    }
    return value
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData(prev => ({ ...prev, phone: formatted }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!formData.full_name.trim()) {
      setError("Please enter your full name")
      return
    }
    if (!formData.email.trim()) {
      setError("Please enter your email")
      return
    }
    if (!formData.password) {
      setError("Please enter a password")
      return
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
          }
        }
      })

      if (authError) {
        setError(authError.message)
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        setError("Failed to create account")
        setIsLoading(false)
        return
      }

      // Create user profile in users table
      const { error: profileError } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: "rider",
          is_active: true,
        })

      if (profileError) {
        console.error("Profile creation error:", profileError)
        // Continue anyway - trigger might have created it
      }

      setUserId(authData.user.id)
      setStep("biometric")
    } catch (err: any) {
      setError(err.message || "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupBiometric = async () => {
    if (!userId) {
      setError("User ID not found")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Get registration options from server
      const optionsRes = await fetch("/api/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId,
          userName: formData.email,
          userDisplayName: formData.full_name,
        }),
      })

      if (!optionsRes.ok) {
        const errorData = await optionsRes.json()
        throw new Error(errorData.error || "Failed to get registration options")
      }

      const options = await optionsRes.json()

      // Start WebAuthn registration (this triggers Face ID / biometric)
      const credential = await startRegistration(options)

      // Verify and save credential
      const verifyRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          credential,
          challenge: options.challenge,
        }),
      })

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json()
        throw new Error(errorData.error || "Failed to verify credential")
      }

      setStep("success")
    } catch (err: any) {
      console.error("Biometric setup error:", err)
      if (err.name === "NotAllowedError") {
        setError("Biometric authentication was cancelled or not allowed")
      } else if (err.name === "NotSupportedError") {
        setError("Your device does not support biometric authentication")
      } else {
        setError(err.message || "Failed to setup biometric")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkipBiometric = () => {
    setStep("success")
  }

  const handleGoToLogin = () => {
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffdf9] p-4">
      <Card className="w-full max-w-md p-6 border border-[#ff8303]/30">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src="/AGARTHA.svg" alt="Agartha" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#2d2d2d]">
            {step === "form" && "Rider Registration"}
            {step === "biometric" && "Setup Face ID"}
            {step === "success" && "Registration Complete!"}
          </h1>
          <p className="text-[#6b6b6b] text-sm mt-1">
            {step === "form" && "Create your rider account"}
            {step === "biometric" && "Enable quick login with your face"}
            {step === "success" && "You can now login to your account"}
          </p>
        </div>

        {/* Form Step */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5">
                <User className="w-3 h-3 inline mr-1" />
                Full Name *
              </label>
              <Input
                name="full_name"
                placeholder="Juan Dela Cruz"
                value={formData.full_name}
                onChange={handleChange}
                className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5">
                <Mail className="w-3 h-3 inline mr-1" />
                Email *
              </label>
              <Input
                name="email"
                type="email"
                placeholder="juan@email.com"
                value={formData.email}
                onChange={handleChange}
                className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5">
                <Phone className="w-3 h-3 inline mr-1" />
                Phone Number
              </label>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="0917 123 4567"
                value={formData.phone}
                onChange={handlePhoneChange}
                className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5">
                <Lock className="w-3 h-3 inline mr-1" />
                Password *
              </label>
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1.5">
                <Lock className="w-3 h-3 inline mr-1" />
                Confirm Password *
              </label>
              <Input
                name="confirm_password"
                type="password"
                placeholder="••••••••"
                value={formData.confirm_password}
                onChange={handleChange}
                className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
            </Button>

            <p className="text-center text-sm text-[#6b6b6b]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-[#fd5602] font-medium hover:underline"
              >
                Login
              </button>
            </p>
          </form>
        )}

        {/* Biometric Setup Step */}
        {step === "biometric" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="w-24 h-24 bg-[#ff8303]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Fingerprint className="w-12 h-12 text-[#fd5602]" />
              </div>
              <p className="text-[#6b6b6b] text-sm">
                Enable Face ID or fingerprint for quick and secure login.
                Your biometric data stays on your device.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleSetupBiometric}
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Setup Face ID / Biometric
                </>
              )}
            </Button>

            <Button
              onClick={handleSkipBiometric}
              variant="outline"
              className="w-full h-12 border-[#ff8303]/30 text-[#6b6b6b]"
            >
              Skip for now
            </Button>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <p className="text-[#6b6b6b] text-sm">
                Your account has been created successfully.
                You can now login and start accepting deliveries!
              </p>
            </div>

            <Button
              onClick={handleGoToLogin}
              className="w-full h-14 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              Go to Login
            </Button>
          </div>
        )}

        {/* Back to Login */}
        {step === "form" && (
          <button
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-[#fd5602] mt-4 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
        )}
      </Card>
    </div>
  )
}

