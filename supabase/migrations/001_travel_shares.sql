create table if not exists public.travel_shares (
  id uuid primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists travel_shares_expires_at_idx
  on public.travel_shares (expires_at);

alter table public.travel_shares enable row level security;

-- 浏览器不直接访问该表。Next.js 服务端使用 service role key 读写，
-- 因此无需创建 anon/authenticated policy。
