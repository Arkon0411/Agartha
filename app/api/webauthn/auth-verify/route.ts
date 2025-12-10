import { NextRequest, NextResponse } from "next/server"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { createClient } from "@supabase/supabase-js"

const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost"
const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Use service role for credential operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  try {
    const { credential, challenge } = await request.json()

    if (!credential || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find the credential in the database
    const credentialIdBase64 = credential.id
    
    console.log("Looking for credential ID:", credentialIdBase64)
    
    // First check if any credentials exist at all
    const { data: allCreds } = await supabase
      .from("webauthn_credentials")
      .select("credential_id")
      .limit(5)
    
    console.log("Existing credentials in DB:", allCreds?.map(c => c.credential_id))
    
    const { data: storedCred, error: credError } = await supabase
      .from("webauthn_credentials")
      .select("*")
      .eq("credential_id", credentialIdBase64)
      .single()

    if (credError || !storedCred) {
      console.error("Credential not found:", credError)
      console.error("Searched for:", credentialIdBase64)
      return NextResponse.json(
        { error: "Credential not found. Please login with password." },
        { status: 404 }
      )
    }

    // Get user info from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", storedCred.user_id)
      .single()

    if (userError || !userData) {
      console.error("User not found:", userError)
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Convert stored values back to Uint8Array using SimpleWebAuthn helpers
    const credentialID = isoBase64URL.toBuffer(storedCred.credential_id)
    const credentialPublicKey = isoBase64URL.toBuffer(storedCred.public_key)
    
    // Ensure counter is a number (default to 0 if null)
    const counter = storedCred.counter ?? 0

    console.log("Stored credential:", {
      credentialID: storedCred.credential_id,
      publicKeyLength: storedCred.public_key?.length,
      counter,
    })

    // Verify the authentication response
    // In SimpleWebAuthn v10+, use 'credential' instead of 'authenticator'
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialID,
        publicKey: credentialPublicKey,
        counter: counter,
      },
    })

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      )
    }

    // Update the counter to prevent replay attacks
    const newCounter = verification.authenticationInfo?.newCounter ?? 
                       (verification as any).newCounter ?? 
                       counter + 1
    
    await supabase
      .from("webauthn_credentials")
      .update({ 
        counter: newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("credential_id", credentialIdBase64)

    // Try to generate a magic link for session creation (requires service role key)
    let sessionToken = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: userData.email,
        })
        if (linkData?.properties?.hashed_token) {
          sessionToken = linkData.properties.hashed_token
        }
      } catch (e) {
        console.error("Could not generate session token:", e)
      }
    }

    // Return user info for session creation
    return NextResponse.json({
      verified: true,
      sessionToken,
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
      },
    })
  } catch (error: any) {
    console.error("Error verifying authentication:", error)
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 500 }
    )
  }
}

