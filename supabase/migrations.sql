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

-- ------------------------------------------------------------
-- 6. Profile bio
-- ------------------------------------------------------------

alter table profiles add column if not exists bio text;

-- ------------------------------------------------------------
-- 7. Email-free auth (username + password) recovery token.
--    Stores only a SHA-256 hash of the one-time recovery code
--    shown to the user at signup — never the plaintext code.
-- ------------------------------------------------------------

alter table profiles add column if not exists recovery_token_hash text;

-- ============================================================
-- 8. DIRECT MESSAGES + NOTIFICATIONS
--    - conversations: one row per pair of users (sorted so the
--      pair is unique regardless of who started it)
--    - messages: belong to a conversation
--    - notifications: e.g. "X started following you"
--    Run this whole block in Supabase → SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 8a. Conversations (a DM thread between two users)
-- ------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  -- user_a is always the lexicographically smaller id so each pair
  -- maps to exactly one row (enforced by the unique constraint).
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint conversation_pair_ordered check (user_a < user_b),
  constraint conversation_pair_unique unique (user_a, user_b)
);

-- ------------------------------------------------------------
-- 8b. Messages
-- ------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_messages_conversation on messages (conversation_id, created_at);
create index if not exists idx_conversations_user_a on conversations (user_a);
create index if not exists idx_conversations_user_b on conversations (user_b);

-- ------------------------------------------------------------
-- 8c. get_or_create_conversation(other_user)
--     Returns the conversation id between the caller (auth.uid())
--     and other_user, creating it if needed. Runs as the definer
--     so it can insert the ordered pair under RLS.
-- ------------------------------------------------------------
create or replace function get_or_create_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  convo uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_user is null or other_user = me then
    raise exception 'invalid conversation target';
  end if;

  -- order the pair so it's unique
  if me < other_user then a := me; b := other_user;
  else a := other_user; b := me;
  end if;

  insert into conversations (user_a, user_b)
  values (a, b)
  on conflict (user_a, user_b) do nothing;

  select id into convo from conversations where user_a = a and user_b = b;
  return convo;
end;
$$;

-- ------------------------------------------------------------
-- 8d. Bump conversation.last_message_at on each new message,
--     so the conversation list can sort by most-recent.
-- ------------------------------------------------------------
create or replace function bump_conversation_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_conversation on messages;
create trigger trg_bump_conversation
  after insert on messages
  for each row execute function bump_conversation_timestamp();

-- ------------------------------------------------------------
-- 8e. Notifications
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,   -- recipient
  actor_id uuid not null references profiles(id) on delete cascade,  -- who did the thing
  type text not null check (type in ('follow')),
  read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

-- Create a 'follow' notification whenever someone follows someone else.
create or replace function notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists trg_notify_follow on follows;
create trigger trg_notify_follow
  after insert on follows
  for each row execute function notify_on_follow();

-- ------------------------------------------------------------
-- 8f. Row level security
-- ------------------------------------------------------------
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- Conversations: visible to and insertable by either participant.
drop policy if exists "Participants can see conversations" on conversations;
create policy "Participants can see conversations" on conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Participants can create conversations" on conversations;
create policy "Participants can create conversations" on conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- Messages: readable/writable only by conversation participants.
drop policy if exists "Participants can read messages" on messages;
create policy "Participants can read messages" on messages
  for select using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

drop policy if exists "Participants can send messages" on messages;
create policy "Participants can send messages" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Notifications: you can only see and update (mark read) your own.
drop policy if exists "Users see own notifications" on notifications;
create policy "Users see own notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on notifications;
create policy "Users update own notifications" on notifications
  for update using (auth.uid() = user_id);
-- (inserts happen via the SECURITY DEFINER follow trigger, so no
--  insert policy is needed for end users.)

-- ------------------------------------------------------------
-- 8g. Realtime — after running this, also enable Replication for
--     the `messages` and `notifications` tables in the Dashboard:
--     Database → Replication → supabase_realtime.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
