import { type NextRequest, NextResponse } from "next/server"
import { createWebhookClient } from "@/lib/supabase/webhook"
import crypto from "crypto"

// PayRex webhook handler for Static QRPH payments
// Features: Signature verification, Idempotency, Retry logic

// ============================================
// 1. SIGNATURE VERIFICATION
// ============================================
function verifyPayRexSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    console.log("Signature verification skipped: missing signature or secret")
    return true // Skip verification if no secret configured
  }

  try {
    // PayRex uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("hex")

    // Check various signature formats
    // Format 1: Plain hex signature
    if (signature === expectedSignature) {
      return true
    }
    
    // Format 2: With "sha256=" prefix
    if (signature === `sha256=${expectedSignature}`) {
      return true
    }

    // Format 3: Timing-safe comparison for same-length signatures
    if (signature.length === expectedSignature.length) {
      const signatureBytes = new Uint8Array(Buffer.from(signature, 'utf8'))
      const expectedBytes = new Uint8Array(Buffer.from(expectedSignature, 'utf8'))
      return crypto.timingSafeEqual(signatureBytes, expectedBytes)
    }

    console.log("Signature mismatch")
    console.log("Expected:", expectedSignature.substring(0, 20) + "...")
    console.log("Received:", signature.substring(0, 20) + "...")
    return false
  } catch (error) {
    console.error("Signature verification error:", error)
    return false
  }
}

// ============================================
// 2. MAIN WEBHOOK HANDLER
// ============================================
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.text()
    
    console.log("PayRex webhook received")

    // ----------------------------------------
    // SIGNATURE VERIFICATION
    // ----------------------------------------
    const webhookSecret = process.env.PAYREX_WEBHOOK_SECRET
    const signature = request.headers.get("payrex-signature") || 
                      request.headers.get("x-payrex-signature") ||
                      request.headers.get("x-webhook-signature")

    if (webhookSecret && !verifyPayRexSignature(body, signature, webhookSecret)) {
      console.error("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // ----------------------------------------
    // PARSE PAYLOAD
    // ----------------------------------------
    let payload
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      console.error("Failed to parse webhook body:", body.substring(0, 500))
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    
    console.log("PayRex webhook payload:", JSON.stringify(payload, null, 2))

    // ----------------------------------------
    // IDEMPOTENCY CHECK
    // Extract event ID for duplicate detection
    // ----------------------------------------
    const eventId = payload.id || payload.event_id || `evt_${Date.now()}`
    console.log(`Processing event: ${eventId}`)

    // Extract payment data
    const eventType = payload.type || payload.event || "payment"
    const data = payload.data?.attributes || payload.data || payload.attributes || payload
    
    // Get amount (PayRex sends in cents)
    const amountPaidCents = data.amount || data.amount_received || payload.amount || 0
    const amountPaid = typeof amountPaidCents === 'number' ? amountPaidCents / 100 : parseFloat(amountPaidCents) / 100

    console.log(`Payment received: ₱${amountPaid} (${amountPaidCents} cents)`)

    // ----------------------------------------
    // DATABASE OPERATIONS (with retry logic)
    // ----------------------------------------
    const supabase = createWebhookClient()

    // Find pending order
    const { data: pendingOrders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "payment_pending")
      .order("updated_at", { ascending: false })
      .limit(1)

    // Also check for pending settlements
    const { data: pendingSettlements, error: settlementFetchError } = await supabase
      .from("rider_settlements")
      .select("*")
      .eq("status", "pending")
      .order("initiated_at", { ascending: false })
      .limit(1)

    // RETRY LOGIC: Return 500 on database errors so PayRex will retry
    if (fetchError || settlementFetchError) {
      console.error("Database fetch error (will retry):", fetchError || settlementFetchError)
      return NextResponse.json(
        { error: "Database error", retryable: true },
        { status: 500 }
      )
    }

    console.log("Pending orders found:", pendingOrders?.length || 0)
    console.log("Pending settlements found:", pendingSettlements?.length || 0)

    // ----------------------------------------
    // PROCESS SETTLEMENT FIRST (if exists)
    // ----------------------------------------
    if (pendingSettlements && pendingSettlements.length > 0) {
      const settlement = pendingSettlements[0]
      
      // Check idempotency
      if (settlement.last_webhook_event_id === eventId) {
        console.log(`⚠️ Duplicate settlement webhook detected: ${eventId} - skipping`)
        return NextResponse.json({
          received: true,
          status: "duplicate",
          message: "Event already processed",
          eventId
        })
      }

      const expectedAmount = settlement.amount
      const previouslyPaid = settlement.amount_paid || 0
      const totalPaid = previouslyPaid + amountPaid

      console.log(`Settlement for rider ${settlement.rider_id}: Expected ₱${expectedAmount}, Previously Paid: ₱${previouslyPaid}, New Payment: ₱${amountPaid}, Total: ₱${totalPaid}`)

      if (totalPaid >= expectedAmount) {
        // Settlement complete!
        const { error: updateError } = await supabase
          .from("rider_settlements")
          .update({
            status: "confirmed",
            settled_at: new Date().toISOString(),
            amount_paid: totalPaid,
            last_webhook_event_id: eventId,
          })
          .eq("id", settlement.id)
          .eq("status", "pending")

        if (updateError) {
          console.error("Failed to update settlement (will retry):", updateError)
          return NextResponse.json(
            { error: "Update failed", retryable: true },
            { status: 500 }
          )
        }

        const duration = Date.now() - startTime
        console.log(`✅ Settlement CONFIRMED for rider ${settlement.rider_id} (${duration}ms)`)
        
        return NextResponse.json({
          received: true,
          status: "settlement_confirmed",
          settlementId: settlement.id,
          riderId: settlement.rider_id,
          amountPaid: totalPaid,
          expectedAmount,
          eventId,
          processingTimeMs: duration
        })
      } else {
        // Insufficient settlement payment
        const remainingAmount = expectedAmount - totalPaid

        const { error: updateError } = await supabase
          .from("rider_settlements")
          .update({
            amount_paid: totalPaid,
            last_webhook_event_id: eventId,
          })
          .eq("id", settlement.id)

        if (updateError) {
          console.error("Failed to update settlement (will retry):", updateError)
          return NextResponse.json(
            { error: "Update failed", retryable: true },
            { status: 500 }
          )
        }

        const duration = Date.now() - startTime
        console.log(`⚠️ Insufficient settlement payment for rider ${settlement.rider_id}. Need ₱${remainingAmount} more. (${duration}ms)`)

        return NextResponse.json({
          received: true,
          status: "settlement_insufficient",
          settlementId: settlement.id,
          riderId: settlement.rider_id,
          amountPaid: totalPaid,
          expectedAmount,
          remainingAmount,
          eventId,
          processingTimeMs: duration
        })
      }
    }

    // ----------------------------------------
    // PROCESS ORDER PAYMENT
    // ----------------------------------------
    if (!pendingOrders || pendingOrders.length === 0) {
      console.log("No pending orders or settlements found for this payment")
      // Return 200 - no retry needed, just no matching record
      return NextResponse.json({ 
        received: true, 
        warning: "No pending order or settlement found",
        eventId 
      })
    }

    const order = pendingOrders[0]

    // ----------------------------------------
    // IDEMPOTENCY: Check if this event was already processed
    // ----------------------------------------
    if (order.last_webhook_event_id === eventId) {
      console.log(`⚠️ Duplicate webhook detected: ${eventId} - skipping`)
      return NextResponse.json({
        received: true,
        status: "duplicate",
        message: "Event already processed",
        eventId
      })
    }

    const expectedAmount = order.cod_amount
    const previouslyPaid = order.amount_paid || 0
    const totalPaid = previouslyPaid + amountPaid

    console.log(`Order ${order.order_number}: Expected ₱${expectedAmount}, Previously Paid: ₱${previouslyPaid}, New Payment: ₱${amountPaid}, Total: ₱${totalPaid}`)

    // ----------------------------------------
    // UPDATE ORDER
    // ----------------------------------------
    if (totalPaid >= expectedAmount) {
      // Payment complete!
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "payment_confirmed",
          payment_confirmed_at: new Date().toISOString(),
          amount_paid: totalPaid,
          payment_error: null,
          last_webhook_event_id: eventId, // Idempotency tracking
        })
        .eq("id", order.id)
        .eq("status", "payment_pending") // Optimistic locking

      // RETRY LOGIC: Return 500 on update errors
      if (updateError) {
        console.error("Failed to update order (will retry):", updateError)
        return NextResponse.json(
          { error: "Update failed", retryable: true },
          { status: 500 }
        )
      }

      const duration = Date.now() - startTime
      console.log(`✅ Payment CONFIRMED for order ${order.order_number} (${duration}ms)`)
      
      return NextResponse.json({
        received: true,
        status: "payment_confirmed",
        orderId: order.id,
        orderNumber: order.order_number,
        amountPaid: totalPaid,
        expectedAmount,
        eventId,
        processingTimeMs: duration
      })
    } else {
      // Insufficient payment
      const remainingAmount = expectedAmount - totalPaid

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          amount_paid: totalPaid,
          payment_error: `Insufficient payment. Paid: ₱${totalPaid}, Need: ₱${remainingAmount} more`,
          last_webhook_event_id: eventId, // Idempotency tracking
        })
        .eq("id", order.id)

      if (updateError) {
        console.error("Failed to update order (will retry):", updateError)
        return NextResponse.json(
          { error: "Update failed", retryable: true },
          { status: 500 }
        )
      }

      const duration = Date.now() - startTime
      console.log(`⚠️ Insufficient payment for order ${order.order_number}. Need ₱${remainingAmount} more. (${duration}ms)`)

      return NextResponse.json({
        received: true,
        status: "insufficient",
        orderId: order.id,
        orderNumber: order.order_number,
        amountPaid: totalPaid,
        expectedAmount,
        remainingAmount,
        eventId,
        processingTimeMs: duration
      })
    }

  } catch (error: any) {
    // RETRY LOGIC: Return 500 on unexpected errors so PayRex will retry
    console.error("PayRex webhook error (will retry):", error)
    
    // Check if it's a network/timeout error
    const isNetworkError = error.code === 'ECONNRESET' || 
                           error.code === 'ETIMEDOUT' ||
                           error.code === 'ENOTFOUND' ||
                           error.message?.includes('network') ||
                           error.message?.includes('timeout')
    
    return NextResponse.json(
      { 
        error: error.message,
        retryable: true,
        isNetworkError
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET endpoint to verify webhook is accessible
// ============================================
export async function GET(request: NextRequest) {
  const hasWebhookSecret = !!process.env.PAYREX_WEBHOOK_SECRET
  
  return NextResponse.json({ 
    status: "active",
    message: "PayRex webhook endpoint is ready for Static QRPH payments",
    features: {
      signatureVerification: hasWebhookSecret,
      idempotency: true,
      retryLogic: true
    },
    timestamp: new Date().toISOString()
  })
}
