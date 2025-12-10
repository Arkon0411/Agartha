import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Endpoint to check payment status for polling
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (error) {
      console.error("Check status DB error:", error)
      return NextResponse.json(
        { error: "Database error: " + error.message },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    const expectedAmount = order.cod_amount
    const amountPaid = order.amount_paid || 0
    const remainingAmount = Math.max(0, expectedAmount - amountPaid)

    console.log(`Check status: Order ${order.order_number}, Status: ${order.status}, Paid: ${amountPaid}`)

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      expectedAmount,
      amountPaid,
      remainingAmount,
      isPaymentComplete: order.status === "payment_confirmed",
      isInsufficient: amountPaid > 0 && amountPaid < expectedAmount,
      paymentError: order.payment_error,
    })
  } catch (error: any) {
    console.error("Check status error:", error)
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    )
  }
}

