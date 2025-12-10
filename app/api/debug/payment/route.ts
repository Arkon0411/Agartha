import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// DEBUG: Manually trigger payment confirmation
// Usage: POST /api/debug/payment with { orderId, amount }

export async function POST(request: NextRequest) {
  try {
    const { orderId, amount } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the order first
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ 
        error: "Order not found", 
        details: fetchError 
      }, { status: 404 })
    }

    const payAmount = amount || order.cod_amount
    
    // Update the order to payment_confirmed
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "payment_confirmed",
        payment_confirmed_at: new Date().toISOString(),
        amount_paid: payAmount,
        payment_error: null,
      })
      .eq("id", orderId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ 
        error: "Update failed", 
        details: updateError,
        message: updateError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Payment confirmed!",
      order: updated,
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    usage: "POST with { orderId: 'uuid', amount: 500 }",
    description: "Manually confirm payment for testing",
  })
}

