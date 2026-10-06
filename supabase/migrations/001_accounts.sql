-- ChangeWatch accounts, watches, alerts, and RLS

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'power')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create table public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  url text not null,
  webhook text,
  interval_minutes integer not null,
  paused boolean not null default false,
  hash text,
  "text" text,
  title text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_status integer,
  last_error text,
  change_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index watches_user_id_idx on public.watches (user_id);
create index watches_last_checked_at_idx on public.watches (last_checked_at);
create index watches_paused_idx on public.watches (paused);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.watches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  url text,
  title text,
  checked_at timestamptz,
  added jsonb not null default '[]'::jsonb,
  removed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index alerts_user_id_idx on public.alerts (user_id);
create index alerts_watch_id_idx on public.alerts (watch_id);
create index alerts_checked_at_idx on public.alerts (checked_at desc);

alter table public.profiles enable row level security;
alter table public.watches enable row level security;
alter table public.alerts enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "watches_select_own"
  on public.watches for select
  using (auth.uid() = user_id);

create policy "watches_insert_own"
  on public.watches for insert
  with check (auth.uid() = user_id);

create policy "watches_update_own"
  on public.watches for update
  using (auth.uid() = user_id);

create policy "watches_delete_own"
  on public.watches for delete
  using (auth.uid() = user_id);

create policy "alerts_select_own"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "alerts_insert_own"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "alerts_delete_own"
  on public.alerts for delete
  using (auth.uid() = user_id);
