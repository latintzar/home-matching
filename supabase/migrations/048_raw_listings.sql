create table if not exists public.raw_listings (
  id bigint generated always as identity primary key,
  url text not null,
  html text not null,
  images jsonb not null, -- array of base64 strings
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.raw_listings enable row level security;

-- Create policy for insert (allow all for now as per architecture implies flexible user)
create policy "Enable insert for all users"
on public.raw_listings for insert
with check (true);

-- Create policy for select (only owner or service role)
create policy "Enable select for owners"
on public.raw_listings for select
using (auth.uid() = user_id);


