-- PHASE 3+4: run third in Supabase -> SQL Editor (after 01 and 02)
create extension if not exists vector with schema extensions;

alter table public.accounts add column if not exists banned boolean not null default false;

alter table public.profiles
  add column if not exists face_verified boolean not null default false,
  add column if not exists face_match_opt_in boolean not null default false,
  add column if not exists nakath text,
  add column if not exists rashi text,
  add column if not exists pref_ethnicity text default 'any',
  add column if not exists pref_district text default 'any',
  add column if not exists pref_marital text default 'any';

-- users must never be able to set face_verified themselves
create or replace function public.protect_profile_fields() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    new.face_verified := old.face_verified;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------- tables ----------
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  blocked_name text,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked), check (blocker <> blocked)
);
create table if not exists public.shortlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  from_uid uuid not null references auth.users(id) on delete cascade,
  to_uid uuid not null references auth.users(id) on delete cascade,
  message text check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_uid, to_uid), check (from_uid <> to_uid)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_uid uuid not null references auth.users(id) on delete cascade,
  to_uid uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000 and body !~* '(https?://|www\.)'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_pair_idx on public.messages (from_uid, to_uid, created_at desc);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create table if not exists public.contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text check (char_length(phone) <= 20),
  updated_at timestamptz not null default now()
);
create table if not exists public.face_embeddings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  embedding extensions.vector(128) not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.face_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  distance float8 not null,
  created_at timestamptz not null default now()
);

alter table public.blocks enable row level security;
alter table public.shortlist enable row level security;
alter table public.interests enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.contacts enable row level security;
alter table public.face_embeddings enable row level security;  -- no policies: clients can never read it
alter table public.face_flags enable row level security;

-- ---------- helper functions ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accounts where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_banned(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.accounts where id = uid), false);
$$;
create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;
create or replace function public.are_connected(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.interests where status = 'accepted'
    and ((from_uid = a and to_uid = b) or (from_uid = b and to_uid = a)));
$$;
create or replace function public.can_view_photos(owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    owner = auth.uid() or public.is_admin() or
    (not public.is_blocked_pair(auth.uid(), owner) and not public.is_banned(owner) and
      ((select photo_visibility from public.profiles where id = owner) = 'public'
        or public.are_connected(auth.uid(), owner))));
$$;

-- ---------- policies ----------
drop policy if exists "signed-in users can read profiles" on public.profiles;
drop policy if exists "read visible profiles" on public.profiles;
create policy "read visible profiles" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or
  (onboarding_complete and not public.is_blocked_pair(auth.uid(), id) and not public.is_banned(id))
);

drop policy if exists "signed-in can read photos" on storage.objects;
drop policy if exists "read allowed photos" on storage.objects;
create policy "read allowed photos" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and public.can_view_photos(((storage.foldername(name))[1])::uuid));

drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker = auth.uid()) with check (blocker = auth.uid());
drop policy if exists "own shortlist" on public.shortlist;
create policy "own shortlist" on public.shortlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "see my interests" on public.interests;
create policy "see my interests" on public.interests for select to authenticated
  using (from_uid = auth.uid() or to_uid = auth.uid());
drop policy if exists "send interest" on public.interests;
create policy "send interest" on public.interests for insert to authenticated
  with check (from_uid = auth.uid() and status = 'pending' and not public.is_blocked_pair(from_uid, to_uid));
drop policy if exists "withdraw interest" on public.interests;
create policy "withdraw interest" on public.interests for delete to authenticated
  using (from_uid = auth.uid() and status = 'pending');

drop policy if exists "read my messages" on public.messages;
create policy "read my messages" on public.messages for select to authenticated
  using (from_uid = auth.uid() or to_uid = auth.uid());
drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages for insert to authenticated
  with check (from_uid = auth.uid() and public.are_connected(from_uid, to_uid)
              and not public.is_blocked_pair(from_uid, to_uid));

drop policy if exists "file report" on public.reports;
create policy "file report" on public.reports for insert to authenticated with check (reporter = auth.uid());
drop policy if exists "see reports" on public.reports;
create policy "see reports" on public.reports for select to authenticated
  using (reporter = auth.uid() or public.is_admin());

drop policy if exists "read contact" on public.contacts;
create policy "read contact" on public.contacts for select to authenticated
  using (user_id = auth.uid() or public.are_connected(auth.uid(), user_id));
drop policy if exists "insert own contact" on public.contacts;
create policy "insert own contact" on public.contacts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own contact" on public.contacts;
create policy "update own contact" on public.contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "admin sees flags" on public.face_flags;
create policy "admin sees flags" on public.face_flags for select to authenticated using (public.is_admin());

-- free plan: max 10 interests per day
create or replace function public.limit_daily_interests() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select plan from public.accounts where id = new.from_uid) = 'free'
     and (select count(*) from public.interests where from_uid = new.from_uid
          and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily interest limit reached (10 per day on the free plan)';
  end if;
  return new;
end $$;
drop trigger if exists limit_interests on public.interests;
create trigger limit_interests before insert on public.interests
  for each row execute function public.limit_daily_interests();

-- ---------- RPC functions ----------
create or replace function public.respond_interest(p_id uuid, p_accept boolean) returns void
language sql security definer set search_path = public as $$
  update public.interests
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = p_id and to_uid = auth.uid() and status = 'pending';
$$;

create or replace function public.mark_read(p_other uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where to_uid = auth.uid() and from_uid = p_other and read_at is null;
$$;

-- Face verification: DB compares selfie vs profile photo embeddings
create or replace function public.enroll_face(p_photo float8[], p_selfie float8[], p_opt_in boolean default false)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_photo vector(128); v_selfie vector(128);
  v_dist float8; v_dup uuid; v_dup_dist float8; v_flag boolean := false;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if array_length(p_photo,1) <> 128 or array_length(p_selfie,1) <> 128 then raise exception 'bad embedding'; end if;
  v_photo := p_photo::vector(128);
  v_selfie := p_selfie::vector(128);
  v_dist := v_photo <-> v_selfie;
  if v_dist >= 0.5 then
    return jsonb_build_object('verified', false, 'distance', v_dist);
  end if;
  insert into public.face_embeddings (user_id, embedding) values (v_uid, v_photo)
    on conflict (user_id) do update set embedding = excluded.embedding, updated_at = now();
  select user_id, (embedding <-> v_photo) into v_dup, v_dup_dist
    from public.face_embeddings where user_id <> v_uid order by embedding <-> v_photo limit 1;
  if v_dup is not null and v_dup_dist < 0.45 then
    v_flag := true;
    insert into public.face_flags (user_id, other_user_id, distance) values (v_uid, v_dup, v_dup_dist);
  end if;
  update public.profiles set face_verified = true, face_match_opt_in = p_opt_in where id = v_uid;
  update public.accounts set face_verified = true where id = v_uid;
  return jsonb_build_object('verified', true, 'distance', v_dist, 'duplicate_flag', v_flag);
end $$;

create or replace function public.delete_face_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.face_embeddings where user_id = auth.uid();
  update public.profiles set face_verified = false, face_match_opt_in = false where id = auth.uid();
  update public.accounts set face_verified = false where id = auth.uid();
end $$;

-- Opt-in "similar faces": averages faces of profiles you shortlisted, returns closest opted-in profiles.
-- Embeddings never leave the database.
create or replace function public.face_suggestions(p_limit int default 24)
returns table (profile_id uuid, distance float8)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select gender from public.profiles where id = auth.uid()),
  seed as (
    select avg(fe.embedding) as c
      from public.shortlist s
      join public.face_embeddings fe on fe.user_id = s.profile_id
      join public.profiles sp on sp.id = s.profile_id and sp.face_match_opt_in
     where s.user_id = auth.uid()
  )
  select fe.user_id, (fe.embedding <-> seed.c)::float8
    from public.face_embeddings fe
    join public.profiles p on p.id = fe.user_id
    cross join seed cross join me
   where seed.c is not null and p.face_match_opt_in and p.onboarding_complete
     and p.gender is distinct from me.gender and p.id <> auth.uid()
     and not public.is_blocked_pair(auth.uid(), p.id) and not public.is_banned(p.id)
     and p.id not in (select profile_id from public.shortlist where user_id = auth.uid())
   order by 2 limit least(p_limit, 50);
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text, p_ban boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_reported uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.reports set status = p_status where id = p_id returning reported into v_reported;
  if p_ban and v_reported is not null then
    update public.accounts set banned = true where id = v_reported;
  end if;
end $$;

-- realtime chat
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

-- To make yourself admin, run this ONCE with your own email:
-- update public.accounts set role = 'admin' where id = (select id from auth.users where email = 'YOUR@EMAIL.COM');
