-- ai_domain_whitelist table for dynamic domain approvals
create table if not exists public.ai_domain_whitelist (
  domain text primary key,
  category text not null,
  credibility text not null check (credibility in ('yes','no')),
  confidence numeric,
  first_seen_at timestamptz default now(),
  approved_by_ai boolean default true
);

alter table public.ai_domain_whitelist enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_domain_whitelist' and policyname = 'Allow read to authenticated users'
  ) then
    create policy "Allow read to authenticated users" on public.ai_domain_whitelist for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_domain_whitelist' and policyname = 'Allow insert to service role'
  ) then
    create policy "Allow insert to service role" on public.ai_domain_whitelist for insert with check ( auth.role() = 'service_role' );
  end if;
end $$;


