"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X } from "lucide-react"

interface ProofOfDeliveryCaptureProps {
  onSubmit: (photoUrl: string) => void
  isLoading: boolean
}

export default function ProofOfDeliveryCapture({ onSubmit, isLoading }: ProofOfDeliveryCaptureProps) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)

  const handleCameraCapture = async () => {
    if (isCameraActive) {
      // Capture from camera
      if (canvasRef.current && videoRef.current) {
        const context = canvasRef.current.getContext("2d")
        if (context) {
          context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
          const capturedImage = canvasRef.current.toDataURL("image/jpeg")
          setPhoto(capturedImage)
          setIsCameraActive(false)
          if (videoRef.current.srcObject) {
            ;(videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop())
          }
        }
      }
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsCameraActive(true)
        }
      } catch (err) {
        setError("Cannot access camera")
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPhoto(event.target?.result as string)
        setError("")
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = () => {
    if (!photo) {
      setError("Please capture or upload a photo")
      return
    }
    onSubmit(photo)
  }

  const handleClear = () => {
    setPhoto(null)
    setError("")
    if (isCameraActive && videoRef.current?.srcObject) {
      ;(videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop())
      setIsCameraActive(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="text-center space-y-4">
        <h3 className="font-bold text-slate-900 mb-4">Proof of Delivery</h3>
        <p className="text-slate-600 text-sm">Capture a photo or upload proof that package was delivered</p>

        {!photo && !isCameraActive && (
          <div className="space-y-3 py-8">
            <Camera className="w-12 h-12 text-slate-300 mx-auto" />

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleCameraCapture} className="bg-blue-500 hover:bg-blue-600">
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>

              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        )}

        {isCameraActive && (
          <div className="space-y-4">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black max-h-80 object-cover" />
            <canvas ref={canvasRef} className="hidden" width={640} height={480} />
            <Button onClick={handleCameraCapture} className="w-full bg-green-500 hover:bg-green-600">
              Capture Photo
            </Button>
            <Button onClick={handleClear} variant="outline" className="w-full bg-transparent">
              Cancel
            </Button>
          </div>
        )}

        {photo && (
          <div className="space-y-4">
            <img
              src={photo || "/placeholder.svg"}
              alt="Proof of delivery"
              className="w-full max-h-80 object-cover rounded-lg border-2 border-slate-200"
            />

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isLoading} className="flex-1 bg-green-500 hover:bg-green-600">
                {isLoading ? "Submitting..." : "Submit Proof"}
              </Button>

              <Button onClick={handleClear} disabled={isLoading} variant="outline" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
