import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Static QRPH image URL from PayRex dashboard
// Replace this with your actual static QRPH image URL
const STATIC_QRPH_IMAGE_URL = process.env.STATIC_QRPH_IMAGE_URL || "/static-qrph.png"

export async function POST(request: NextRequest) {
  try {
    const { orderId, amount, description } = await request.json()

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: "Order ID and amount are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Generate a unique reference for this payment request
    const paymentReference = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Update order with payment pending status and expected amount
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "payment_pending",
        payment_method: "qrph",
        payrex_reference: paymentReference,
        // Track how much has been paid (start at 0)
        amount_paid: 0,
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("Failed to update order:", updateError)
      return NextResponse.json(
        { error: "Failed to initiate payment" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentReference,
      staticQrImageUrl: STATIC_QRPH_IMAGE_URL,
      expectedAmount: amount,
      amountPaid: 0,
    })
  } catch (error: any) {
    console.error("QRPH generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate QR code: " + (error?.message || "Unknown error") },
      { status: 500 }
    )
  }
}
