import { createClient } from "@/lib/supabase/client"

/**
 * Forcefully logout user - clears all sessions, storage, and cookies
 */
export async function forceLogout(): Promise<void> {
  const supabase = createClient()

  try {
    // Sign out from Supabase (clears auth session)
    await supabase.auth.signOut()
  } catch (error) {
    console.error("Supabase signOut error:", error)
  }

  // Clear all localStorage items
  try {
    localStorage.clear()
  } catch (error) {
    console.error("localStorage clear error:", error)
  }

  // Clear all sessionStorage items
  try {
    sessionStorage.clear()
  } catch (error) {
    console.error("sessionStorage clear error:", error)
  }

  // Clear all cookies (especially Supabase auth cookies)
  try {
    const cookies = document.cookie.split(";")
    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      
      // Clear the cookie by setting it to expire in the past
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`
    }
  } catch (error) {
    console.error("Cookie clear error:", error)
  }

  // Force full page reload to ensure clean state
  window.location.href = "/login"
}

/**
 * Force logout and redirect to specific path
 */
export async function forceLogoutAndRedirect(path: string = "/login"): Promise<void> {
  const supabase = createClient()

  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.error("Supabase signOut error:", error)
  }

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch (error) {
    console.error("Storage clear error:", error)
  }

  // Clear cookies
  try {
    const cookies = document.cookie.split(";")
    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
    }
  } catch (error) {
    console.error("Cookie clear error:", error)
  }

  window.location.href = path
}

