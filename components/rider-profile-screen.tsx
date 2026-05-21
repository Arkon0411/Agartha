"use client"

import { useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Camera, Loader2, Save, UserCircle } from "lucide-react"
import type { User } from "@/types"

interface RiderProfileScreenProps {
  user: User
  onUserUpdate?: (user: User) => void
}

interface ProfileFormState {
  firstName: string
  lastName: string
  displayName: string
  phone: string
  address: string
  birthdate: string
  avatarUrl: string
}

function splitName(fullName: string) {
  const nameParts = fullName.trim().split(" ").filter(Boolean)
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ")

  return { firstName, lastName }
}

function calculateAge(birthdate: string) {
  if (!birthdate) return "--"

  const birthDateValue = new Date(birthdate)
  if (Number.isNaN(birthDateValue.getTime())) return "--"

  const today = new Date()
  let age = today.getFullYear() - birthDateValue.getFullYear()
  const monthDelta = today.getMonth() - birthDateValue.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDateValue.getDate())) {
    age -= 1
  }

  return age >= 0 ? `${age}` : "--"
}

function getInitials(fullName: string, email: string) {
  const source = fullName.trim() || email
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export default function RiderProfileScreen({ user, onUserUpdate }: RiderProfileScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const nameParts = splitName(user.full_name || "")
  const [formData, setFormData] = useState<ProfileFormState>({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    displayName: user.full_name || "",
    phone: user.phone || "",
    address: user.address || "",
    birthdate: user.birthdate || "",
    avatarUrl: user.avatar_url || "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const age = useMemo(() => calculateAge(formData.birthdate), [formData.birthdate])

  const handleChange = (field: keyof ProfileFormState, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
      ...(field === "firstName" || field === "lastName"
        ? { displayName: `${field === "firstName" ? value : current.firstName} ${field === "lastName" ? value : current.lastName}`.trim() }
        : {}),
    }))
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError("")
    setMessage("")
    setIsUploading(true)

    const fileExtension = file.name.split(".").pop() || "jpg"
    const safeFileName = `${Date.now()}.${fileExtension.toLowerCase()}`
    const filePath = `${user.id}/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from("rider-avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      setError(uploadError.message)
      setIsUploading(false)
      return
    }

    const { data } = supabase.storage.from("rider-avatars").getPublicUrl(filePath)

    const profileUpdate: Partial<Pick<User, "avatar_url">> = {
      avatar_url: data.publicUrl,
    }

    const { error: updateError } = await supabase
      .from("users")
      .update(profileUpdate)
      .eq("id", user.id)

    if (updateError) {
      setError(updateError.message)
      setIsUploading(false)
      return
    }

    setFormData((current) => ({ ...current, avatarUrl: data.publicUrl }))
    onUserUpdate?.({ ...user, avatar_url: data.publicUrl })
    setMessage("Profile photo updated")
    setIsUploading(false)
  }

  const handleSave = async () => {
    setError("")
    setMessage("")
    setIsSaving(true)

    const fullName = formData.displayName.trim() || `${formData.firstName} ${formData.lastName}`.trim() || user.email
    const profileUpdate: Partial<Pick<User, "full_name" | "phone" | "address" | "birthdate" | "avatar_url">> = {
      full_name: fullName,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      birthdate: formData.birthdate || null,
      avatar_url: formData.avatarUrl || null,
    }

    const { data, error: updateError } = await supabase
      .from("users")
      .update(profileUpdate)
      .eq("id", user.id)
      .select("id, email, full_name, phone, role, is_active, avatar_url, birthdate, address, created_at")
      .single()

    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    if (data) {
      onUserUpdate?.(data as User)
      const updatedNameParts = splitName(data.full_name || "")
      setFormData((current) => ({
        ...current,
        firstName: updatedNameParts.firstName,
        lastName: updatedNameParts.lastName,
        displayName: data.full_name || "",
      }))
    }

    setMessage("Profile saved")
    setIsSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#2d2d2d]">Profile</h2>
        <p className="text-[#6b6b6b] text-xs">Keep rider contact and avatar updated.</p>
      </div>

      <Card className="p-5 bg-white border border-[#ff8303]/30">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#ff8303]/20 border-4 border-[#fffdf9] shadow-lg overflow-hidden flex items-center justify-center">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Rider avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-[#fd5602]">{getInitials(user.full_name, user.email) || <UserCircle className="w-10 h-10" />}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#fd5602] text-white flex items-center justify-center shadow-md disabled:opacity-60"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <div>
            <p className="text-lg font-black text-[#2d2d2d]">{formData.displayName || user.email}</p>
            <p className="text-xs text-[#6b6b6b]">{user.email}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white border border-[#ff8303]/30 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[#6b6b6b]">First name</span>
            <Input value={formData.firstName} onChange={(event) => handleChange("firstName", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[#6b6b6b]">Last name</span>
            <Input value={formData.lastName} onChange={(event) => handleChange("lastName", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-[#6b6b6b]">Display name</span>
          <Input value={formData.displayName} onChange={(event) => handleChange("displayName", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-[#6b6b6b]">Phone</span>
          <Input value={formData.phone} onChange={(event) => handleChange("phone", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-[#6b6b6b]">Address</span>
          <Input value={formData.address} onChange={(event) => handleChange("address", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-[#6b6b6b]">Birthdate</span>
            <Input type="date" value={formData.birthdate} onChange={(event) => handleChange("birthdate", event.target.value)} className="h-12 border-[#ff8303]/30 focus-visible:ring-[#fd5602]/30" />
          </label>
          <div className="h-12 px-4 rounded-xl bg-[#ff8303]/10 border border-[#ff8303]/30 flex flex-col justify-center min-w-20">
            <span className="text-[10px] text-[#6b6b6b] font-semibold">AGE</span>
            <span className="text-[#2d2d2d] font-black">{age}</span>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}
        {message && <div className="p-3 bg-[#ff8303]/10 border border-[#ff8303]/30 rounded-xl text-[#fd5602] text-sm font-medium">{message}</div>}

        <Button onClick={handleSave} disabled={isSaving || isUploading} className="w-full h-14 bg-[#fd5602] hover:bg-[#e54d00] text-white text-base font-semibold">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
        </Button>
      </Card>
    </div>
  )
}
