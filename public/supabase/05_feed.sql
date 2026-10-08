-- PHASE 6: run fifth in Supabase -> SQL Editor (after 01-04)
-- Feed: posts with photos, hashtags, location; likes; comments. Verified members only.

alter table public.profiles add column if not exists interests text[] not null default '{}';

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text check (caption is null or (
    char_length(caption) <= 1000
    and caption !~* '(https?://|www\.)'
    and caption !~ '([0-9][ -]?){9,}')),
  hashtags text[] not null default '{}',
  location text check (location is null or char_length(location) <= 80),
  district text,
  image_paths text[] not null check (array_length(image_paths, 1) between 1 and 4),
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_tags_idx on public.posts using gin (hashtags);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300
    and body !~* '(https?://|www\.)' and body !~ '([0-9][ -]?){9,}'),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.post_comments (post_id, created_at);

-- reports can point at a post
alter table public.reports add column if not exists post_id uuid;
do $$ begin
  alter table public.reports add constraint reports_post_id_fkey
    foreign key (post_id) references public.posts(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or
  (public.is_face_verified(auth.uid())
   and not public.is_blocked_pair(auth.uid(), user_id) and not public.is_banned(user_id)));
drop policy if exists "create post" on public.posts;
create policy "create post" on public.posts for insert to authenticated with check (
  user_id = auth.uid() and public.is_face_verified(auth.uid())
  and not exists (select 1 from unnest(image_paths) p where p not like auth.uid()::text || '/%'));
drop policy if exists "delete post" on public.posts;
create policy "delete post" on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "read likes" on public.post_likes;
create policy "read likes" on public.post_likes for select to authenticated using (public.is_face_verified(auth.uid()));
drop policy if exists "like post" on public.post_likes;
create policy "like post" on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_face_verified(auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "unlike post" on public.post_likes;
create policy "unlike post" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "read comments" on public.post_comments;
create policy "read comments" on public.post_comments for select to authenticated
  using (public.is_face_verified(auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "add comment" on public.post_comments;
create policy "add comment" on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_face_verified(auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "delete comment" on public.post_comments;
create policy "delete comment" on public.post_comments for delete to authenticated using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- max 5 posts per day
create or replace function public.limit_daily_posts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.posts where user_id = new.user_id
        and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Daily post limit reached (5 per day)';
  end if;
  return new;
end $$;
drop trigger if exists limit_posts on public.posts;
create trigger limit_posts before insert on public.posts
  for each row execute function public.limit_daily_posts();

-- private bucket for post photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "upload post images" on storage.objects;
create policy "upload post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_face_verified(auth.uid()));
drop policy if exists "read post images" on storage.objects;
create policy "read post images" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (public.is_face_verified(auth.uid()) or public.is_admin()));
drop policy if exists "delete post images" on storage.objects;
create policy "delete post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
