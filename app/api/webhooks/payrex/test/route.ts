import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// LOCAL TESTING ONLY: Manually trigger a payment webhook
// Usage: POST /api/webhooks/payrex/test with { orderId, amount }

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test endpoint not available in production" },
      { status: 403 }
    )
  }

  try {
    const { orderId, amount } = await request.json()

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: "orderId and amount are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Find the order
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    const expectedAmount = order.cod_amount
    const previouslyPaid = order.amount_paid || 0
    const totalPaid = previouslyPaid + amount

    console.log(`[TEST] Order ${order.order_number}: Expected ₱${expectedAmount}, Total Paid: ₱${totalPaid}`)

    if (totalPaid >= expectedAmount) {
      // Payment complete
      await supabase
        .from("orders")
        .update({
          status: "payment_confirmed",
          payment_confirmed_at: new Date().toISOString(),
          amount_paid: totalPaid,
          payment_error: null,
        })
        .eq("id", orderId)

      return NextResponse.json({
        success: true,
        status: "payment_confirmed",
        message: `Payment confirmed! Total: ₱${totalPaid}`,
      })
    } else {
      // Insufficient payment
      const remainingAmount = expectedAmount - totalPaid

      await supabase
        .from("orders")
        .update({
          amount_paid: totalPaid,
          payment_error: `Insufficient payment. Need ₱${remainingAmount} more`,
        })
        .eq("id", orderId)

      return NextResponse.json({
        success: true,
        status: "insufficient",
        message: `Partial payment received. Need ₱${remainingAmount} more.`,
        amountPaid: totalPaid,
        remainingAmount,
      })
    }
  } catch (error: any) {
    console.error("Test webhook error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 })
  }
  
  return NextResponse.json({
    message: "Test webhook endpoint",
    usage: "POST with { orderId: 'uuid', amount: 100 }",
  })
}

