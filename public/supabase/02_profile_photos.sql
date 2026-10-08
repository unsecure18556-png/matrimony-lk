-- PHASE 2: run second in Supabase -> SQL Editor
alter table public.profiles
  add column if not exists gender text check (gender in ('male','female')),
  add column if not exists dob date,
  add column if not exists height_cm int check (height_cm between 120 and 230),
  add column if not exists marital_status text,
  add column if not exists district text,
  add column if not exists country_living text default 'Sri Lanka',
  add column if not exists religion text,
  add column if not exists ethnicity text,
  add column if not exists caste text,
  add column if not exists mother_tongue text,
  add column if not exists diet text,
  add column if not exists education text,
  add column if not exists occupation text,
  add column if not exists family_type text,
  add column if not exists father_occupation text,
  add column if not exists mother_occupation text,
  add column if not exists siblings int check (siblings between 0 and 20),
  add column if not exists about text,
  add column if not exists pref_age_min int default 21,
  add column if not exists pref_age_max int default 35,
  add column if not exists pref_religion text default 'any',
  add column if not exists completion_score int not null default 0;

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profile_photos enable row level security;

create policy "signed-in can view photos" on public.profile_photos for select to authenticated using (true);
create policy "add own photos" on public.profile_photos for insert to authenticated
  with check (auth.uid() = user_id and path like auth.uid()::text || '/%');
create policy "update own photos" on public.profile_photos for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own photos" on public.profile_photos for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "signed-in can read photos" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos');
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
