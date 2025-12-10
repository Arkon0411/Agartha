import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Upload POD photo to Supabase Storage instead of storing base64 in database
export async function POST(request: NextRequest) {
  try {
    const { orderId, photoBase64 } = await request.json()

    if (!orderId || !photoBase64) {
      return NextResponse.json(
        { error: "Order ID and photo data are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      )
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `pod/${orderId}/${timestamp}.jpg`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("delivery-photos")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      
      // If bucket doesn't exist, return a message but still allow the order to complete
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json({
          success: true,
          photoUrl: null,
          warning: "Storage bucket not configured. Photo stored as base64 fallback.",
          fallbackToBase64: true,
        })
      }
      
      return NextResponse.json(
        { error: "Failed to upload photo: " + uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from("delivery-photos")
      .getPublicUrl(fileName)

    const photoUrl = publicUrlData.publicUrl

    console.log(`POD photo uploaded for order ${orderId}: ${photoUrl}`)

    return NextResponse.json({
      success: true,
      photoUrl,
      fileName,
    })
  } catch (error: any) {
    console.error("POD upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    )
  }
}
