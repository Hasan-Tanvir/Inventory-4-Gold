# Bicycle Inventory ERP

## Current app behavior

This React application is currently built as a browser-first inventory ERP with:
- localStorage persistence for offline/local usage
- a simple Supabase-backed `app_kv` table sync when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured

That means the app is not yet a true multi-user SaaS system. To make it production-ready for multiple users in different browsers, a dedicated Supabase data model and authentication flow are required.

## Recommended production architecture

1. **Supabase Authentication**
   - Use Supabase Auth for login instead of browser-only `api.login`.
   - Store users in Supabase auth and/or a `profiles` table.
   - Use role-based access for `admin` and `member`.

2. **Dedicated tables for each entity**
   - `users` / `profiles`
   - `products`
   - `orders`
   - `dealers`
   - `payments`
   - `officers`
   - `targets`
   - `notifications`
   - `product_stock_entries`
   - `product_stock_transfers`
   - `retail_transactions`
   - `customization`

3. **Row-level security (RLS)**
   - Add a `created_by` or `team_id` column on records.
   - Use RLS policies so each browser session only reads/writes the correct user/team data.
   - This keeps simultaneous users independent.

4. **Server-side backup automation**
   - Daily backup should not be done from the browser.
   - Use a server-side scheduled job or Supabase Edge Function to export data and upload to Google Drive.
   - Keep a retention policy that deletes old backups automatically.

5. **Deployment**
   - Host the frontend on Vercel.
   - Set the following Vercel environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Use Vercel static deployment for the Vite app.

6. **Mobile app strategy**
   - Build a PWA from this React app for mobile-friendly web use.
   - Or share the Supabase API layer with a React Native / Expo app for a native mobile experience.

## Setup for local development

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run locally:
   - `npm install`
   - `npm run dev`

## Deployment to Vercel

1. Add the repository to Vercel.
2. Configure environment variables for the Vercel project.
3. Set build command: `npm run build`.
4. Set output directory: `dist`.

## Notes

- The current implementation still keeps data in `localStorage` and syncs to one Supabase `app_kv` table.
- For a robust multi-user online system, migrate the data layer to dedicated Postgres tables with Supabase RLS and authentication.
- Daily Google Drive backup should be implemented as a backend process, not a browser-side snapshot.
