import { NextRequest, NextResponse } from "next/server"
import { verifyRegistrationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { createClient } from "@supabase/supabase-js"

const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost"
const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Use service role for inserting credentials
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, credential, challenge } = await request.json()

    if (!userId || !credential || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      )
    }

    console.log("Registration info:", JSON.stringify(verification.registrationInfo, null, 2))

    // In SimpleWebAuthn v10+, the structure changed
    const regInfo = verification.registrationInfo
    
    // Get public key and counter from registrationInfo
    let publicKeyBytes: Uint8Array
    let counter: number

    if ('credential' in regInfo && regInfo.credential) {
      // New structure (v10+)
      publicKeyBytes = regInfo.credential.publicKey
      counter = regInfo.credential.counter
    } else if ('credentialPublicKey' in regInfo) {
      // Old structure
      publicKeyBytes = (regInfo as any).credentialPublicKey
      counter = (regInfo as any).counter
    } else {
      console.error("Unknown registrationInfo structure:", regInfo)
      return NextResponse.json(
        { error: "Unknown credential structure" },
        { status: 500 }
      )
    }

    // Use credential ID directly from client request - it's already base64url encoded
    const credentialIdBase64 = credential.id
    const publicKeyBase64 = isoBase64URL.fromBuffer(publicKeyBytes)

    console.log("Storing credential ID (from client):", credentialIdBase64)
    console.log("Public key base64:", publicKeyBase64?.substring(0, 50) + "...")
    console.log("For user ID:", userId)

    // Store the credential in the database
    const { data: insertedData, error: dbError } = await supabase
      .from("webauthn_credentials")
      .insert({
        user_id: userId,
        credential_id: credentialIdBase64,
        public_key: publicKeyBase64,
        counter: counter,
        device_type: credential.authenticatorAttachment || "platform",
        transports: credential.response.transports || [],
      })
      .select()

    if (dbError) {
      console.error("Error storing credential:", dbError)
      return NextResponse.json(
        { error: "Failed to store credential: " + dbError.message },
        { status: 500 }
      )
    }

    console.log("Successfully stored credential:", insertedData)

    return NextResponse.json({ 
      verified: true,
      message: "Biometric registered successfully" 
    })
  } catch (error: any) {
    console.error("Error verifying registration:", error)
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 500 }
    )
  }
}

