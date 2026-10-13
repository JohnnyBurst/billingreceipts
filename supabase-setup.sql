-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_idx on public.documents (user_id, updated_at desc);
alter table public.documents enable row level security;

create policy "read own documents"   on public.documents for select to authenticated using (user_id = auth.uid());
create policy "insert own documents" on public.documents for insert to authenticated with check (user_id = auth.uid());
create policy "update own documents" on public.documents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own documents" on public.documents for delete to authenticated using (user_id = auth.uid());
