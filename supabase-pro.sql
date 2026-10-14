-- Run once in Supabase SQL Editor (after supabase-setup.sql): plans and saved clients
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Users may read their own plan but never change it (only the server / dashboard can).
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Create profiles for people who already signed up
insert into public.profiles (id) select id from auth.users on conflict do nothing;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.clients enable row level security;
create policy "read own clients"   on public.clients for select to authenticated using (user_id = auth.uid());
create policy "insert own clients" on public.clients for insert to authenticated with check (user_id = auth.uid());
create policy "update own clients" on public.clients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own clients" on public.clients for delete to authenticated using (user_id = auth.uid());

-- To give yourself Pro for testing (replace the email):
-- update public.profiles set plan = 'pro' where id = (select id from auth.users where email = 'you@example.com');
