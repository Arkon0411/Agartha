// Order status following the complete delivery workflow
export type OrderStatus = 
  | "pending"           // No rider has accepted yet
  | "accepted"          // Rider accepted, heading to pickup
  | "picked_up"         // Package scanned/verified at pickup
  | "delivering"        // On route to customer
  | "arrived"           // At customer location
  | "payment_pending"   // Waiting for payment
  | "payment_confirmed" // Payment received (cash or QRPH)
  | "completed"         // POD captured, delivery done
  | "failed"            // Delivery failed

export type PaymentMethod = "cash" | "qrph" | null

export type UserRole = "admin" | "rider"

export interface Order {
  id: string
  order_number: string
  
  // Package info
  package_description: string
  cod_amount: number
  barcode: string
  barcode_image_url?: string
  
  // Pickup location
  pickup_address: string
  pickup_latitude?: number | null
  pickup_longitude?: number | null
  pickup_contact_name: string
  pickup_contact_phone: string
  
  // Delivery location
  delivery_address: string
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  delivery_contact_name: string
  delivery_contact_phone: string
  
  // Status tracking
  status: OrderStatus
  payment_method: PaymentMethod
  
  // Assignment
  rider_id: string | null
  accepted_at: string | null
  
  // Timestamps for each status
  picked_up_at: string | null
  arrived_at: string | null
  payment_confirmed_at: string | null
  completed_at: string | null
  
  // Proof of delivery
  pod_photo_url: string | null
  pod_latitude: number | null
  pod_longitude: number | null
  
  // Audit for cash payments
  cash_audit_note: string | null
  
  // QRPH payment tracking
  amount_paid?: number | null
  payment_error?: string | null
  payrex_reference?: string | null
  last_webhook_event_id?: string | null  // For idempotency
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  phone: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Rider extends User {
  role: "rider"
  current_latitude: number | null
  current_longitude: number | null
  is_online: boolean
}

export interface SettlementData {
  date: string
  rider_id: string
  total_deliveries: number
  completed_deliveries: number
  qrph_amount: number
  qrph_count: number
  cash_amount: number
  cash_count: number
  total_collected: number
  recent_deliveries: Array<{
    id: string
    order_number: string
    customer_name: string
    amount: number
    payment_method: "cash" | "qrph"
    completed_at: string
  }>
}

export interface PaymentConfirmation {
  order_id: string
  payment_method: "cash" | "qrph"
  amount: number
  confirmed_at: string
  payrex_reference?: string
}

// Database types for Supabase
export type Database = {
  public: {
    Tables: {
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Order, 'id' | 'created_at'>>
      }
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at'>
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
    }
  }
}
