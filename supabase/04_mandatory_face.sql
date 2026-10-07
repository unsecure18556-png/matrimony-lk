-- PHASE 5: run fourth in Supabase -> SQL Editor (after 01, 02, 03)
-- Makes face verification mandatory, enforced by the database (not only the app screens).
-- Unverified members cannot see other profiles/photos, send interests, or chat,
-- and unverified profiles are not listed to others. Admins are exempt.

create or replace function public.is_face_verified(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select face_verified from public.profiles where id = uid), false);
$$;

drop policy if exists "read visible profiles" on public.profiles;
create policy "read visible profiles" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or
  (onboarding_complete and face_verified and public.is_face_verified(auth.uid())
   and not public.is_blocked_pair(auth.uid(), id) and not public.is_banned(id))
);

create or replace function public.can_view_photos(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    owner = auth.uid() or public.is_admin() or
    (public.is_face_verified(auth.uid())
      and not public.is_blocked_pair(auth.uid(), owner) and not public.is_banned(owner)
      and ((select photo_visibility from public.profiles where id = owner) = 'public'
           or public.are_connected(auth.uid(), owner))));
$$;

drop policy if exists "send interest" on public.interests;
create policy "send interest" on public.interests for insert to authenticated
  with check (from_uid = auth.uid() and status = 'pending'
              and not public.is_blocked_pair(from_uid, to_uid)
              and (public.is_face_verified(auth.uid()) or public.is_admin()));

drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages for insert to authenticated
  with check (from_uid = auth.uid() and public.are_connected(from_uid, to_uid)
              and not public.is_blocked_pair(from_uid, to_uid)
              and (public.is_face_verified(auth.uid()) or public.is_admin()));

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
   where seed.c is not null and public.is_face_verified(auth.uid())
     and p.face_match_opt_in and p.onboarding_complete
     and p.gender is distinct from me.gender and p.id <> auth.uid()
     and not public.is_blocked_pair(auth.uid(), p.id) and not public.is_banned(p.id)
     and p.id not in (select profile_id from public.shortlist where user_id = auth.uid())
   order by 2 limit least(p_limit, 50);
$$;
