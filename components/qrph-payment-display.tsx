"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, TestTube2 } from "lucide-react"

interface QRPhPaymentDisplayProps {
  orderId: string
  qrCodeUrl: string | null
  paymentIntentId: string | null
  amount: number
  isLoading: boolean
  error: string
  isTestMode?: boolean
  isDemoMode?: boolean
  onConfirmPayment: () => void
  onRetry: () => void
  onPaymentSimulated?: () => void
}

export default function QRPhPaymentDisplay({
  orderId,
  qrCodeUrl,
  paymentIntentId,
  amount,
  isLoading,
  error,
  isTestMode = false,
  isDemoMode = false,
  onConfirmPayment,
  onRetry,
  onPaymentSimulated,
}: QRPhPaymentDisplayProps) {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulateError, setSimulateError] = useState("")

  const handleSimulatePayment = async () => {
    setIsSimulating(true)
    setSimulateError("")

    try {
      const response = await fetch("/api/payments/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentIntentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to simulate payment")
      }

      // Payment simulated successfully
      if (onPaymentSimulated) {
        onPaymentSimulated()
      }
    } catch (err: any) {
      setSimulateError(err.message || "Failed to simulate payment")
    } finally {
      setIsSimulating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Test Mode Banner */}
      {(isTestMode || isDemoMode) && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2">
          <TestTube2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-amber-800">
              {isDemoMode ? "Demo Mode" : "Test Mode"}
            </p>
            <p className="text-amber-700 text-xs">
              {isDemoMode 
                ? "No PayRex API key configured. Using mock data."
                : "Using test API key. QR code won't work with real GCash/Maya."}
            </p>
          </div>
        </div>
      )}

      <Card className="p-6">
        <div className="text-center space-y-4">
          <h3 className="font-bold text-slate-900 mb-4">Customer Scans QR Code</h3>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
              <p className="text-slate-500 text-sm">Generating QR Code...</p>
            </div>
          ) : paymentIntentId ? (
            <div className="space-y-4">
              {/* QR Code Display */}
              {qrCodeUrl ? (
                // Real QR code from PayRex
                <div className="bg-white p-4 rounded-lg inline-block mx-auto border-2 border-slate-200">
                  <img 
                    src={qrCodeUrl} 
                    alt="QRPH Payment QR Code" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
              ) : (
                // Fallback display when no QR URL (test/demo mode)
                <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-8 rounded-lg inline-block mx-auto">
                  <div className="w-40 h-40 bg-white rounded-lg flex items-center justify-center border-2 border-slate-300">
                    <div className="text-center p-4">
                      <div className="font-mono text-xs text-slate-500 mb-2">QRPH</div>
                      <div className="text-3xl font-bold text-slate-900">₱{amount.toLocaleString()}</div>
                      {isTestMode && (
                        <div className="text-xs text-amber-600 mt-2">TEST MODE</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  {isTestMode || isDemoMode
                    ? "In test mode, use the 'Simulate Payment' button below"
                    : "Customer scans this QR with GCash, Maya, or banking app"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500">Payment Reference</p>
                <p className="font-mono text-xs text-slate-600 break-all bg-slate-100 p-2 rounded">
                  {paymentIntentId}
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-900 text-left">
                  <p className="font-bold mb-1">Waiting for payment...</p>
                  <p className="text-xs">
                    {isTestMode || isDemoMode
                      ? "Click 'Simulate Payment' to test the flow"
                      : "Payment will auto-confirm via webhook"}
                  </p>
                </div>
              </div>

              {/* Simulate Payment Button (Test Mode Only) */}
              {(isTestMode || isDemoMode) && (
                <Button
                  onClick={handleSimulatePayment}
                  disabled={isSimulating}
                  className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Simulating Payment...
                    </>
                  ) : (
                    <>
                      <TestTube2 className="w-5 h-5 mr-2" />
                      Simulate Payment (Test Mode)
                    </>
                  )}
                </Button>
              )}

              {simulateError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {simulateError}
                </div>
              )}

              {/* Manual Confirm Button */}
              <Button
                onClick={onConfirmPayment}
                disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                {isLoading ? "Processing..." : "Manual: Confirm Payment Received"}
              </Button>

              <Button onClick={onRetry} variant="outline" className="w-full bg-transparent">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate QR
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-slate-500">Failed to generate QR code</p>
              <Button onClick={onRetry} className="w-full bg-orange-500">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}
    </div>
  )
}
