import { NextRequest, NextResponse } from "next/server"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { createClient } from "@supabase/supabase-js"

const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost"

// Use service role for reading credentials
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // If email provided, get user's credentials
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] | undefined = undefined
    
    if (email) {
      // First get the user ID from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single()

      console.log("Looking up user:", email, "Found:", userData?.id)

      if (userData) {
        // Get the user's registered credentials
        const { data: credentials } = await supabase
          .from("webauthn_credentials")
          .select("credential_id, transports")
          .eq("user_id", userData.id)

        console.log("Found credentials:", credentials?.length)

        if (credentials && credentials.length > 0) {
          // Filter out empty credential IDs and map to the expected format
          allowCredentials = credentials
            .filter(cred => cred.credential_id && cred.credential_id.length > 0)
            .map((cred) => ({
              id: cred.credential_id, // Pass as base64url string, library handles conversion
              transports: (cred.transports as AuthenticatorTransport[]) || ["internal"],
            }))
          
          console.log("Allowed credentials:", allowCredentials)
        }
      }
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: allowCredentials && allowCredentials.length > 0 ? allowCredentials : undefined,
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error("Error generating auth options:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate options" },
      { status: 500 }
    )
  }
}

