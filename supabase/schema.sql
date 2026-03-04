-- Execute no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  hunter_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair
on public.friendships (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  hunter_name_snapshot text not null,
  avatar_url_snapshot text,
  content text not null check (char_length(content) between 1 and 280),
  level_snapshot int not null default 1,
  power_snapshot int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;

-- recria policies (compatível com Supabase/Postgres)
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "friendships_select_involved" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_update_involved" on public.friendships;
drop policy if exists "friendships_delete_involved" on public.friendships;

drop policy if exists "posts_select_author_or_friend" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;

-- profiles
create policy "profiles_select_all"
on public.profiles for select
using (true);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- friendships
create policy "friendships_select_involved"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_insert_requester"
on public.friendships for insert
with check (auth.uid() = requester_id);

create policy "friendships_update_involved"
on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_delete_involved"
on public.friendships for delete
using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- posts
create policy "posts_select_author_or_friend"
on public.posts for select
using (
  auth.uid() = author_id
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = posts.author_id)
        or
        (f.addressee_id = auth.uid() and f.requester_id = posts.author_id)
      )
  )
);

create policy "posts_insert_own"
on public.posts for insert
with check (auth.uid() = author_id);

create policy "posts_update_own"
on public.posts for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "posts_delete_own"
on public.posts for delete
using (auth.uid() = author_id);
