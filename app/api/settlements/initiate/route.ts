import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Static QRPH image URL (same as customer payments)
const STATIC_QRPH_IMAGE_URL = process.env.STATIC_QRPH_IMAGE_URL || "/static-qrph.png"

export async function POST(request: NextRequest) {
  try {
    const { riderId, date, amount } = await request.json()

    if (!riderId || !date || !amount) {
      return NextResponse.json(
        { error: "Rider ID, date, and amount are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if settlement already exists for this date
    const { data: existingSettlement } = await supabase
      .from("rider_settlements")
      .select("*")
      .eq("rider_id", riderId)
      .eq("date", date)
      .single()

    if (existingSettlement && existingSettlement.status === "confirmed") {
      return NextResponse.json(
        { error: "Settlement already completed for this date" },
        { status: 400 }
      )
    }

    // Generate a unique reference for this settlement
    const settlementReference = `SET-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create or update settlement record
    const settlementData = {
      rider_id: riderId,
      date: date,
      amount: amount,
      settlement_reference: settlementReference,
      status: "pending",
      amount_paid: 0,
      initiated_at: new Date().toISOString(),
    }

    let settlement
    if (existingSettlement) {
      // Update existing pending settlement
      const { data, error } = await supabase
        .from("rider_settlements")
        .update(settlementData)
        .eq("id", existingSettlement.id)
        .select()
        .single()

      if (error) {
        console.error("Failed to update settlement:", error)
        return NextResponse.json(
          { error: "Failed to initiate settlement" },
          { status: 500 }
        )
      }
      settlement = data
    } else {
      // Create new settlement
      const { data, error } = await supabase
        .from("rider_settlements")
        .insert(settlementData)
        .select()
        .single()

      if (error) {
        console.error("Failed to create settlement:", error)
        return NextResponse.json(
          { error: "Failed to initiate settlement" },
          { status: 500 }
        )
      }
      settlement = data
    }

    return NextResponse.json({
      success: true,
      settlementId: settlement.id,
      settlementReference,
      staticQrImageUrl: STATIC_QRPH_IMAGE_URL,
      expectedAmount: amount,
      amountPaid: 0,
    })
  } catch (error: any) {
    console.error("Settlement initiation error:", error)
    return NextResponse.json(
      { error: "Failed to initiate settlement: " + (error?.message || "Unknown error") },
      { status: 500 }
    )
  }
}

