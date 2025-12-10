"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, MapPin, Package, CheckCircle2, AlertCircle, 
  Clock, Navigation, Scan, CreditCard, Camera, 
  QrCode, Banknote, Loader2, Phone, User, RefreshCw
} from "lucide-react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { OrderMap, LeafletCSS } from "@/components/maps/dynamic-maps"
import type { Order } from "@/types"

interface QueuedAction {
  id: string
  type: "update_order"
  orderId: string
  data: Record<string, any>
  timestamp: number
}

interface DeliveryFlowScreenProps {
  riderId: string
  order: Order | null
  onBack: () => void
  onComplete: () => void
  isOnline?: boolean
  addToOfflineQueue?: (action: Omit<QueuedAction, "id" | "timestamp">) => void
}

// Complete delivery workflow steps
type DeliveryStep = 
  | "en_route_pickup"    // Step 1: Going to pickup location
  | "at_pickup"          // Step 2: At pickup, scan barcode
  | "picked_up"          // Step 3: Package picked up, heading to customer
  | "delivering"         // Step 4: En route to customer
  | "payment"            // Step 5: Collect payment (QRPH or Cash)
  | "proof"              // Step 6: Capture proof of delivery
  | "completed"          // Done!

export default function DeliveryFlowScreen({ riderId, order, onBack, onComplete, isOnline = true, addToOfflineQueue }: DeliveryFlowScreenProps) {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order)
  const [isExiting, setIsExiting] = useState(false)
  
  // Sync with parent's order prop
  useEffect(() => {
    if (!order) {
      setCurrentOrder(null)
    }
  }, [order])
  const [step, setStep] = useState<DeliveryStep>("en_route_pickup")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qrph" | null>(null)
  const [completedAt, setCompletedAt] = useState<Date | null>(null)
  const [qrphData, setQrphData] = useState<{
    staticQrImageUrl: string | null
    paymentReference: string | null
    expectedAmount: number
    amountPaid: number
    isPolling: boolean
  }>({ staticQrImageUrl: null, paymentReference: null, expectedAmount: 0, amountPaid: 0, isPolling: false })
  const [paymentStatus, setPaymentStatus] = useState<{
    isInsufficient: boolean
    remainingAmount: number
    errorMessage: string | null
  }>({ isInsufficient: false, remainingAmount: 0, errorMessage: null })
  const [scannedBarcode, setScannedBarcode] = useState("")
  const [cashAuditNote, setCashAuditNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [podPhoto, setPodPhoto] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isBarcodeCameraActive, setIsBarcodeCameraActive] = useState(false)
  const [isScanningBarcode, setIsScanningBarcode] = useState(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const barcodeScannerContainerId = "barcode-scanner-container"

  const supabase = createClient()

  // Cleanup html5-qrcode on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // Helper to get saved step from localStorage
  const getSavedStep = (orderId: string): DeliveryStep | null => {
    try {
      const saved = localStorage.getItem(`delivery_step_${orderId}`)
      if (saved) {
        return saved as DeliveryStep
      }
    } catch (e) {
      console.error("Failed to get saved step:", e)
    }
    return null
  }

  // Helper to save step to localStorage
  const saveStep = (orderId: string, stepValue: DeliveryStep) => {
    try {
      localStorage.setItem(`delivery_step_${orderId}`, stepValue)
    } catch (e) {
      console.error("Failed to save step:", e)
    }
  }

  // Helper to clear saved step
  const clearSavedStep = (orderId: string) => {
    try {
      localStorage.removeItem(`delivery_step_${orderId}`)
    } catch (e) {
      console.error("Failed to clear saved step:", e)
    }
  }

  useEffect(() => {
    if (order) {
      setCurrentOrder(order)
      
      // Check for saved step first (for returning to order)
      const savedStep = getSavedStep(order.id)
      
      // Map database status to step
      const statusToStep: Record<string, DeliveryStep> = {
        accepted: "en_route_pickup",
        picked_up: "delivering",
        delivering: "delivering",
        payment_pending: "payment",
        payment_confirmed: "proof",
      }
      
      const dbStep = statusToStep[order.status] || "en_route_pickup"
      
      // Use saved step if it's ahead of or equal to DB step, otherwise use DB step
      const stepOrder: DeliveryStep[] = ["en_route_pickup", "at_pickup", "delivering", "payment", "proof", "completed"]
      const savedStepIndex = savedStep ? stepOrder.indexOf(savedStep) : -1
      const dbStepIndex = stepOrder.indexOf(dbStep)
      
      // Use the more advanced step (higher index)
      if (savedStepIndex >= dbStepIndex && savedStep) {
        setStep(savedStep)
      } else {
        setStep(dbStep)
      }
    }
  }, [order])

  // Save step to localStorage whenever it changes
  useEffect(() => {
    if (currentOrder && step && step !== "completed") {
      saveStep(currentOrder.id, step)
    }
    // Clear saved step when order is completed
    if (currentOrder && step === "completed") {
      clearSavedStep(currentOrder.id)
    }
  }, [step, currentOrder])

  // Get current location for POD
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => console.log("Location error:", error)
      )
    }
  }

  useEffect(() => {
    getCurrentLocation()
  }, [])

  // Stop barcode camera when leaving the pickup step
  useEffect(() => {
    if (step !== "at_pickup" && isBarcodeCameraActive) {
      stopBarcodeCamera()
    }
  }, [step])

  const updateOrderStatus = async (status: string, additionalData: Record<string, any> = {}) => {
    if (!currentOrder) return false
    
    setIsLoading(true)
    setError("")

    const updateData = {
      status,
      ...additionalData,
      updated_at: new Date().toISOString(),
    }

    // If offline, queue the action
    if (!isOnline && addToOfflineQueue) {
      addToOfflineQueue({
        type: "update_order",
        orderId: currentOrder.id,
        data: updateData,
      })
      // Update local state optimistically
      setCurrentOrder(prev => prev ? { ...prev, status: status as any, ...additionalData } : null)
      setIsLoading(false)
      return true
    }

    try {
      const { error: updateError } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", currentOrder.id)

      if (updateError) {
        // If network error, queue for later
        if (addToOfflineQueue && (updateError.message.includes("network") || updateError.message.includes("fetch"))) {
          addToOfflineQueue({
            type: "update_order",
            orderId: currentOrder.id,
            data: updateData,
          })
          setCurrentOrder(prev => prev ? { ...prev, status: status as any, ...additionalData } : null)
          setIsLoading(false)
          return true
        }
        setError(updateError.message)
        return false
      }

      // Update local state
      setCurrentOrder(prev => prev ? { ...prev, status: status as any, ...additionalData } : null)
      return true
    } catch (err) {
      // If network error, queue for later
      if (addToOfflineQueue) {
        addToOfflineQueue({
          type: "update_order",
          orderId: currentOrder.id,
          data: updateData,
        })
        setCurrentOrder(prev => prev ? { ...prev, status: status as any, ...additionalData } : null)
        setIsLoading(false)
        return true
      }
      setError("Failed to update order")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1: Arrived at pickup
  const handleArrivedAtPickup = async () => {
    setStep("at_pickup")
  }

  // Step 2: Verify barcode and pickup package
  const handleVerifyBarcode = async () => {
    if (!currentOrder) return
    
    // Check if barcode matches
    if (scannedBarcode.trim().toUpperCase() !== currentOrder.barcode.toUpperCase()) {
      setError("Barcode doesn't match! Please scan the correct package.")
      return
    }

    const success = await updateOrderStatus("picked_up", {
      picked_up_at: new Date().toISOString(),
    })

    if (success) {
      setStep("delivering")
      setError("")
    }
  }

  // Step 3: Heading to customer
  const handleStartDelivering = async () => {
    const success = await updateOrderStatus("delivering")
    if (success) {
      setStep("delivering")
    }
  }

  // Step 4: Arrived at customer - go directly to payment step
  const handleArrivedAtCustomer = () => {
    // Skip "arrived" DB status, just move to payment step locally
    // The DB status will update when payment method is selected
    setStep("payment")
  }

  // Step 5: Generate QRPH - Show static QR and start polling
  const handleGenerateQRPH = async () => {
    if (!currentOrder) return
    setIsLoading(true)
    setError("")
    setPaymentMethod("qrph")
    setPaymentStatus({ isInsufficient: false, remainingAmount: 0, errorMessage: null })

    try {
      const response = await fetch("/api/payments/generate-qrph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: currentOrder.id,
          amount: currentOrder.cod_amount,
          description: `Payment for ${currentOrder.order_number}`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to initiate payment")
        setPaymentMethod(null)
        return
      }

      setQrphData({
        staticQrImageUrl: data.staticQrImageUrl,
        paymentReference: data.paymentReference,
        expectedAmount: data.expectedAmount,
        amountPaid: data.amountPaid || 0,
        isPolling: true,
      })
      
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment")
      setPaymentMethod(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Poll for payment status when QRPH is active
  useEffect(() => {
    if (!qrphData.isPolling || !currentOrder || paymentMethod !== "qrph") return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/check-status?orderId=${currentOrder.id}`)
        const data = await response.json()

        if (data.isPaymentComplete) {
          // Payment confirmed! Show success alert and move to proof of delivery
          setQrphData(prev => ({ ...prev, isPolling: false, amountPaid: data.amountPaid }))
          setCurrentOrder(prev => prev ? { ...prev, status: "payment_confirmed" } : null)
          setShowPaymentSuccess(true)
          clearInterval(pollInterval)
          // Auto-dismiss and move to next step after 2 seconds
          setTimeout(() => {
            setShowPaymentSuccess(false)
            setStep("proof")
          }, 2000)
        } else if (data.isInsufficient) {
          // Partial payment received
          setQrphData(prev => ({ ...prev, amountPaid: data.amountPaid }))
          setPaymentStatus({
            isInsufficient: true,
            remainingAmount: data.remainingAmount,
            errorMessage: `Insufficient payment! Customer paid ₱${data.amountPaid.toLocaleString()}. Need ₱${data.remainingAmount.toLocaleString()} more.`,
          })
        }
      } catch (err) {
        console.error("Failed to check payment status:", err)
      }
    }, 10000) // Poll every 10 seconds (reduced from 3s to save egress)

    return () => clearInterval(pollInterval)
  }, [qrphData.isPolling, currentOrder, paymentMethod])

  // Step 5b: Cash payment
  const handleCashPayment = () => {
    setPaymentMethod("cash")
  }

  // Step 6: Confirm payment received
  const handleConfirmPayment = async () => {
    if (!currentOrder) return

    const additionalData: Record<string, any> = {
      payment_method: paymentMethod,
      payment_confirmed_at: new Date().toISOString(),
    }

    if (paymentMethod === "cash" && cashAuditNote) {
      additionalData.cash_audit_note = cashAuditNote
    }

    const success = await updateOrderStatus("payment_confirmed", additionalData)
    if (success) {
      setShowPaymentSuccess(true)
      // Auto-dismiss and move to next step after 2 seconds
      setTimeout(() => {
        setShowPaymentSuccess(false)
        setStep("proof")
      }, 2000)
    }
  }

  // Barcode Scanner Camera
  const handleStartBarcodeCamera = async () => {
    setError("")
    setIsBarcodeCameraActive(true)
    setIsScanningBarcode(true)
    
    // Wait for the container to render
    setTimeout(async () => {
      try {
        // Create new instance with specific barcode formats
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(barcodeScannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODABAR,
            ],
            verbose: false,
          })
        }
        
        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          {
            fps: 15, // Higher FPS for better detection
            qrbox: { width: 300, height: 120 }, // Wider, shorter box for barcodes
            disableFlip: false, // Allow flipped barcodes
          },
          (decodedText: string) => {
            // Success - barcode detected
            console.log("Barcode detected:", decodedText)
            // Clean the barcode - remove any non-alphanumeric characters
            const cleanedCode = decodedText.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
            setScannedBarcode(cleanedCode)
            stopBarcodeCamera()
          },
          (errorMessage: string) => {
            // Ignore scan errors (happens continuously until barcode found)
          }
        )
      } catch (err) {
        console.error("Camera error:", err)
        setError("Cannot access camera. Please allow camera permissions.")
        setIsBarcodeCameraActive(false)
        setIsScanningBarcode(false)
      }
    }, 100)
  }

  const stopBarcodeCamera = async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState()
        // Only stop if currently scanning (state 2 = SCANNING)
        if (state === 2) {
          await html5QrCodeRef.current.stop()
        }
      }
    } catch (err) {
      console.log("Error stopping scanner:", err)
    }
    setIsBarcodeCameraActive(false)
    setIsScanningBarcode(false)
  }

  // Cleanup barcode camera on unmount
  useEffect(() => {
    return () => {
      stopBarcodeCamera()
    }
  }, [])

  // Step 7: Camera for POD
  const handleStartCamera = async () => {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      })
      
      // Set state first so UI shows up
      setIsCameraActive(true)
      
      // Wait for next render cycle so ref is available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(e => console.log("Video play error:", e))
        }
      }, 100)
    } catch (err) {
      console.error("Camera error:", err)
      setError("Cannot access camera. Please allow camera permissions.")
      setIsCameraActive(false)
    }
  }
  
  const stopPODCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop())
    }
    setIsCameraActive(false)
  }

  const handleCapturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const context = canvasRef.current.getContext("2d")
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth || 640
        canvasRef.current.height = videoRef.current.videoHeight || 480
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        const photo = canvasRef.current.toDataURL("image/jpeg", 0.8)
        setPodPhoto(photo)
        stopPODCamera()
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPodPhoto(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Complete delivery - upload POD photo to Storage first
  const handleCompleteDelivery = async () => {
    if (!currentOrder || !podPhoto) return

    setIsLoading(true)
    setError("")
    getCurrentLocation()
    
    const completionTime = new Date()
    let photoUrl = podPhoto // Fallback to base64 if upload fails

    // Try to upload photo to Supabase Storage to reduce database egress
    try {
      const uploadResponse = await fetch("/api/upload/pod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: currentOrder.id,
          photoBase64: podPhoto,
        }),
      })

      const uploadData = await uploadResponse.json()

      if (uploadData.success && uploadData.photoUrl) {
        // Use the Storage URL instead of base64
        photoUrl = uploadData.photoUrl
        console.log("POD photo uploaded to Storage:", photoUrl)
      } else if (uploadData.fallbackToBase64) {
        // Storage not configured, use compressed base64
        console.log("Storage not configured, using base64 fallback")
      }
    } catch (uploadError) {
      // If upload fails, continue with base64 (less ideal but works)
      console.warn("POD upload failed, using base64 fallback:", uploadError)
    }

    const success = await updateOrderStatus("completed", {
      pod_photo_url: photoUrl,
      pod_latitude: location?.lat,
      pod_longitude: location?.lng,
      completed_at: completionTime.toISOString(),
    })

    setIsLoading(false)

    if (success) {
      setCompletedAt(completionTime)
      setStep("completed")
    }
  }

  // Safe exit handler for mobile compatibility - full reload to prevent crashes
  const handleSafeExit = () => {
    // Clear saved step since order is completed
    if (currentOrder) {
      clearSavedStep(currentOrder.id)
    }
    // Full page reload to prevent mobile crashes
    window.location.href = "/"
  }

  if (isExiting || !currentOrder) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500 text-lg">{isExiting ? "Returning to orders..." : "Select an order to start delivery"}</p>
      </div>
    )
  }

  // Step indicators
  const steps = [
    { key: "en_route_pickup", label: "To Pickup", icon: Navigation },
    { key: "at_pickup", label: "Scan", icon: Scan },
    { key: "delivering", label: "Deliver", icon: Package },
    { key: "payment", label: "Payment", icon: CreditCard },
    { key: "proof", label: "POD", icon: Camera },
    { key: "completed", label: "Done", icon: CheckCircle2 },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="space-y-4">
      {/* Load Leaflet CSS */}
      <LeafletCSS />
      
      {/* Header - hide back button on completed step */}
      <div className="flex items-center gap-3">
        {step !== "completed" && (
          <Button variant="outline" size="icon" onClick={onBack} className="h-10 w-10 border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#2d2d2d]">{currentOrder.order_number}</h2>
          <p className="text-sm text-[#6b6b6b]">{currentOrder.delivery_contact_name}</p>
          {currentOrder.package_description && (
            <span className="text-xs text-[#fd5602] bg-[#ff8303]/10 px-2 py-0.5 rounded inline-flex items-center gap-1 mt-1">
              <Package className="w-3 h-3" />
              {currentOrder.package_description}
            </span>
          )}
        </div>
        <Badge className="text-lg px-3 py-1 bg-[#fd5602] border-0">
          ₱{currentOrder.cod_amount.toLocaleString()}
        </Badge>
      </div>

      {/* Progress Bar - Cell Style with Icons */}
      <Card className="p-2 border border-[#ff8303]/30">
        <div className="flex gap-1">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = i <= currentStepIndex
            const isCurrent = s.key === step
            return (
              <div
                key={s.key}
                className={`flex-1 py-2 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                  isCurrent
                    ? "bg-[#fd5602] text-white ring-2 ring-[#fd5602]/30"
                    : isActive
                    ? "bg-[#fd5602] text-white"
                    : "bg-[#ff8303]/10 text-[#6b6b6b]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[7px] font-medium leading-tight text-center">
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Step Content */}
      {step === "en_route_pickup" && (
        <Card className="p-4 border border-[#ff8303]/30">
          <div className="space-y-3">
            {/* Map showing pickup location */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-sm font-semibold text-[#2d2d2d]">Pickup Location</span>
            </div>
            
            {currentOrder.pickup_latitude && currentOrder.pickup_longitude ? (
              <OrderMap
                pickupLat={currentOrder.pickup_latitude}
                pickupLng={currentOrder.pickup_longitude}
                pickupAddress={currentOrder.pickup_address}
                showRoute={false}
                height="160px"
              />
            ) : null}
            
            {/* Address */}
            <div className="bg-[#ff8303]/10 rounded-lg p-3 text-sm text-[#2d2d2d] break-words">
              {currentOrder.pickup_address}
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b6b] px-1">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {currentOrder.pickup_contact_name}
              </span>
              {currentOrder.pickup_contact_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {currentOrder.pickup_contact_phone}
                </span>
              )}
            </div>

            <Button 
              onClick={handleArrivedAtPickup} 
              className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              I've Arrived at Pickup
            </Button>
          </div>
        </Card>
      )}

      {step === "at_pickup" && (
        <Card className="p-5 border border-[#ff8303]/30">
          <div className="text-center space-y-4">
            {/* Header - hide when camera is active for compact view */}
            {!isBarcodeCameraActive && (
              <>
                <div className="w-16 h-16 bg-[#ff8303]/10 rounded-full flex items-center justify-center mx-auto">
                  <Scan className="w-8 h-8 text-[#fd5602]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#2d2d2d] mb-1">Scan Package Barcode</h3>
                  <p className="text-[#6b6b6b] text-sm">Use camera to scan or enter barcode manually</p>
                </div>
              </>
            )}

            {/* Camera Barcode Scanner */}
            {!isBarcodeCameraActive ? (
              <Button
                onClick={handleStartBarcodeCamera}
                className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
              >
                <Camera className="w-5 h-5 mr-2" />
                Open Camera to Scan
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Compact header when camera active */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-[#fd5602]" />
                    <span className="font-semibold text-[#2d2d2d] text-sm">Scanning Barcode</span>
                  </div>
                  <Button
                    onClick={stopBarcodeCamera}
                    variant="ghost"
                    size="sm"
                    className="text-[#6b6b6b] hover:bg-[#ff8303]/10"
                  >
                    Close
                  </Button>
                </div>
                
                {/* html5-qrcode Scanner Container */}
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <div 
                    id={barcodeScannerContainerId} 
                    className="w-full"
                    style={{ minHeight: "180px", maxHeight: "200px" }}
                  />
                  {/* Scanning indicator overlay */}
                  <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                    <span className="bg-black/70 text-white text-xs px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Point at barcode...
                    </span>
                  </div>
                </div>
                
              </div>
            )}

            {/* Manual Entry Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#ff8303]/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-[#6b6b6b]">or enter manually</span>
              </div>
            </div>

            {/* Manual Barcode Input */}
            <Input
              placeholder="Type barcode here"
              value={scannedBarcode}
              onChange={(e) => setScannedBarcode(e.target.value.toUpperCase())}
              className="h-12 text-lg font-mono text-center border-[#ff8303]/30 focus:ring-[#fd5602]/30"
            />

            {/* Success indicator when barcode detected */}
            {scannedBarcode && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Barcode: <span className="font-mono font-bold">{scannedBarcode}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button 
              onClick={handleVerifyBarcode}
              disabled={!scannedBarcode || isLoading}
              className="w-full h-16 text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Pick Up"}
            </Button>
          </div>
        </Card>
      )}

      {step === "delivering" && (
        <Card className="p-4 border border-[#ff8303]/30">
          <div className="space-y-3">
            {/* Map showing delivery location */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-red-500/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
              </div>
              <span className="text-sm font-semibold text-[#2d2d2d]">Delivery Location</span>
            </div>
            
            {currentOrder.delivery_latitude && currentOrder.delivery_longitude ? (
              <OrderMap
                deliveryLat={currentOrder.delivery_latitude}
                deliveryLng={currentOrder.delivery_longitude}
                deliveryAddress={currentOrder.delivery_address}
                showRoute={false}
                height="160px"
              />
            ) : null}
            
            {/* Address */}
            <div className="bg-[#ff8303]/10 rounded-lg p-3 text-sm text-[#2d2d2d] break-words">
              {currentOrder.delivery_address}
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b6b] px-1">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {currentOrder.delivery_contact_name}
              </span>
              {currentOrder.delivery_contact_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {currentOrder.delivery_contact_phone}
                </span>
              )}
            </div>

            {/* COD Amount */}
            <div className="bg-[#ff8303]/10 border border-[#ff8303]/30 rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-[#6b6b6b] font-medium">COD Amount</span>
              <span className="text-xl font-black text-[#fd5602]">
                ₱{currentOrder.cod_amount.toLocaleString()}
              </span>
            </div>

            <Button 
              onClick={handleArrivedAtCustomer}
              disabled={isLoading}
              className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "I've Arrived at Customer"}
            </Button>
          </div>
        </Card>
      )}

      {step === "payment" && !paymentMethod && (
        <Card className="p-5 border border-[#ff8303]/30">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-[#ff8303]/10 rounded-full flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8 text-[#fd5602]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2d2d2d] mb-1">Collect Payment</h3>
              <p className="text-2xl font-black text-[#fd5602] my-3">
                ₱{currentOrder.cod_amount.toLocaleString()}
              </p>
              <p className="text-[#6b6b6b] text-sm">Select payment method</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleGenerateQRPH}
                disabled={isLoading}
                className="h-20 flex flex-col items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white"
              >
                <QrCode className="w-8 h-8" />
                <span className="font-bold">QRPH</span>
              </Button>

              <Button
                onClick={handleCashPayment}
                className="h-20 flex flex-col items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Banknote className="w-8 h-8" />
                <span className="font-bold">Cash</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "payment" && paymentMethod === "qrph" && (
        <div className="space-y-4">
          {/* Insufficient Payment Error */}
          {paymentStatus.isInsufficient && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 text-sm">Insufficient Payment!</p>
                  <p className="text-sm text-red-600 mt-1">
                    Customer paid <strong>₱{qrphData.amountPaid.toLocaleString()}</strong>
                  </p>
                  <p className="text-lg font-bold text-red-700 mt-2">
                    Need ₱{paymentStatus.remainingAmount.toLocaleString()} more
                  </p>
                  <p className="text-[10px] text-red-500 mt-2">
                    Ask customer to scan QR again and pay the remaining amount
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 border border-[#ff8303]/30">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-bold text-[#2d2d2d]">Customer Scans QR Code</h3>
              
              {isLoading ? (
                <div className="py-10">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-green-500" />
                  <p className="text-[#6b6b6b] mt-4 text-sm">Initiating payment...</p>
                </div>
              ) : qrphData.paymentReference ? (
                <>
                  {/* Amount to Pay */}
                  <div className="bg-[#ff8303]/10 border border-[#ff8303]/30 rounded-xl p-4">
                    <p className="text-xs text-[#6b6b6b] mb-1">Amount to Collect</p>
                    <p className="text-3xl font-black text-[#fd5602]">
                      ₱{paymentStatus.isInsufficient 
                        ? paymentStatus.remainingAmount.toLocaleString()
                        : currentOrder.cod_amount.toLocaleString()}
                    </p>
                    {paymentStatus.isInsufficient && (
                      <p className="text-[10px] text-[#6b6b6b] mt-2">
                        (Remaining balance)
                      </p>
                    )}
                  </div>

                  {/* Static QR Code Display */}
                  <div className="bg-white p-4 rounded-xl border border-green-200 inline-block">
                    {qrphData.staticQrImageUrl ? (
                      <img 
                        src={qrphData.staticQrImageUrl} 
                        alt="QRPH Payment QR Code" 
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      // Fallback - instruct to show physical QR
                      <div className="w-48 h-48 bg-[#ff8303]/5 rounded-lg flex items-center justify-center">
                        <div className="text-center p-4">
                          <QrCode className="w-14 h-14 text-[#fd5602] mx-auto mb-3" />
                          <p className="text-sm font-medium text-[#2d2d2d]">
                            Show customer your
                          </p>
                          <p className="text-lg font-bold text-[#fd5602]">
                            Agartha QRPH Standee
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="bg-[#ff8303]/5 border border-[#ff8303]/20 rounded-xl p-3 text-left">
                    <p className="text-xs font-bold text-[#2d2d2d] mb-2">Instructions:</p>
                    <ol className="text-xs text-[#6b6b6b] space-y-1 list-decimal list-inside">
                      <li>Customer scans QR with GCash, Maya, or bank</li>
                      <li>Enter amount: <strong className="text-[#fd5602]">₱{paymentStatus.isInsufficient 
                        ? paymentStatus.remainingAmount.toLocaleString()
                        : currentOrder.cod_amount.toLocaleString()}</strong></li>
                      <li>Confirm payment</li>
                      <li>Wait for confirmation</li>
                    </ol>
                  </div>

                  {/* Payment Progress */}
                  {qrphData.amountPaid > 0 && (
                    <div className="bg-[#fffdf9] rounded-lg p-3 border border-[#ff8303]/20">
                      <p className="text-[10px] text-[#6b6b6b] mb-1">Amount Received</p>
                      <p className="text-lg font-bold text-green-600">
                        ₱{qrphData.amountPaid.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Waiting indicator */}
                  <div className={`border rounded-xl p-3 flex items-center gap-3 ${
                    paymentStatus.isInsufficient 
                      ? "bg-amber-50 border-amber-200" 
                      : "bg-green-50 border-green-200"
                  }`}>
                    <Loader2 className={`w-4 h-4 animate-spin ${
                      paymentStatus.isInsufficient ? "text-amber-500" : "text-green-500"
                    }`} />
                    <p className={`text-xs ${
                      paymentStatus.isInsufficient ? "text-amber-700" : "text-green-700"
                    }`}>
                      {paymentStatus.isInsufficient 
                        ? "Waiting for additional payment..."
                        : "Waiting for customer payment..."}
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      setPaymentMethod(null)
                      setQrphData({ staticQrImageUrl: null, paymentReference: null, expectedAmount: 0, amountPaid: 0, isPolling: false })
                      setPaymentStatus({ isInsufficient: false, remainingAmount: 0, errorMessage: null })
                    }}
                    variant="outline"
                    className="w-full h-11 border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10 text-sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Cancel / Try Cash
                  </Button>
                </>
              ) : (
                <div className="py-10">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                  <p className="text-[#6b6b6b] text-sm mb-2">Failed to initiate payment</p>
                  {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
                  <Button onClick={handleGenerateQRPH} className="mt-4 bg-[#fd5602] hover:bg-[#e54d00] text-white">
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {step === "payment" && paymentMethod === "cash" && (
        <Card className="p-5 border border-[#ff8303]/30">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <Banknote className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2d2d2d] mb-1">Collect Cash</h3>
              <p className="text-3xl font-black text-[#fd5602] my-3">
                ₱{currentOrder.cod_amount.toLocaleString()}
              </p>
            </div>

            <div className="bg-[#ff8303]/10 border border-[#ff8303]/20 rounded-xl p-3 text-left">
              <p className="text-xs font-medium text-[#2d2d2d] mb-2">Cash Audit Note (optional)</p>
              <Input
                placeholder="e.g., Exact amount, change given, etc."
                value={cashAuditNote}
                onChange={(e) => setCashAuditNote(e.target.value)}
                className="h-11 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
              />
            </div>

            <Button
              onClick={handleConfirmPayment}
              disabled={isLoading}
              className="w-full h-16 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cash Received"}
            </Button>

            <Button
              onClick={() => setPaymentMethod(null)}
              variant="outline"
              className="w-full h-11 border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10 text-sm"
            >
              Back to Payment Options
            </Button>
          </div>
        </Card>
      )}

      {step === "proof" && (
        <Card className="p-5 border border-[#ff8303]/30">
          <div className="text-center space-y-4">
            {/* Header - hide when camera is active for compact view */}
            {!isCameraActive && (
              <>
                <div className="w-16 h-16 bg-[#ff8303]/10 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-[#fd5602]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#2d2d2d] mb-1">Proof of Delivery</h3>
                  <p className="text-[#6b6b6b] text-sm">Take a photo as proof of successful delivery</p>
                </div>
              </>
            )}

            {!podPhoto && !isCameraActive && (
              <div className="space-y-3 py-3">
                <Button
                  onClick={handleStartCamera}
                  className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Open Camera
                </Button>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-16 text-lg border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10"
                >
                  Upload from Gallery
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-3">
                {/* Compact header when camera active */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#fd5602]" />
                    <span className="font-semibold text-[#2d2d2d] text-sm">Taking Photo</span>
                  </div>
                  <Button
                    onClick={stopPODCamera}
                    variant="ghost"
                    size="sm"
                    className="text-[#6b6b6b] hover:bg-[#ff8303]/10"
                  >
                    Cancel
                  </Button>
                </div>
                
                {/* Camera Viewfinder with frame */}
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover"
                  />
                  {/* Viewfinder overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Corner brackets */}
                    <div className="absolute top-4 left-4 w-10 h-10 border-t-3 border-l-3 border-white rounded-tl-lg opacity-80" />
                    <div className="absolute top-4 right-4 w-10 h-10 border-t-3 border-r-3 border-white rounded-tr-lg opacity-80" />
                    <div className="absolute bottom-14 left-4 w-10 h-10 border-b-3 border-l-3 border-white rounded-bl-lg opacity-80" />
                    <div className="absolute bottom-14 right-4 w-10 h-10 border-b-3 border-r-3 border-white rounded-br-lg opacity-80" />
                    
                    {/* Center crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-6 h-0.5 bg-white opacity-60" />
                      <div className="w-0.5 h-6 bg-white opacity-60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  
                  {/* Hint text */}
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                      <Camera className="w-3 h-3" />
                      Position package in frame
                    </span>
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Capture button - full width for easy tap */}
                <Button
                  onClick={handleCapturePhoto}
                  className="w-full h-16 text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Photo
                </Button>
              </div>
            )}

            {podPhoto && (
              <div className="space-y-3">
                <div className="relative">
                  <img
                    src={podPhoto}
                    alt="Proof of Delivery"
                    className="w-full rounded-xl max-h-64 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500 text-white text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Ready
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setPodPhoto(null)}
                    variant="outline"
                    className="flex-1 h-16 text-lg border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={handleCompleteDelivery}
                    disabled={isLoading}
                    className="flex-1 h-16 text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete"}
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </Card>
      )}

      {step === "completed" && currentOrder && (
        <Card className="p-5 bg-white border border-green-200">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#2d2d2d] mb-1">Delivery Complete!</h3>
              <p className="text-[#6b6b6b] text-sm">{currentOrder?.order_number} delivered successfully</p>
            </div>

            <div className="bg-[#fffdf9] rounded-xl p-4 space-y-3 border border-[#ff8303]/20">
              <div className="flex justify-between items-center">
                <span className="text-[#6b6b6b] text-sm">Payment</span>
                <Badge className={paymentMethod === "qrph" ? "bg-green-500 text-white text-[10px]" : "bg-amber-500 text-white text-[10px]"}>
                  {paymentMethod?.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6b6b6b] text-sm">Amount</span>
                <span className="text-xl font-bold text-[#fd5602]">
                  ₱{currentOrder?.cod_amount?.toLocaleString()}
                </span>
              </div>
              {/* Completion Timestamp */}
              <div className="pt-3 border-t border-[#ff8303]/20">
                <div className="flex items-center justify-center gap-2 text-[#6b6b6b]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    Completed{" "}
                    <span className="font-semibold text-[#2d2d2d]">
                      {(completedAt || new Date()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      {(completedAt || new Date()).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <Clock className="w-3.5 h-3.5 inline mr-2" />
                Completion will sync when back online
              </div>
            )}

            <Button
              onClick={handleSafeExit}
              className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white"
            >
              Back to Orders
            </Button>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && step !== "at_pickup" && step !== "proof" && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Payment Success Alert Modal */}
      {showPaymentSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <Card className="mx-4 p-6 bg-white shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-[#ff8303]/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#2d2d2d] mb-2">Payment Successful!</h3>
              <p className="text-[#6b6b6b] text-sm mb-4">
                {paymentMethod === "qrph" ? "QRPH" : "Cash"} payment of{" "}
                <span className="font-bold text-[#fd5602]">₱{currentOrder?.cod_amount?.toLocaleString()}</span>{" "}
                confirmed.
              </p>
              <div className="flex items-center justify-center gap-2 text-[#6b6b6b]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Moving to proof of delivery...</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
