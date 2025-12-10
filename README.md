# 🛵 Cashless COD Delivery App (Agartha)

[![Hackathon Winner](https://img.shields.io/badge/🏆_Winner-Build_&_Ship_Philippines_Bounty-EFBW5B?style=for-the-badge)](https://github.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![Powered by PayRex](https://img.shields.io/badge/Payments-PayRex-blue?style=for-the-badge)](https://payrex.ph)

A mobile-first delivery application designed to eliminate cash handling risks by integrating **QRPH (InstaPay/GCash/Maya)** payments directly into the rider's workflow.

## 🚀 Short Intro

This application was built in **less than 24 hours** during the **Build and Ship Philippines Hackathon**. It successfully won the Bounty challenge by solving a critical logistics problem: removing the need for riders to carry large amounts of cash. The app coordinates order verification, real-time QRPH payments via PayRex, and proof of delivery in a seamless flow.

## 🎥 Demo

> **[View Live Demo](https://agartha-sepia.vercel.app)**  
> *(Replace this line with a link to your demo video or a GIF of the app flow)*

---

## 🛠️ Technologies Used

*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
*   **Database & Realtime:** [Supabase](https://supabase.com/) (PostgreSQL)
*   **Payments:** [PayRex API](https://developers.payrex.ph/) (QRPH Integration)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
*   **Deployment:** [Vercel](https://vercel.com/)
*   **Utilities:** `bwip-js` (Barcode generation), `html5-qrcode` (Scanner)

---

## ✅ Features

### Rider App & Core Logic
- [x] **Mobile-First Design** (Optimized for one-handed usage)
- [x] **Role-Based Auth** (Admin Dashboard vs. Rider Interface)
- [x] **Order Queue** (View pending deliveries with COD amounts)
- [x] **Barcode Verification** (Scan package to confirm correct order)
- [x] **Dynamic QRPH Generation** (Generate exact amount QR via PayRex)
- [x] **Real-time Status Updates** (Supabase Realtime syncing)
- [x] **Cash Fallback** (Toggle between Cash and QRPH)
- [x] **Proof of Delivery** (Photo capture & upload)
- [x] **Settlement Dashboard** (Track daily earnings & payment splits)

### Hackathon Trade-offs (To Be Improved)
- [x] **Dynamic QR Integration** (Basic generation implemented)
- [ ] **Row Level Security (RLS)** (Disabled for hackathon speed)
- [ ] **PayRex Webhook Signature Verification** (Skipped for simpler implementation)
- [ ] **Complex QR Expiry/Regeneration Logic** (Basic flow only)

---

## 🔄 The Process

1.  **Database & Auth First:** Started by implementing the Supabase database schema and configuring Authentication to distinguish between "Admin" and "Rider" roles.
2.  **Core Logic:** Built the state machine for orders (`Pending` → `En Route` → `Arrived` → `Completed`) and the barcode scanning verification system.
3.  **Payment Integration:** Tackled the PayRex API documentation to generate static QR codes, and setting up the webhooks needed to accept the transaction.
4.  **MVP Implementation:** Connected the frontend to the backend, ensuring the Rider app updates instantly when an Admin creates an order.
5.  **Bonus Features:** Implemented some of the features in the bonus points tab in the bounty, like the biometrics.

---

## 🧠 What I Learned

*   **Rapid Prototyping:** How to leverage Next.js and Vercel to ship a full-stack app in under 24 hours.
*   **Supabase Realtime:** Utilizing Postgres changes to push instant updates to the rider's screen without refreshing.
*   **PayRex API:** Understanding the flow of QRPH generation and webhook handling for cashless payments.
*   **Mobile UX:** Designing strictly for mobile constraints (thumb zones, large buttons).

## 🚧 What Could Be Improved

*   **Security:** RLS (Row Level Security) was disabled on Supabase tables to speed up development. In a production environment, strict policies must be enabled to prevent unauthorized data access.
*   **Error Handling:** Better handling for network dropouts during image uploads.
*   **Webhook Security:** Implementing strict signature verification for PayRex webhooks to prevent spoofing.

---

## ⚡ Project Runtime & Setup

Follow these steps to deploy the application and set up the necessary services.

### 1. Account Creation
Ensure you have accounts for the following services:
*   [Vercel](https://vercel.com/) (Hosting)
*   [Supabase](https://supabase.com/) (Database & Auth)
*   [PayRex](https://payrex.ph/) (Payments)

### 2. Supabase Configuration
1.  Create a new project in Supabase.
2.  **Database:** Go to the SQL Editor and import/run the `database.sql` script (or `schema.sql`) provided in this repository.
3.  **Authentication:** Go to *Authentication > Providers > Email* and **Disable "Confirm email"** (for faster testing).
4.  **Security:** **Disable RLS** (Row Level Security) for all tables.
5.  **Realtime:** Go to *Database > Replication* and **Enable Realtime** for the `orders` and `users` tables.

### 3. PayRex Setup
1.  Log in to your PayRex account.
2.  Create a **Static QRPH**.
3.  Edit the image to contain *only* the QR code itself.
4.  Save this image as `static-qrph.png` and place it in the `public/` folder of your cloned project (or upload it to a public URL).

### 4. Vercel Deployment
1.  **Fork or Clone** this repository to your GitHub.
2.  Log in to Vercel and **Add New Project**.
3.  Select your repository and choose the **Next.js** framework.
4.  Add the following vercel **Environment Variables** before deploying:

```env
NEXT_PUBLIC_SUPABASE_URL=[Your Supabase Project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Your Supabase Anon API Key]
PAYREX_API_KEY=[Your PayRex Secret API Key]
STATIC_QRPH_IMAGE_URL=/static-qrph.png
```

### 5. Vercel Post-Deployment Configs
Once Vercel generates your live domain (e.g., `cod.vercel.app`), go to **Settings > Environment Variables** in Vercel and add the following:

```env
# Your Vercel domain WITHOUT https:// (e.g., cod.vercel.app)
NEXT_PUBLIC_WEBAUTHN_RP_ID=your-project.vercel.app

# Your Vercel domain WITH https:// (e.g., https://cod.vercel.app)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

### 5. Configure PayRex Webhooks
1. Go to your **PayRex Dashboard** > **Webhooks**.
2. Add a new webhook endpoint using your Vercel domain:

   ```url
   https://<YOUR_VERCEL_DOMAIN>/api/webhooks/payrex
    ```
    *(Example: `https://cod.vercel.app/api/webhooks/payrex`)*
3.  Under the events list, check the box for:
    *   `payment_intent.succeeded`

### 6. Register Users
1.  Navigate to your deployed Vercel URL.
2.  Click the **Register** button at the bottom of the login screen.
3.  Create the following accounts (you can optionally add biometrics or skip):
    *   **Admin Account:** `admin@agartha.ph`
    *   **Rider Account:** `rider@agartha.ph`

### 7. Set Admin Privileges
After creating the users in the app, you need to manually elevate the admin user's role in the database.

1.  Go to your **Supabase Dashboard** > **SQL Editor**.
2.  Paste and run the following script:

```sql
-- Update the user role to 'admin'
UPDATE public.users 
SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@agartha.ph';
```