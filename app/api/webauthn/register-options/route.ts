import { NextRequest, NextResponse } from "next/server"
import { generateRegistrationOptions } from "@simplewebauthn/server"
import { isoUint8Array } from "@simplewebauthn/server/helpers"

// Your app's details - update for production
const rpName = "Agartha Delivery"
const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost"
const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function POST(request: NextRequest) {
  try {
    const { userId, userName, userDisplayName } = await request.json()

    if (!userId || !userName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Convert UUID string to Uint8Array using SimpleWebAuthn helper
    const userIdBytes = isoUint8Array.fromUTF8String(userId)

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdBytes,
      userName,
      userDisplayName: userDisplayName || userName,
      // Don't prompt for attestation - we just want the credential
      attestationType: "none",
      // Support both platform (Face ID, Touch ID) and cross-platform (security keys)
      authenticatorSelection: {
        // Prefer platform authenticators (built-in biometrics)
        authenticatorAttachment: "platform",
        // User verification (biometric) is required
        userVerification: "required",
        // Create a discoverable credential (passkey)
        residentKey: "preferred",
        requireResidentKey: false,
      },
      // Supported algorithms
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error("Error generating registration options:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate options" },
      { status: 500 }
    )
  }
}

