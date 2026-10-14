-- Run once in Supabase SQL Editor: lets the webhook link a Stripe customer to a user.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
create index if not exists profiles_stripe_customer_idx on public.profiles (stripe_customer_id);
