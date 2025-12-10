import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riderId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") || "today"

    const supabase = await createClient()

    // Calculate date range
    let startDate: string
    let endDate: string

    if (date === "today") {
      const today = new Date()
      startDate = today.toISOString().split("T")[0] + "T00:00:00"
      endDate = today.toISOString().split("T")[0] + "T23:59:59"
    } else {
      startDate = date + "T00:00:00"
      endDate = date + "T23:59:59"
    }

    // Fetch completed orders for the rider within the date range
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("rider_id", riderId)
      .eq("status", "completed")
      .gte("completed_at", startDate)
      .lte("completed_at", endDate)
      .order("completed_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const completedOrders = orders || []

    // Calculate settlement data
    const qrphOrders = completedOrders.filter(o => o.payment_method === "qrph")
    const cashOrders = completedOrders.filter(o => o.payment_method === "cash")

    const settlement = {
      date: date === "today" ? new Date().toISOString().split("T")[0] : date,
      riderId,
      totalDeliveries: completedOrders.length,
      completedDeliveries: completedOrders.length,
      qrphAmount: qrphOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      qrphCount: qrphOrders.length,
      cashAmount: cashOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      cashCount: cashOrders.length,
      totalCollected: completedOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      recentDeliveries: completedOrders.slice(0, 10).map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.delivery_contact_name,
        amount: o.cod_amount,
        paymentMethod: o.payment_method,
        completedAt: o.completed_at,
      })),
    }

    return NextResponse.json({ settlement })
  } catch (error) {
    console.error("Settlement API error:", error)
    return NextResponse.json({ error: "Failed to fetch settlement" }, { status: 500 })
  }
}
