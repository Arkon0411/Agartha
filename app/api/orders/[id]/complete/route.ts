import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { proofPhotoUrl, riderId, paymentMethod, latitude, longitude } = await request.json()

    // Update order to completed
    const { data: order, error } = await supabase
      .from("orders")
      .update({
        status: "completed",
        pod_photo_url: proofPhotoUrl,
        pod_latitude: latitude,
        pod_longitude: longitude,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("rider_id", riderId) // Ensure only assigned rider can complete
      .select()
      .single()

    if (error) {
      console.error("Complete delivery error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the completion
    console.log(`Delivery completed for order ${id}:`, {
      riderId,
      paymentMethod,
      hasProofPhoto: !!proofPhotoUrl,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      order,
      settledAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Complete delivery exception:", error)
    return NextResponse.json({ error: "Failed to complete delivery" }, { status: 500 })
  }
}
