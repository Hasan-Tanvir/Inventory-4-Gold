-- Fix RLS policies to allow users to view profile names and officer IDs
-- This allows the order display to show user names instead of UUIDs

-- Drop existing "view own profile" policy to avoid conflicts
drop policy if exists "Users can view own profile" on public.profiles;

-- Create new policies for profiles
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can view all profile names and officer_ids"
on public.profiles
for select
to authenticated
using (true);
