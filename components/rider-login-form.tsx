"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface RiderLoginFormProps {
  onLogin: (riderId: string) => void
}

export default function RiderLoginForm({ onLogin }: RiderLoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Login failed")
        return
      }

      onLogin(data.riderId)
    } catch (err) {
      setError("Connection error. Try demo login.")
      // Demo login fallback
      onLogin("RIDER_" + Math.random().toString(36).substr(2, 9))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = () => {
    onLogin("RIDER_DEMO_001")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Deliver</h1>
          <p className="text-slate-400">Cashless COD Delivery System</p>
        </div>

        <Card className="p-6 border-slate-700 bg-slate-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <Input
                type="email"
                placeholder="rider@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-red-100 text-sm">{error}</div>
            )}

            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={isLoading}>
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-center text-sm text-slate-400 mb-3">New to the app?</p>
            <Button
              type="button"
              onClick={handleDemoLogin}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
              variant="outline"
            >
              Try Demo Login
            </Button>
          </div>
        </Card>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>Demo credentials:</p>
          <p className="mt-1">rider@demo.com / demo123</p>
        </div>
      </div>
    </div>
  )
}
