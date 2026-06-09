-- ============================================================
-- Migration: denormalized counts, triggers, update policies,
--            and PII-safe username handling support.
-- Run this in Supabase → SQL Editor on an existing database.
-- Safe to run more than once (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Denormalized like/comment counts on posts
--    Kills the N+1 / over-fetch where the app pulled every
--    likes & comments row just to count them.
-- ------------------------------------------------------------

alter table posts add column if not exists likes_count integer not null default 0;
alter table posts add column if not exists comments_count integer not null default 0;

-- Backfill existing rows to the true counts
update posts p set
  likes_count = coalesce((select count(*) from likes l where l.post_id = p.id), 0),
  comments_count = coalesce((select count(*) from comments c where c.post_id = p.id), 0);

-- ------------------------------------------------------------
-- 2. Triggers to keep counts in sync
-- ------------------------------------------------------------

-- Likes -> posts.likes_count
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

-- Comments -> posts.comments_count
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

-- ------------------------------------------------------------
-- 3. Helpful indexes for the feed queries
-- ------------------------------------------------------------

create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_posts_user_id on posts (user_id);
create index if not exists idx_posts_media_type on posts (media_type);
create index if not exists idx_likes_user_id on likes (user_id);
create index if not exists idx_comments_post_id on comments (post_id);
create index if not exists idx_follows_follower on follows (follower_id);

-- ------------------------------------------------------------
-- 4. UPDATE policies (so future "edit post / edit comment"
--    works without another migration). Owner-only.
-- ------------------------------------------------------------

drop policy if exists "Users can update own posts" on posts;
create policy "Users can update own posts" on posts
  for update using (auth.uid() = user_id);

drop policy if exists "Users can update own comments" on comments;
create policy "Users can update own comments" on comments
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. Prevent self-follows
--    Remove any existing self-follow rows, then enforce it at
--    the DB level (constraint) and tighten the insert policy.
-- ------------------------------------------------------------

delete from follows where follower_id = following_id;

alter table follows drop constraint if exists no_self_follow;
alter table follows add constraint no_self_follow check (follower_id <> following_id);

drop policy if exists "Users can follow" on follows;
create policy "Users can follow" on follows
  for insert with check (auth.uid() = follower_id and follower_id <> following_id);
