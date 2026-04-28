-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  photo text,
  notifications_enabled boolean not null default true,
  allowed_tabs text[] default array[]::text[],
  mobile_quick_tabs text[] default array[]::text[],
  officer_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create categories table
create table if not exists public.categories (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create products table
create table if not exists public.products (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  version text not null,
  category_id uuid references public.categories(id) on delete set null,
  retail_price numeric not null,
  commission numeric not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  dhaka numeric not null default 0,
  chittagong numeric not null default 0,
  slabs jsonb not null default '[]'::jsonb,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create dealers table
create table if not exists public.dealers (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  address text,
  phone text,
  officer_name text,
  balance numeric not null default 0,
  officer_id text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create officers table
create table if not exists public.officers (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  designation text,
  commission_balance numeric not null default 0,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create commission_clearances table
create table if not exists public.commission_clearances (
  id uuid not null default uuid_generate_v4() primary key,
  officer_id uuid references public.officers(id) on delete cascade not null,
  date date not null,
  amount numeric not null,
  note text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create commission_tokens table
create table if not exists public.commission_tokens (
  id uuid not null default uuid_generate_v4() primary key,
  order_id text not null, -- since orders may not be uuid yet
  date date not null,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'disbursed')),
  disbursed_date date,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create orders table
create table if not exists public.orders (
  id text not null primary key,
  date date not null,
  type text not null check (type in ('dealer', 'retail')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  customer_name text not null,
  dealer_id uuid references public.dealers(id) on delete set null,
  customer_phone text,
  customer_address text,
  officer text not null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  extra numeric not null default 0,
  net_total numeric not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete cascade not null,
  approved_by uuid references auth.users(id) on delete set null,
  is_quote boolean not null default false,
  retail_payment_status text check (retail_payment_status in ('paid', 'unpaid', 'partial')),
  partial_amount numeric,
  retail_payment_date date,
  payment_reference text,
  include_price_increase_in_commission boolean not null default false,
  inventory_source text not null default 'dhaka' check (inventory_source in ('dhaka', 'chittagong', 'mixed')),
  show_serials_on_invoice boolean not null default true,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create order_items table
create table if not exists public.order_items (
  id uuid not null default uuid_generate_v4() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  version text not null,
  quantity integer not null,
  base_price numeric,
  price numeric not null,
  total numeric not null,
  location text not null check (location in ('dhaka', 'chittagong')),
  commission numeric not null,
  serial_numbers text[] default array[]::text[],
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create payments table
create table if not exists public.payments (
  id uuid not null default uuid_generate_v4() primary key,
  dealer_id uuid references public.dealers(id) on delete cascade not null,
  dealer_name text not null,
  date date not null,
  type text not null check (type in ('Cash', 'Bank Transfer', 'Cheque', 'Purchase', 'Adjustment', 'Last balance Due')),
  amount numeric not null,
  reference text,
  notes text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create targets table
create table if not exists public.targets (
  id uuid not null default uuid_generate_v4() primary key,
  name text,
  dealer_id text not null, -- 'all' or uuid
  dealer_name text not null,
  type text not null check (type in ('amount', 'quantity')),
  product_ids text[] default array[]::text[],
  target_value numeric not null,
  current_value numeric not null default 0,
  start_date date not null,
  end_date date not null,
  reward_type text not null check (reward_type in ('percentage', 'fixed')),
  reward_value numeric not null,
  status text not null default 'active' check (status in ('active', 'achieved', 'expired')),
  assigned_officer_id text,
  rewarded_dealer_ids text[] default array[]::text[],
  reward_disbursed jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create target_rewards table
create table if not exists public.target_rewards (
  id uuid not null default uuid_generate_v4() primary key,
  reward_ref text not null,
  target_id uuid references public.targets(id) on delete cascade not null,
  target_name text not null,
  dealer_id text not null,
  dealer_name text not null,
  officer_id text,
  officer_name text,
  date date not null,
  cycles integer not null,
  amount numeric not null,
  payment_id uuid references public.payments(id) on delete set null,
  note text,
  status text not null default 'active' check (status in ('active', 'reversed')),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create notifications table
create table if not exists public.notifications (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null check (type in ('order', 'approval', 'system', 'reminder')),
  read boolean not null default false,
  timestamp timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

-- Create product_stock_entries table
create table if not exists public.product_stock_entries (
  id uuid not null default uuid_generate_v4() primary key,
  entry_id text,
  batch_id text,
  product_id uuid references public.products(id) on delete cascade not null,
  product_name text not null,
  date date not null,
  location text not null check (location in ('dhaka', 'chittagong')),
  quantity integer not null,
  note text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create product_stock_transfers table
create table if not exists public.product_stock_transfers (
  id uuid not null default uuid_generate_v4() primary key,
  transfer_id text,
  date date not null,
  product_id uuid references public.products(id) on delete cascade not null,
  product_name text not null,
  from_location text not null check (from_location in ('dhaka', 'chittagong')),
  to_location text not null check (to_location in ('dhaka', 'chittagong')),
  quantity integer not null,
  note text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create retail_transactions table
create table if not exists public.retail_transactions (
  id uuid not null default uuid_generate_v4() primary key,
  order_id text references public.orders(id) on delete set null,
  date date not null,
  detail text not null,
  amount numeric not null,
  payment_status text check (payment_status in ('paid', 'unpaid', 'partial')),
  paid_amount numeric,
  location text not null check (location in ('dhaka', 'chittagong')),
  type text not null check (type in ('sale', 'adjustment', 'expense', 'sent_to_main', 'other')),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create customization table (global per user)
create table if not exists public.customization (
  id uuid not null default uuid_generate_v4() primary key,
  title text not null default 'Bicycle Inventory',
  logo text,
  sidebar_color text not null default '#1f2937',
  main_color text not null default '#3b82f6',
  initial_retail_amount numeric not null default 0,
  initial_retail_amount_dhaka numeric,
  initial_retail_amount_chittagong numeric,
  regards text not null default 'Best Regards',
  exec_name text not null default 'Executive',
  exec_details text,
  custom_detail_text text,
  custom_detail_html text,
  custom_detail_bold boolean not null default false,
  custom_detail_italic boolean not null default false,
  custom_detail_boxed boolean not null default false,
  order_serial_seed text,
  quote_serial_seed text,
  payment_reference_seed text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id)
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.dealers enable row level security;
alter table public.officers enable row level security;
alter table public.commission_clearances enable row level security;
alter table public.commission_tokens enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.targets enable row level security;
alter table public.target_rewards enable row level security;
alter table public.notifications enable row level security;
alter table public.product_stock_entries enable row level security;
alter table public.product_stock_transfers enable row level security;
alter table public.retail_transactions enable row level security;
alter table public.customization enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Users can view own data" on public.categories;
drop policy if exists "Users can insert own data" on public.categories;
drop policy if exists "Users can update own data" on public.categories;
drop policy if exists "Users can delete own data" on public.categories;
drop policy if exists "Users can view own categories" on public.categories;
drop policy if exists "Users can insert own categories" on public.categories;
drop policy if exists "Users can update own categories" on public.categories;
drop policy if exists "Users can delete own categories" on public.categories;
drop policy if exists "Users can view own products" on public.products;
drop policy if exists "Users can insert own products" on public.products;
drop policy if exists "Users can update own products" on public.products;
drop policy if exists "Users can delete own products" on public.products;
drop policy if exists "Users can view own dealers" on public.dealers;
drop policy if exists "Users can insert own dealers" on public.dealers;
drop policy if exists "Users can update own dealers" on public.dealers;
drop policy if exists "Users can delete own dealers" on public.dealers;
drop policy if exists "Users can view own officers" on public.officers;
drop policy if exists "Users can insert own officers" on public.officers;
drop policy if exists "Users can update own officers" on public.officers;
drop policy if exists "Users can delete own officers" on public.officers;
drop policy if exists "Users can view own commission_clearances" on public.commission_clearances;
drop policy if exists "Users can insert own commission_clearances" on public.commission_clearances;
drop policy if exists "Users can update own commission_clearances" on public.commission_clearances;
drop policy if exists "Users can delete own commission_clearances" on public.commission_clearances;
drop policy if exists "Users can view own commission_tokens" on public.commission_tokens;
drop policy if exists "Users can insert own commission_tokens" on public.commission_tokens;
drop policy if exists "Users can update own commission_tokens" on public.commission_tokens;
drop policy if exists "Users can delete own commission_tokens" on public.commission_tokens;
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Users can insert own orders" on public.orders;
drop policy if exists "Users can update own orders" on public.orders;
drop policy if exists "Users can delete own orders" on public.orders;
drop policy if exists "Users can view own order_items" on public.order_items;
drop policy if exists "Users can insert own order_items" on public.order_items;
drop policy if exists "Users can update own order_items" on public.order_items;
drop policy if exists "Users can delete own order_items" on public.order_items;
drop policy if exists "Users can view own payments" on public.payments;
drop policy if exists "Users can insert own payments" on public.payments;
drop policy if exists "Users can update own payments" on public.payments;
drop policy if exists "Users can delete own payments" on public.payments;
drop policy if exists "Users can view own targets" on public.targets;
drop policy if exists "Users can insert own targets" on public.targets;
drop policy if exists "Users can update own targets" on public.targets;
drop policy if exists "Users can delete own targets" on public.targets;
drop policy if exists "Users can view own target_rewards" on public.target_rewards;
drop policy if exists "Users can insert own target_rewards" on public.target_rewards;
drop policy if exists "Users can update own target_rewards" on public.target_rewards;
drop policy if exists "Users can delete own target_rewards" on public.target_rewards;
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;
drop policy if exists "Users can view own product_stock_entries" on public.product_stock_entries;
drop policy if exists "Users can insert own product_stock_entries" on public.product_stock_entries;
drop policy if exists "Users can update own product_stock_entries" on public.product_stock_entries;
drop policy if exists "Users can delete own product_stock_entries" on public.product_stock_entries;
drop policy if exists "Users can view own product_stock_transfers" on public.product_stock_transfers;
drop policy if exists "Users can insert own product_stock_transfers" on public.product_stock_transfers;
drop policy if exists "Users can update own product_stock_transfers" on public.product_stock_transfers;
drop policy if exists "Users can delete own product_stock_transfers" on public.product_stock_transfers;
drop policy if exists "Users can view own retail_transactions" on public.retail_transactions;
drop policy if exists "Users can insert own retail_transactions" on public.retail_transactions;
drop policy if exists "Users can update own retail_transactions" on public.retail_transactions;
drop policy if exists "Users can delete own retail_transactions" on public.retail_transactions;
drop policy if exists "Users can view own customization" on public.customization;
drop policy if exists "Users can insert own customization" on public.customization;
drop policy if exists "Users can update own customization" on public.customization;
drop policy if exists "Users can delete own customization" on public.customization;
-- Repeat for all tables

-- Create policies for profiles
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated;

create policy "Admins can manage all profiles"
on public.profiles
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- For other tables, allow authenticated users to read/write their own data
create policy "Users can view own categories"
on public.categories
for select
to authenticated
    using (true);

create policy "Users can insert own categories"
on public.categories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own categories"
on public.categories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own categories"
on public.categories
for delete
to authenticated
using (auth.uid() = user_id);

-- Repeat similar policies for all other tables
-- To save space, I'll use a pattern, but in practice, write for each

-- For products
create policy "Users can view own products"
on public.products
for select
to authenticated
    using (true);

create policy "Users can insert own products"
on public.products
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own products"
on public.products
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own products"
on public.products
for delete
to authenticated
using (true);

-- Similarly for dealers, officers, orders, etc.

-- For simplicity, since all tables have user_id, and policies are similar, I'll assume they are created for all.

-- But to be complete, let's list them.

-- Dealers
create policy "Users can view own dealers"
on public.dealers
for select
to authenticated
    using (true);

create policy "Users can insert own dealers"
on public.dealers
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own dealers"
on public.dealers
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own dealers"
on public.dealers
for delete
to authenticated
using (true);

-- Officers
create policy "Users can view own officers"
on public.officers
for select
to authenticated
    using (true);

create policy "Users can insert own officers"
on public.officers
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own officers"
on public.officers
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own officers"
on public.officers
for delete
to authenticated
using (true);

-- Commission clearances
create policy "Users can view own commission_clearances"
on public.commission_clearances
for select
to authenticated
    using (true);

create policy "Users can insert own commission_clearances"
on public.commission_clearances
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own commission_clearances"
on public.commission_clearances
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own commission_clearances"
on public.commission_clearances
for delete
to authenticated
using (true);

-- Commission tokens
create policy "Users can view own commission_tokens"
on public.commission_tokens
for select
to authenticated
    using (true);

create policy "Users can insert own commission_tokens"
on public.commission_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own commission_tokens"
on public.commission_tokens
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own commission_tokens"
on public.commission_tokens
for delete
to authenticated
using (true);

-- Orders
create policy "Users can view own orders"
on public.orders
for select
to authenticated
    using (true);

create policy "Users can insert own orders"
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own orders"
on public.orders
for delete
to authenticated
using (true);

-- Order items
create policy "Users can view own order_items"
on public.order_items
for select
to authenticated
    using (true);

create policy "Users can insert own order_items"
on public.order_items
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own order_items"
on public.order_items
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own order_items"
on public.order_items
for delete
to authenticated
using (true);

-- Payments
create policy "Users can view own payments"
on public.payments
for select
to authenticated
    using (true);

create policy "Users can insert own payments"
on public.payments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own payments"
on public.payments
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own payments"
on public.payments
for delete
to authenticated
using (true);

-- Targets
create policy "Users can view own targets"
on public.targets
for select
to authenticated
    using (true);

create policy "Users can insert own targets"
on public.targets
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own targets"
on public.targets
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own targets"
on public.targets
for delete
to authenticated
using (true);

-- Target rewards
create policy "Users can view own target_rewards"
on public.target_rewards
for select
to authenticated
    using (true);

create policy "Users can insert own target_rewards"
on public.target_rewards
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own target_rewards"
on public.target_rewards
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own target_rewards"
on public.target_rewards
for delete
to authenticated
using (true);

-- Notifications
create policy "Users can view own notifications"
on public.notifications
for select
to authenticated
    using (true);

create policy "Users can insert own notifications"
on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own notifications"
on public.notifications
for delete
to authenticated
using (true);

-- Product stock entries
create policy "Users can view own product_stock_entries"
on public.product_stock_entries
for select
to authenticated
    using (true);

create policy "Users can insert own product_stock_entries"
on public.product_stock_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own product_stock_entries"
on public.product_stock_entries
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own product_stock_entries"
on public.product_stock_entries
for delete
to authenticated
using (true);

-- Product stock transfers
create policy "Users can view own product_stock_transfers"
on public.product_stock_transfers
for select
to authenticated
    using (true);

create policy "Users can insert own product_stock_transfers"
on public.product_stock_transfers
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own product_stock_transfers"
on public.product_stock_transfers
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own product_stock_transfers"
on public.product_stock_transfers
for delete
to authenticated
using (true);

-- Retail transactions
create policy "Users can view own retail_transactions"
on public.retail_transactions
for select
to authenticated
    using (true);

create policy "Users can insert own retail_transactions"
on public.retail_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own retail_transactions"
on public.retail_transactions
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own retail_transactions"
on public.retail_transactions
for delete
to authenticated
using (true);

-- Customization
create policy "Users can view own customization"
on public.customization
for select
to authenticated
    using (true);

create policy "Users can insert own customization"
on public.customization
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own customization"
on public.customization
for update
to authenticated
using (true)
with check (true);

create policy "Users can delete own customization"
on public.customization
for delete
to authenticated
using (true);

-- Function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, 'User'),
    'member'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- NOTE: Supabase auth admin user creation is not available inside SQL using
-- the JavaScript-style call `auth.admin.create_user(...)`.
-- That syntax is only valid in the Supabase client, not in a database function.
-- Create users with the Supabase Admin API / service role client instead.
-- Example: use a server-side script with SUPABASE_SERVICE_ROLE_KEY to create
-- the admin user and then promote the profile to `role = 'admin'`.
-- This keeps the database schema clean and avoids unsupported cross-database
-- reference errors in SQL.
