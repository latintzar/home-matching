-- Agents table to store agency/company info extracted from listings
-- Includes optional contact fields for future enrichment

create table if not exists public.agents (
  id bigserial primary key,
  name text not null unique,
  logo_url text,
  email text,
  whatsapp text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep an association from listings -> agents
alter table if exists public.listings
  add column if not exists agent_id bigint references public.agents(id) on delete set null;

-- Indexes
create index if not exists idx_agents_name on public.agents using btree (name);
create index if not exists idx_listings_agent_id on public.listings using btree (agent_id);

-- Triggers to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agents_set_updated_at on public.agents;
create trigger trg_agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

-- RLS
alter table public.agents enable row level security;

-- Allow read access to everyone (UI needs to show logos)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents' and policyname = 'Allow read for all'
  ) then
    create policy "Allow read for all" on public.agents
      for select using (true);
  end if;
end $$;

-- Allow insert/update/delete to service role only
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents' and policyname = 'Service role write'
  ) then
    create policy "Service role write" on public.agents
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;


