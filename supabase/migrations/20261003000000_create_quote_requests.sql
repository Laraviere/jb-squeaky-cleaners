-- Website quote requests. Apply to the intended Supabase project before enabling the form.
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) between 1 and 40),
  email text not null check (char_length(email) between 1 and 254),
  service_type text not null check (service_type in ('Residential', 'Commercial', 'Deep cleaning', 'Heavy-duty cleaning', 'Not sure yet')),
  location text not null check (char_length(location) between 1 and 200),
  frequency text not null check (frequency in ('One-time', 'Weekly', 'Every other week', 'Monthly', 'Other / not sure')),
  property_size text not null check (char_length(property_size) between 1 and 100),
  preferred_timing text not null check (char_length(preferred_timing) between 1 and 200),
  details text not null check (char_length(details) between 1 and 4000)
);

alter table public.quote_requests enable row level security;
revoke all on public.quote_requests from anon, authenticated, service_role;
grant insert on public.quote_requests to service_role;
grant select (id) on public.quote_requests to service_role;
-- No public SELECT or INSERT policy: only the server can access the table.
