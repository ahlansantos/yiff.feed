-- Run this in Supabase → SQL Editor to create the database tables.
-- If you already ran an older version, run supabase/migrations.sql instead.

-- Profiles (one per user)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  fursona_name text,
  fursona_species text,
  bio text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  is_nsfw boolean default false,
  repost_of uuid references posts(id),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz default now()
);

-- Follows
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

-- Likes
create table if not exists likes (
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Row level security
alter table profiles enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Profiles policies
drop policy if exists "Profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Posts policies
drop policy if exists "Posts are viewable by everyone" on posts;
drop policy if exists "Users can create posts" on posts;
drop policy if exists "Users can delete own posts" on posts;
create policy "Posts are viewable by everyone" on posts for select using (true);
create policy "Users can create posts" on posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts" on posts for update using (auth.uid() = user_id);
create policy "Users can delete own posts" on posts for delete using (auth.uid() = user_id);

-- Follows policies
drop policy if exists "Follows are viewable by everyone" on follows;
drop policy if exists "Users can follow" on follows;
drop policy if exists "Users can unfollow" on follows;
create policy "Follows are viewable by everyone" on follows for select using (true);
create policy "Users can follow" on follows for insert with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);

-- Likes policies
drop policy if exists "Likes are viewable by everyone" on likes;
drop policy if exists "Users can like" on likes;
drop policy if exists "Users can unlike" on likes;
create policy "Likes are viewable by everyone" on likes for select using (true);
create policy "Users can like" on likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike" on likes for delete using (auth.uid() = user_id);

-- Comments policies
drop policy if exists "Comments are viewable by everyone" on comments;
drop policy if exists "Users can comment" on comments;
drop policy if exists "Users can delete own comments" on comments;
create policy "Comments are viewable by everyone" on comments for select using (true);
create policy "Users can comment" on comments for insert with check (auth.uid() = user_id);
create policy "Users can update own comments" on comments for update using (auth.uid() = user_id);
create policy "Users can delete own comments" on comments for delete using (auth.uid() = user_id);

-- ============================================================
-- DENORMALIZED COUNTS — triggers keep posts.likes_count /
-- posts.comments_count in sync so the feed never has to fetch
-- and count every likes/comments row.
-- ============================================================

create or replace function bump_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_likes_count on likes;
create trigger trg_likes_count
  after insert or delete on likes
  for each row execute function bump_likes_count();

create or replace function bump_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comments_count on comments;
create trigger trg_comments_count
  after insert or delete on comments
  for each row execute function bump_comments_count();

-- ============================================================
-- INDEXES for the feed / profile queries
-- ============================================================
create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_posts_user_id on posts (user_id);
create index if not exists idx_posts_media_type on posts (media_type);
create index if not exists idx_likes_user_id on likes (user_id);
create index if not exists idx_comments_post_id on comments (post_id);
create index if not exists idx_follows_follower on follows (follower_id);

-- ============================================================
-- STORAGE SETUP (do this in Supabase Dashboard too)
-- ============================================================
-- 1. Storage → New bucket → name: posts-media → Public: ON
-- 2. Storage → New bucket → name: avatars → Public: ON
-- 3. Then run the policies below:

insert into storage.buckets (id, name, public)
values ('posts-media', 'posts-media', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- posts-media policies
drop policy if exists "Post media is public" on storage.objects;
drop policy if exists "Users can upload post media" on storage.objects;
drop policy if exists "Users can update own post media" on storage.objects;
drop policy if exists "Users can delete own post media" on storage.objects;

create policy "Post media is public"
  on storage.objects for select
  using (bucket_id = 'posts-media');

create policy "Users can upload post media"
  on storage.objects for insert
  with check (
    bucket_id = 'posts-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own post media"
  on storage.objects for update
  using (
    bucket_id = 'posts-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own post media"
  on storage.objects for delete
  using (
    bucket_id = 'posts-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- avatars policies
drop policy if exists "Avatars are public" on storage.objects;
drop policy if exists "Users can upload avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

create policy "Avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Enable realtime for live feed (optional but recommended)
-- Dashboard → Database → Replication → enable "posts" table
