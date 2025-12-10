import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { paymentMethod, riderId, cashAuditNote, payrexReference } = await request.json()

    const updateData: Record<string, any> = {
      status: "payment_confirmed",
      payment_method: paymentMethod,
      payment_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (paymentMethod === "cash" && cashAuditNote) {
      updateData.cash_audit_note = cashAuditNote
    }

    if (paymentMethod === "qrph" && payrexReference) {
      updateData.payrex_reference = payrexReference
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .eq("rider_id", riderId) // Ensure only assigned rider can confirm
      .select()
      .single()

    if (error) {
      console.error("Payment confirmation error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create payment transaction record
    await supabase.from("payment_transactions").insert({
      order_id: id,
      payment_method: paymentMethod,
      amount: order.cod_amount,
      status: "confirmed",
      payrex_reference: payrexReference,
      confirmed_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      order,
      confirmedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Payment confirmation exception:", error)
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 })
  }
}
