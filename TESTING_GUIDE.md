# AGARTHA Delivery App - Testing Guide

## 🔧 Initial Setup

### Step 1: Run the Database Schema

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `cvfplscekhtnbbmhsqga`
3. Navigate to **SQL Editor** (left sidebar)
4. Copy and paste the contents of `supabase/schema.sql`
5. Click **Run** to create all tables

### Step 2: Create Test Users in Supabase Auth

1. Go to **Authentication** > **Users** in Supabase Dashboard
2. Click **Add User** > **Create New User**

#### Admin User:
- **Email:** `admin@agartha.ph`
- **Password:** `admin123456`
- **Auto Confirm User:** ✅ Yes

#### Rider User:
- **Email:** `rider@agartha.ph`  
- **Password:** `rider123456`
- **Auto Confirm User:** ✅ Yes

### Step 3: Set User Roles

After creating users, run this in SQL Editor to set their roles:

```sql
-- Set admin role
UPDATE public.users 
SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@agartha.ph';

-- Set rider role  
UPDATE public.users 
SET role = 'rider', full_name = 'Juan Rider', phone = '09171234567'
WHERE email = 'rider@agartha.ph';
```

### Step 4: Create Sample Orders

Run the contents of `supabase/seed.sql` in SQL Editor to create 5 test orders.

---

## 🧪 Testing Each Feature

### Start the Development Server

```bash
npm run dev
```

Open: http://localhost:3000

---

## Test 1: Admin Panel

### Login as Admin
1. Go to http://localhost:3000/login
2. Click **Admin** tab
3. Enter:
   - Email: `admin@agartha.ph`
   - Password: `admin123456`
4. Click **Sign In as Admin**

### Test Order Creation
1. Click **Create New Order**
2. Fill in the form:
   - **COD Amount:** 1500
   - **Description:** Test Package
   - **Pickup Address:** 123 Test Street, Manila
   - **Pickup Contact:** Test Sender
   - **Delivery Address:** 456 Delivery Ave, Quezon City
   - **Delivery Contact:** Test Receiver
3. Click **Create Order & Generate Barcode**
4. ✅ Verify barcode is generated
5. Copy the barcode code (e.g., `PKG241205ABCD1234`)

### View Orders
1. Go back to dashboard
2. ✅ Verify all orders appear in the list
3. Click on an order to see details
4. ✅ Verify barcode image displays

---

## Test 2: Rider App

### Login as Rider
1. Open new incognito/private window
2. Go to http://localhost:3000/login
3. Click **Rider** tab
4. Enter:
   - Email: `rider@agartha.ph`
   - Password: `rider123456`
5. Click **Sign In as Rider**

### Test Order Queue
1. ✅ Verify "Available Orders" shows pending orders
2. ✅ Verify order details (address, COD amount) are visible

### Accept an Order
1. Find a pending order
2. Click **Accept Order**
3. ✅ Order moves to "My Active Orders"
4. ✅ Order status changes to "Accepted"

---

## Test 3: Complete Delivery Workflow

### Step 1: En Route to Pickup
1. Click on your active order
2. You should see "Go to Pickup Location"
3. ✅ Verify pickup address displays
4. Click **I've Arrived at Pickup**

### Step 2: Scan Barcode
1. You'll see "Scan Package Barcode"
2. Enter the barcode shown (e.g., `PKG240001TESTAA`)
3. Click **Verify & Pick Up**
4. ✅ Status updates to "Picked Up"

### Step 3: Deliver to Customer
1. You'll see delivery address
2. ✅ Verify COD amount is prominently displayed
3. Click **I've Arrived at Customer**

### Step 4: Collect Payment

#### Test QRPH:
1. Click **QRPH** button
2. ✅ QR code generates (demo mode shows placeholder)
3. Click **Payment Received**

#### Test Cash:
1. Click **Cash** button
2. Optionally add audit note: "Exact amount received"
3. Click **Cash Received**

### Step 5: Proof of Delivery
1. Click **Take Photo** or **Upload from Gallery**
2. If using camera, click **Capture**
3. Click **Complete Delivery**
4. ✅ Success screen shows!

### Step 6: Verify Settlement
1. Go to **Earnings** tab
2. ✅ Verify completed delivery appears
3. ✅ Verify QRPH/Cash breakdown is correct
4. ✅ Total collected amount is accurate

---

## Test 4: Admin View Updates

1. Go back to Admin panel
2. ✅ Verify order status changed to "Completed"
3. ✅ Verify POD photo is attached (if uploaded)
4. ✅ Verify payment method is recorded

---

## Test 5: Real-time Updates

### Test Realtime Sync
1. Open Admin in one browser window
2. Open Rider in another browser window
3. Create a new order in Admin
4. ✅ Verify it appears in Rider's queue instantly

---

## 🔑 Test Credentials Summary

| Role  | Email              | Password      |
|-------|-------------------|---------------|
| Admin | admin@agartha.ph  | admin123456   |
| Rider | rider@agartha.ph  | rider123456   |

---

## 📋 Test Barcodes (for package verification)

| Order Number  | Barcode          |
|--------------|------------------|
| ORD-TEST-001 | PKG240001TESTAA  |
| ORD-TEST-002 | PKG240002TESTBB  |
| ORD-TEST-003 | PKG240003TESTCC  |
| ORD-TEST-004 | PKG240004TESTDD  |
| ORD-TEST-005 | PKG240005TESTEE  |

---

## 🐛 Troubleshooting

### "Invalid login credentials"
- Make sure you created users in Supabase Auth Dashboard
- Check that "Auto Confirm User" was enabled
- Verify email/password are correct

### "User not found" or role issues
- Run the SQL to update user roles (Step 3 above)
- Check the `users` table in Supabase Table Editor

### Orders not showing
- Run the seed.sql to create test orders
- Check browser console for errors
- Verify Supabase connection (check .env.local)

### Camera not working
- Allow camera permissions in browser
- Use HTTPS in production (or localhost for testing)
- Try the "Upload from Gallery" option

---

## 📱 Mobile Testing

1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac)
2. Access: `http://YOUR_IP:3000` from your phone
3. Add to home screen for PWA experience

---

## ✅ Testing Checklist

- [ ] Admin can login
- [ ] Admin can create orders with barcodes
- [ ] Admin can view all orders
- [ ] Rider can login
- [ ] Rider sees available orders
- [ ] Rider can accept orders
- [ ] Rider can verify barcodes
- [ ] QRPH payment flow works
- [ ] Cash payment flow works
- [ ] Photo capture works
- [ ] Delivery completion works
- [ ] Settlement shows correct totals
- [ ] Real-time updates work

