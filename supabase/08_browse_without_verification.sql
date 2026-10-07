-- PHASE 9: run eighth in Supabase -> SQL Editor (after 01-07)
-- Members can log in and BROWSE (profiles, posts, stories) without face verification.
-- Verification is still required to like, comment, send/accept interests, chat, and post.
-- Only verified members' profiles and posts are visible to others.

-- profiles: viewer no longer needs to be verified (the profile being viewed must be)
drop policy if exists "read visible profiles" on public.profiles;
create policy "read visible profiles" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or
  (onboarding_complete and face_verified
   and not public.is_blocked_pair(auth.uid(), id) and not public.is_banned(id)));

create or replace function public.can_view_photos(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    owner = auth.uid() or public.is_admin() or
    (not public.is_blocked_pair(auth.uid(), owner) and not public.is_banned(owner)
      and ((select photo_visibility from public.profiles where id = owner) = 'public'
           or public.are_connected(auth.uid(), owner))));
$$;

-- posts, likes, comments: anyone signed in can read
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or
  (not public.is_blocked_pair(auth.uid(), user_id) and not public.is_banned(user_id)
   and (visibility = 'members' or (visibility = 'matches' and public.are_connected(auth.uid(), user_id)))));
drop policy if exists "read likes" on public.post_likes;
create policy "read likes" on public.post_likes for select to authenticated using (auth.uid() is not null);
drop policy if exists "read comments" on public.post_comments;
create policy "read comments" on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

-- post photos follow the post's own visibility rules
drop policy if exists "read post images" on storage.objects;
create policy "read post images" on storage.objects for select to authenticated using (
  bucket_id = 'post-images' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    or exists (select 1 from public.posts p where p.image_paths @> array[name])));

-- stories: anyone signed in can watch
drop policy if exists "read stories" on public.stories;
create policy "read stories" on public.stories for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or
  (expires_at > now()
   and not public.is_blocked_pair(auth.uid(), user_id) and not public.is_banned(user_id)
   and (visibility = 'members' or (visibility = 'matches' and public.are_connected(auth.uid(), user_id)))));

-- accepting / declining interests needs verification (with a clear error)
create or replace function public.respond_interest(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_face_verified(auth.uid()) or public.is_admin()) then
    raise exception 'face_verification_required';
  end if;
  update public.interests
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = p_id and to_uid = auth.uid() and status = 'pending';
end $$;

-- UNCHANGED (still need verification): liking, commenting, sending interests, messaging,
-- creating posts/stories and uploading media (policies from files 04, 05 and 07).
