import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Endpoint to check settlement status for polling
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const settlementId = searchParams.get("settlementId")
    const riderId = searchParams.get("riderId")
    const date = searchParams.get("date")

    const supabase = await createClient()

    let query = supabase.from("rider_settlements").select("*")

    if (settlementId) {
      query = query.eq("id", settlementId)
    } else if (riderId && date) {
      query = query.eq("rider_id", riderId).eq("date", date)
    } else {
      return NextResponse.json(
        { error: "Settlement ID or (Rider ID + date) is required" },
        { status: 400 }
      )
    }

    const { data: settlement, error } = await query.single()

    if (error) {
      console.error("Check settlement status DB error:", error)
      return NextResponse.json(
        { error: "Database error: " + error.message },
        { status: 500 }
      )
    }

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      )
    }

    const expectedAmount = settlement.amount
    const amountPaid = settlement.amount_paid || 0
    const remainingAmount = Math.max(0, expectedAmount - amountPaid)

    console.log(`Check settlement: Rider ${settlement.rider_id}, Date: ${settlement.date}, Status: ${settlement.status}, Paid: ${amountPaid}`)

    return NextResponse.json({
      settlementId: settlement.id,
      riderId: settlement.rider_id,
      date: settlement.date,
      status: settlement.status,
      expectedAmount,
      amountPaid,
      remainingAmount,
      isSettlementComplete: settlement.status === "confirmed",
      isInsufficient: amountPaid > 0 && amountPaid < expectedAmount,
      paymentReference: settlement.payment_reference,
      settledAt: settlement.settled_at,
    })
  } catch (error: any) {
    console.error("Check settlement status error:", error)
    return NextResponse.json(
      { error: "Failed to check settlement status" },
      { status: 500 }
    )
  }
}

