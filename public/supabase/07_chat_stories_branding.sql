-- PHASE 8: run seventh in Supabase -> SQL Editor (after 01-06)
-- Branding (app name + logos), verified-link allowlist, rich chat (voice/photo/video/post), stories.

-- ================= BRANDING =================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  app_name text not null default 'Matrimony LK' check (char_length(app_name) between 1 and 40),
  logo_light text,
  logo_dark text,
  show_name boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
grant select on public.app_settings to anon, authenticated;
drop policy if exists "anyone reads settings" on public.app_settings;
create policy "anyone reads settings" on public.app_settings for select to anon, authenticated using (true);
drop policy if exists "admin updates settings" on public.app_settings;
create policy "admin updates settings" on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
drop policy if exists "admin adds branding" on storage.objects;
create policy "admin adds branding" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());
drop policy if exists "admin edits branding" on storage.objects;
create policy "admin edits branding" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());
drop policy if exists "admin removes branding" on storage.objects;
create policy "admin removes branding" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());

-- ================= VERIFIED LINKS =================
create table if not exists public.allowed_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '[/ :@]'),
  added_at timestamptz not null default now()
);
alter table public.allowed_domains enable row level security;
drop policy if exists "read allowed domains" on public.allowed_domains;
create policy "read allowed domains" on public.allowed_domains for select to authenticated using (true);
drop policy if exists "admin adds domain" on public.allowed_domains;
create policy "admin adds domain" on public.allowed_domains for insert to authenticated with check (public.is_admin());
drop policy if exists "admin removes domain" on public.allowed_domains;
create policy "admin removes domain" on public.allowed_domains for delete to authenticated using (public.is_admin());
insert into public.allowed_domains (domain) values
  ('youtube.com'), ('youtu.be'), ('linkedin.com'), ('facebook.com'), ('instagram.com')
on conflict do nothing;

create or replace function public.check_message_links() returns trigger
language plpgsql security definer set search_path = public as $$
declare m text[]; host text;
begin
  if new.body is null or new.body = '' then return new; end if;
  for m in select regexp_matches(new.body, '((?:https?://|www\.)[^\s]+)', 'gi') loop
    host := lower(substring(m[1] from '^(?:https?://)?(?:www\.)?([^/:?#\s]+)'));
    if not exists (select 1 from public.allowed_domains d where host = d.domain or host like ('%.' || d.domain)) then
      raise exception 'Only links from verified websites can be shared (%).', host;
    end if;
  end loop;
  return new;
end $$;

-- ================= RICH CHAT =================
alter table public.messages
  add column if not exists kind text not null default 'text' check (kind in ('text','image','video','voice','post')),
  add column if not exists media_path text,
  add column if not exists duration_s int,
  add column if not exists post_id uuid references public.posts(id) on delete set null;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_body_len;
alter table public.messages add constraint messages_body_len
  check (char_length(body) <= 1000 and (kind <> 'text' or char_length(body) >= 1));
drop trigger if exists check_links on public.messages;
create trigger check_links before insert on public.messages
  for each row execute function public.check_message_links();

drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages for insert to authenticated
  with check (from_uid = auth.uid() and public.are_connected(from_uid, to_uid)
              and not public.is_blocked_pair(from_uid, to_uid)
              and (public.is_face_verified(auth.uid()) or public.is_admin())
              and (media_path is null or media_path like auth.uid()::text || '/%'));

-- opening a chat marks messages seen (double tick for the sender) and clears the message notification
create or replace function public.mark_read(p_other uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where to_uid = auth.uid() and from_uid = p_other and read_at is null;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and actor_id = p_other and type = 'message' and read_at is null;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
        'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a'])
on conflict (id) do nothing;
drop policy if exists "upload chat media" on storage.objects;
create policy "upload chat media" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_face_verified(auth.uid()));
drop policy if exists "read chat media" on storage.objects;
create policy "read chat media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = name
               and (m.to_uid = auth.uid() or m.from_uid = auth.uid()))));
drop policy if exists "delete chat media" on storage.objects;
create policy "delete chat media" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ================= STORIES =================
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  overlay jsonb not null default '{}'::jsonb,
  music_path text,
  music_title text check (music_title is null or char_length(music_title) <= 80),
  music_start int not null default 0 check (music_start between 0 and 3600),
  visibility text not null default 'members' check (visibility in ('members','matches')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_created_idx on public.stories (created_at desc);
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "read stories" on public.stories;
create policy "read stories" on public.stories for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or
  (expires_at > now() and public.is_face_verified(auth.uid())
   and not public.is_blocked_pair(auth.uid(), user_id) and not public.is_banned(user_id)
   and (visibility = 'members' or (visibility = 'matches' and public.are_connected(auth.uid(), user_id)))));
drop policy if exists "post story" on public.stories;
create policy "post story" on public.stories for insert to authenticated with check (
  user_id = auth.uid() and public.is_face_verified(auth.uid())
  and media_path like auth.uid()::text || '/%'
  and (music_path is null or music_path like auth.uid()::text || '/%'));
drop policy if exists "delete story" on public.stories;
create policy "delete story" on public.stories for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "record view" on public.story_views;
create policy "record view" on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id));
drop policy if exists "read views" on public.story_views;
create policy "read views" on public.story_views for select to authenticated using (
  viewer_id = auth.uid()
  or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));

create or replace function public.limit_daily_stories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.stories where user_id = new.user_id
        and created_at > now() - interval '1 day') >= 15 then
    raise exception 'Daily story limit reached (15 per day)';
  end if;
  return new;
end $$;
drop trigger if exists limit_stories on public.stories;
create trigger limit_stories before insert on public.stories
  for each row execute function public.limit_daily_stories();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-media', 'story-media', false, 26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
        'audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/x-m4a'])
on conflict (id) do nothing;
drop policy if exists "upload story media" on storage.objects;
create policy "upload story media" on storage.objects for insert to authenticated
  with check (bucket_id = 'story-media' and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_face_verified(auth.uid()));
drop policy if exists "read story media" on storage.objects;
create policy "read story media" on storage.objects for select to authenticated
  using (bucket_id = 'story-media' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    or exists (select 1 from public.stories s where s.media_path = name or s.music_path = name)));
drop policy if exists "delete story media" on storage.objects;
create policy "delete story media" on storage.objects for delete to authenticated
  using (bucket_id = 'story-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
