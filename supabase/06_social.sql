-- PHASE 7: run sixth in Supabase -> SQL Editor (after 01-05)
-- Notifications, saved posts, "not interested"/hide, hidden profiles, post privacy settings.

alter table public.posts
  add column if not exists visibility text not null default 'members'
    check (visibility in ('members','matches','private')),
  add column if not exists allow_comments boolean not null default true,
  add column if not exists show_likes boolean not null default true;

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('interest','interest_accepted','interest_declined','match','like','comment','message')),
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and public.is_blocked_pair(p_user, p_actor) then return; end if;
  if p_type = 'message' and exists (select 1 from public.notifications
        where user_id = p_user and actor_id = p_actor and type = 'message' and read_at is null) then return; end if;
  insert into public.notifications (user_id, actor_id, type, post_id) values (p_user, p_actor, p_type, p_post);
end $$;

create or replace function public.trg_interest_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.to_uid, new.from_uid, 'interest', null);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then perform public.notify(new.from_uid, new.to_uid, 'match', null);
    elsif new.status = 'declined' then perform public.notify(new.from_uid, new.to_uid, 'interest_declined', null);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists interest_notify on public.interests;
create trigger interest_notify after insert or update on public.interests
  for each row execute function public.trg_interest_notify();

create or replace function public.trg_like_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id);
  return null;
end $$;
drop trigger if exists like_notify on public.post_likes;
create trigger like_notify after insert on public.post_likes for each row execute function public.trg_like_notify();

create or replace function public.trg_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'comment', new.post_id);
  return null;
end $$;
drop trigger if exists comment_notify on public.post_comments;
create trigger comment_notify after insert on public.post_comments for each row execute function public.trg_comment_notify();

create or replace function public.trg_message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.to_uid, new.from_uid, 'message', null);
  return null;
end $$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.trg_message_notify();

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ---------- saved posts, feedback, hidden profiles ----------
create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.post_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hidden','not_interested')),
  hashtags text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.hidden_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
alter table public.saved_posts enable row level security;
alter table public.post_feedback enable row level security;
alter table public.hidden_profiles enable row level security;
drop policy if exists "own saved" on public.saved_posts;
create policy "own saved" on public.saved_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own feedback" on public.post_feedback;
create policy "own feedback" on public.post_feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own hidden profiles" on public.hidden_profiles;
create policy "own hidden profiles" on public.hidden_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- post privacy + comment switch ----------
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or
  (public.is_face_verified(auth.uid())
   and not public.is_blocked_pair(auth.uid(), user_id) and not public.is_banned(user_id)
   and (visibility = 'members' or (visibility = 'matches' and public.are_connected(auth.uid(), user_id)))));

drop policy if exists "add comment" on public.post_comments;
create policy "add comment" on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_face_verified(auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id and (p.allow_comments or p.user_id = auth.uid())));
