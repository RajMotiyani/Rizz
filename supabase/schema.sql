-- Rizz database setup. Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- Users: one row per person who has logged in. View it in Table Editor > users.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  login_count integer not null default 0,
  replies_used integer not null default 0,
  last_reply_at timestamptz
);

-- Small key-value table for login codes (hashed), daily limits and rate limits.
create table if not exists public.kv (
  key text primary key,
  value text not null,
  expires_at timestamptz
);

-- Lock everything down: only the server (service role key) can read or write.
alter table public.users enable row level security;
alter table public.kv enable row level security;

-- Atomic counter with expiry, used for "50 replies a day" and code rate limits.
create or replace function public.kv_incr(k text, ttl_seconds integer, delta integer default 1)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into kv (key, value, expires_at)
  values (k, greatest(delta, 0)::text, now() + make_interval(secs => ttl_seconds))
  on conflict (key) do update set
    value = case when kv.expires_at is not null and kv.expires_at < now()
                 then greatest(delta, 0)::text
                 else greatest(kv.value::bigint + delta, 0)::text end,
    expires_at = case when kv.expires_at is not null and kv.expires_at < now()
                      then now() + make_interval(secs => ttl_seconds)
                      else kv.expires_at end
  returning value::bigint;
$$;

create or replace function public.record_reply(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update users set replies_used = replies_used + 1, last_reply_at = now() where id = uid;
$$;

create or replace function public.record_login(e text, p text)
returns users
language sql
security definer
set search_path = public
as $$
  insert into users (email, phone, last_login_at, login_count)
  values (e, p, now(), 1)
  on conflict (email) do update set
    phone = coalesce(excluded.phone, users.phone),
    last_login_at = now(),
    login_count = users.login_count + 1
  returning *;
$$;

-- Only the server may call these.
revoke execute on function public.kv_incr(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.record_reply(uuid) from public, anon, authenticated;
revoke execute on function public.record_login(text, text) from public, anon, authenticated;
