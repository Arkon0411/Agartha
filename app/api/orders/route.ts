import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const riderId = searchParams.get("riderId")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    // Only select needed columns - exclude large fields like pod_photo_url
    let query = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        package_description,
        cod_amount,
        barcode,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        pickup_contact_name,
        pickup_contact_phone,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_contact_name,
        delivery_contact_phone,
        status,
        payment_method,
        rider_id,
        accepted_at,
        picked_up_at,
        arrived_at,
        payment_confirmed_at,
        completed_at,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })

    if (riderId) {
      query = query.eq("rider_id", riderId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    // Add pagination
    const { data: orders, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      orders,
      pagination: {
        page,
        limit,
        hasMore: orders?.length === limit
      }
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data: order, error } = await supabase
      .from("orders")
      .insert(body)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
