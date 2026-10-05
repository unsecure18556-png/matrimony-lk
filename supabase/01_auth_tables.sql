-- PHASE 1: run first in Supabase -> SQL Editor (skip if already done)
create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  plan text not null default 'free' check (plan in ('free','premium')),
  face_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  creating_for text not null default 'self',
  onboarding_complete boolean not null default false,
  photo_visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (id) values (new.id);
  insert into public.profiles (id, full_name, creating_for)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'creating_for', 'self')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;

create policy "read own account" on public.accounts for select to authenticated using (auth.uid() = id);
create policy "signed-in users can read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
