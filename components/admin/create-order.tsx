"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Package, MapPin, User, Phone, Loader2, CheckCircle2, Copy } from "lucide-react"
import { LocationPicker, LeafletCSS } from "@/components/maps/dynamic-maps"

interface Location {
  lat: number
  lng: number
  address: string
}

interface AdminCreateOrderProps {
  onBack: () => void
  onSuccess: () => void
}

export default function AdminCreateOrder({ onBack, onSuccess }: AdminCreateOrderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdOrder, setCreatedOrder] = useState<{
    order_number: string
    barcode: string
    barcode_image_url: string
  } | null>(null)

  // Location states for map picker
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null)
  const [deliveryLocation, setDeliveryLocation] = useState<Location | null>(null)

  const [formData, setFormData] = useState({
    package_description: "",
    cod_amount: "",
    pickup_address: "",
    pickup_contact_name: "",
    pickup_contact_phone: "",
    delivery_address: "",
    delivery_contact_name: "",
    delivery_contact_phone: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // Format Philippine phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Handle different formats
    if (digits.startsWith('63')) {
      // +63 format
      const num = digits.slice(2)
      if (num.length <= 3) return `+63 ${num}`
      if (num.length <= 6) return `+63 ${num.slice(0, 3)} ${num.slice(3)}`
      return `+63 ${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 10)}`
    } else if (digits.startsWith('0')) {
      // 09XX format
      if (digits.length <= 4) return digits
      if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
    } else if (digits.length > 0) {
      // Assume 9XX format, add 0 prefix
      const withPrefix = '0' + digits
      if (withPrefix.length <= 4) return withPrefix
      if (withPrefix.length <= 7) return `${withPrefix.slice(0, 4)} ${withPrefix.slice(4)}`
      return `${withPrefix.slice(0, 4)} ${withPrefix.slice(4, 7)} ${withPrefix.slice(7, 11)}`
    }
    return value
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const formatted = formatPhoneNumber(value)
    setFormData(prev => ({
      ...prev,
      [name]: formatted
    }))
  }

  const generateOrderNumber = () => {
    const date = new Date()
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "")
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `ORD-${dateStr}-${random}`
  }

  const generateBarcode = () => {
    const date = new Date()
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "")
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    return `PKG${dateStr}${random}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate locations
    if (!pickupLocation) {
      setError("Please select a pickup location on the map")
      return
    }
    if (!deliveryLocation) {
      setError("Please select a delivery location on the map")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      
      const orderNumber = generateOrderNumber()
      const barcode = generateBarcode()
      
      // Generate barcode image URL using a barcode API
      const barcodeImageUrl = `https://barcodeapi.org/api/128/${barcode}`

      const { data, error: insertError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          package_description: formData.package_description || "Package",
          cod_amount: parseFloat(formData.cod_amount),
          barcode: barcode,
          barcode_image_url: barcodeImageUrl,
          pickup_address: pickupLocation?.address || formData.pickup_address,
          pickup_latitude: pickupLocation?.lat || null,
          pickup_longitude: pickupLocation?.lng || null,
          pickup_contact_name: formData.pickup_contact_name,
          pickup_contact_phone: formData.pickup_contact_phone,
          delivery_address: deliveryLocation?.address || formData.delivery_address,
          delivery_latitude: deliveryLocation?.lat || null,
          delivery_longitude: deliveryLocation?.lng || null,
          delivery_contact_name: formData.delivery_contact_name,
          delivery_contact_phone: formData.delivery_contact_phone,
          status: "pending",
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return
      }

      setCreatedOrder({
        order_number: orderNumber,
        barcode: barcode,
        barcode_image_url: barcodeImageUrl,
      })
    } catch (err) {
      setError("Failed to create order")
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handlePrint = () => {
    // Create a new window for printing just the barcode
    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Barcode - ${createdOrder?.order_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              margin: 0;
            }
            .barcode-container {
              border: 2px dashed #ccc;
              padding: 20px;
              display: inline-block;
              margin: 10px auto;
            }
            .barcode-image {
              max-width: 100%;
              height: auto;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 14px;
              margin-top: 10px;
              letter-spacing: 2px;
            }
            .order-number {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
            }
            @media print {
              body { padding: 0; }
              .barcode-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <div class="order-number">${createdOrder?.order_number}</div>
            <img src="${createdOrder?.barcode_image_url}" alt="Barcode" class="barcode-image" />
            <div class="barcode-text">${createdOrder?.barcode}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  if (createdOrder) {
    return (
      <div className="min-h-screen bg-[#fffdf9] p-4">
        <div className="max-w-lg mx-auto">
          <Card className="p-6 bg-white border border-[#ff8303]/30">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-[#2d2d2d] mb-2">Order Created!</h2>
                <p className="text-[#6b6b6b]">Print the barcode and attach to package</p>
              </div>

              <div className="bg-[#fffdf9] rounded-xl p-5 space-y-4 border border-[#ff8303]/20">
                <div>
                  <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-1">ORDER NUMBER</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-[#2d2d2d]">{createdOrder.order_number}</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(createdOrder.order_number)}
                      className="border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-1">PACKAGE BARCODE</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-lg text-[#2d2d2d]">{createdOrder.barcode}</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(createdOrder.barcode)}
                      className="border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#ff8303]/20">
                  <p className="text-[10px] text-[#6b6b6b] font-medium tracking-wide mb-3">BARCODE IMAGE</p>
                  <div className="bg-white p-4 rounded-lg border border-[#ff8303]/30">
                    <img 
                      src={createdOrder.barcode_image_url} 
                      alt="Package Barcode"
                      className="mx-auto max-h-24"
                    />
                    <p className="text-center text-xs text-[#6b6b6b] mt-2 font-mono">
                      {createdOrder.barcode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="flex-1 h-14 text-lg border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10"
                >
                  Print Barcode
                </Button>
                <Button
                  onClick={onSuccess}
                  className="flex-1 h-14 text-lg bg-[#fd5602] hover:bg-[#e54d00] text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffdf9]">
      {/* Load Leaflet CSS */}
      <LeafletCSS />
      
      {/* Header */}
      <header className="bg-white border-b border-[#ff8303]/30 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="border-[#ff8303]/30 text-[#6b6b6b] hover:bg-[#ff8303]/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-[#2d2d2d]">Create Order</h1>
            <p className="text-xs text-[#6b6b6b]">New delivery order with barcode</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Package Info */}
          <Card className="p-4 border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#ff8303]/10 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-[#fd5602]" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d]">Package Details</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                  Description
                </label>
                <Input
                  name="package_description"
                  placeholder="e.g., Electronics, Documents, etc."
                  value={formData.package_description}
                  onChange={handleChange}
                  className="h-12 text-base border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                  COD Amount (₱) *
                </label>
                <Input
                  name="cod_amount"
                  type="number"
                  placeholder="0.00"
                  value={formData.cod_amount}
                  onChange={handleChange}
                  className="h-14 text-2xl font-bold border-[#ff8303]/30 focus:ring-[#fd5602]/30 text-[#fd5602]"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </Card>

          {/* Pickup Location */}
          <Card className="p-4 border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d]">Pickup Location</h3>
            </div>
            
            <div className="space-y-4">
              <LocationPicker
                value={pickupLocation}
                onChange={setPickupLocation}
                placeholder="Search pickup address..."
                label="Pickup Address *"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                    <User className="w-3 h-3 inline mr-1" />
                    Contact *
                  </label>
                  <Input
                    name="pickup_contact_name"
                    placeholder="Name"
                    value={formData.pickup_contact_name}
                    onChange={handleChange}
                    className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Phone
                  </label>
                  <Input
                    name="pickup_contact_phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="0917 123 4567"
                    value={formData.pickup_contact_phone}
                    onChange={handlePhoneChange}
                    className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery Location */}
          <Card className="p-4 border border-[#ff8303]/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-red-600" />
              </div>
              <h3 className="font-semibold text-[#2d2d2d]">Delivery Location</h3>
            </div>
            
            <div className="space-y-4">
              <LocationPicker
                value={deliveryLocation}
                onChange={setDeliveryLocation}
                placeholder="Search delivery address..."
                label="Delivery Address *"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                    <User className="w-3 h-3 inline mr-1" />
                    Contact *
                  </label>
                  <Input
                    name="delivery_contact_name"
                    placeholder="Name"
                    value={formData.delivery_contact_name}
                    onChange={handleChange}
                    className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b6b6b] mb-2">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Phone
                  </label>
                  <Input
                    name="delivery_contact_phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="0917 123 4567"
                    value={formData.delivery_contact_phone}
                    onChange={handlePhoneChange}
                    className="h-12 border-[#ff8303]/30 focus:ring-[#fd5602]/30"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>
          </Card>

          {error && (
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-16 text-lg font-bold bg-[#fd5602] hover:bg-[#e54d00] text-white rounded-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <Package className="w-5 h-5 mr-2" />
                Create Order & Generate Barcode
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

