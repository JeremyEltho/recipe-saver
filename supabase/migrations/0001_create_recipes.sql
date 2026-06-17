-- Recipes saved from YouTube videos.
-- Run via the Supabase MCP, the Supabase SQL editor, or `supabase db push`.

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null,
  video_id    text not null,
  markdown    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists recipes_created_at_idx
  on public.recipes (created_at desc);

-- Lock the table down. The app talks to Supabase only from server-side
-- API routes using the service-role key, which bypasses RLS. Enabling RLS
-- with no public policies means anon/public clients get nothing.
alter table public.recipes enable row level security;
