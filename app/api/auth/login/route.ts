import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }

    // Fetch user profile
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single()

    if (userError || !userData) {
      // User authenticated but no profile - create one
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          full_name: authData.user.user_metadata?.full_name || email.split("@")[0],
          role: authData.user.user_metadata?.role || "rider",
          is_active: true,
        })
        .select()
        .single()

      return NextResponse.json({
        user: newUser,
        riderId: authData.user.id,
        role: newUser?.role || "rider",
      })
    }

    return NextResponse.json({
      user: userData,
      riderId: userData.id,
      role: userData.role,
      name: userData.full_name,
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
