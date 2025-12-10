# Supabase Database Migration Guide

This guide helps you migrate from the original Supabase database to your own.

## 📋 Prerequisites

- Your own Supabase account at [supabase.com](https://supabase.com)
- Access to Vercel project settings (or wherever you deploy)
- The original database credentials (for data export, if needed)

---

## 🚀 Step 1: Create New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in:
   - **Name**: `agartha-delivery` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., Singapore for PH)
4. Click **Create new project**
5. Wait 2-3 minutes for setup

---

## 🗄️ Step 2: Set Up Database Schema

1. In your new Supabase project, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste and click **Run**
5. You should see "Success. No rows returned" for each statement

---

## 📦 Step 3: Set Up Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Configure:
   - **Name**: `delivery-photos`
   - **Public bucket**: ✅ Yes (toggle ON)
4. Click **Create bucket**
5. Go back to **SQL Editor**
6. Run the contents of `supabase/storage-setup.sql`

---

## 🔐 Step 4: Get Your New Credentials

In your new Supabase project:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (the long one)
   - **service_role key**: `eyJhbGc...` (keep this SECRET!)

---

## ⚙️ Step 5: Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Update these variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your new Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your new anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your new service_role key |

4. Click **Save** for each
5. Go to **Deployments** tab
6. Click the **...** menu on latest deployment → **Redeploy**

---

## 👤 Step 6: Create Your First Admin User

1. In Supabase, go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - **Email**: `admin@yourdomain.com`
   - **Password**: A secure password
   - **Auto Confirm User**: ✅ Yes
4. Click **Create user**
5. Go to **SQL Editor** and run:

```sql
-- Set the user as admin
UPDATE public.users 
SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@yourdomain.com';
```

---

## 🔄 Step 7: Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication**
2. Under "Supabase Realtime", click **0 tables**
3. Enable replication for:
   - ✅ `orders`
   - ✅ `users`
   - ✅ `rider_settlements`
4. Click **Save**

---

## 📤 Step 8: Migrate Existing Data (Optional)

If you want to copy data from the old database:

### Option A: Export/Import via SQL

1. In the OLD Supabase project, go to **SQL Editor**
2. Run this to export orders:

```sql
SELECT * FROM orders;
```

3. Click **Download** (CSV)
4. In your NEW project, go to **Table Editor** → `orders`
5. Click **Insert** → **Import data from CSV**

### Option B: Use pg_dump (Advanced)

If you have direct database access:

```bash
# Export from old database
pg_dump -h old-db-host -U postgres -d postgres --data-only > backup.sql

# Import to new database
psql -h new-db-host -U postgres -d postgres < backup.sql
```

---

## ✅ Step 9: Test Your Migration

1. Visit your app URL
2. Try logging in with your new admin account
3. Create a test order
4. Check the Supabase dashboard to see the data

---

## 🚨 Troubleshooting

### "Invalid API key"
- Double-check your environment variables in Vercel
- Make sure you redeployed after changing them

### "relation does not exist"
- Schema wasn't created properly
- Re-run `schema.sql` in SQL Editor

### "new row violates row-level security policy"
- RLS policies might not be set up
- Check if all policies from schema.sql were created

### Users can't sign up
- Make sure the `handle_new_user` trigger exists
- Check Authentication → Settings for any restrictions

---

## 📝 Local Development

For local development, create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never commit this file to git (it's in .gitignore).
