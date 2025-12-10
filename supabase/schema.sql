-- ============================================
-- AGARTHA CASHLESS COD DELIVERY APP
-- Database Schema for Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('admin', 'rider')),
  is_active BOOLEAN DEFAULT true,
  -- Rider-specific fields
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  
  -- Package info
  package_description TEXT NOT NULL DEFAULT 'Package',
  cod_amount DECIMAL(10, 2) NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  barcode_image_url TEXT,
  
  -- Pickup location
  pickup_address TEXT NOT NULL,
  pickup_contact_name TEXT NOT NULL,
  pickup_contact_phone TEXT,
  
  -- Delivery location  
  delivery_address TEXT NOT NULL,
  delivery_contact_name TEXT NOT NULL,
  delivery_contact_phone TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'picked_up', 'delivering', 
    'arrived', 'payment_pending', 'payment_confirmed', 'completed', 'failed'
  )),
  payment_method TEXT CHECK (payment_method IN ('cash', 'qrph')),
  
  -- Assignment
  rider_id UUID REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  
  -- Timestamps for each status
  picked_up_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Proof of delivery
  pod_photo_url TEXT,
  pod_latitude DECIMAL(10, 8),
  pod_longitude DECIMAL(11, 8),
  
  -- Audit for cash payments
  cash_audit_note TEXT,
  
  -- PayRex reference for QRPH payments
  payrex_reference TEXT,
  payrex_checkout_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qrph')),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  payrex_reference TEXT,
  payrex_webhook_payload JSONB,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RIDER SETTLEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rider_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  payment_reference TEXT,
  payrex_checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rider_id, date)
);

-- ============================================
-- WEBAUTHN CREDENTIALS TABLE (for biometric login)
-- ============================================
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT false,
  transports TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_barcode ON public.orders(barcode);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_settlements_rider_id ON public.rider_settlements(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_settlements_date ON public.rider_settlements(date);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON public.webauthn_credentials(credential_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can create users
CREATE POLICY "Admins can create users" ON public.users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Orders: Riders can view pending orders (available to accept)
CREATE POLICY "Riders can view pending orders" ON public.orders
  FOR SELECT USING (
    status = 'pending' OR rider_id = auth.uid()
  );

-- Orders: Riders can update their assigned orders
CREATE POLICY "Riders can update assigned orders" ON public.orders
  FOR UPDATE USING (rider_id = auth.uid());

-- Orders: Admins can do everything with orders
CREATE POLICY "Admins full access to orders" ON public.orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Payment transactions: Riders can view their order payments
CREATE POLICY "Riders can view order payments" ON public.payment_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND rider_id = auth.uid())
  );

-- Payment transactions: Admins can do everything
CREATE POLICY "Admins full access to payments" ON public.payment_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- RIDER SETTLEMENTS POLICIES
-- ============================================

-- Riders can view their own settlements
CREATE POLICY "Riders can view own settlements" ON public.rider_settlements
  FOR SELECT USING (rider_id = auth.uid());

-- Riders can insert their own settlements
CREATE POLICY "Riders can create own settlements" ON public.rider_settlements
  FOR INSERT WITH CHECK (rider_id = auth.uid());

-- Riders can update their own settlements
CREATE POLICY "Riders can update own settlements" ON public.rider_settlements
  FOR UPDATE USING (rider_id = auth.uid());

-- Admins can do everything with settlements
CREATE POLICY "Admins full access to settlements" ON public.rider_settlements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- WEBAUTHN CREDENTIALS POLICIES
-- ============================================

-- Users can view their own credentials
CREATE POLICY "Users can view own credentials" ON public.webauthn_credentials
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own credentials
CREATE POLICY "Users can create own credentials" ON public.webauthn_credentials
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own credentials
CREATE POLICY "Users can update own credentials" ON public.webauthn_credentials
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own credentials
CREATE POLICY "Users can delete own credentials" ON public.webauthn_credentials
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  today_count INT;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count 
  FROM public.orders 
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'ORD-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(today_count::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate barcode
CREATE OR REPLACE FUNCTION generate_barcode()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PKG' || TO_CHAR(NOW(), 'YYMMDD') || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HANDLE NEW USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'rider')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

