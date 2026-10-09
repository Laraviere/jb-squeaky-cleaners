-- Review locally first. Do not apply to hosted Supabase without approval.
begin;
create schema employment_private;
revoke all on schema employment_private from public, anon, authenticated, service_role;

create table public.employment_applications (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  submission_id uuid not null unique,
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'new' check (status in ('new','reviewing','interview','offered','hired','rejected','archived')),
  applicant jsonb not null check (jsonb_typeof(applicant) = 'object' and coalesce(char_length(applicant->>'full_name') between 1 and 150, false)),
  availability jsonb not null check (jsonb_typeof(availability) = 'object'),
  education jsonb not null check (jsonb_typeof(education) = 'object'),
  employment_history jsonb not null check (jsonb_typeof(employment_history) = 'array' and jsonb_array_length(employment_history) <= 3),
  experience jsonb not null check (jsonb_typeof(experience) = 'object'),
  transportation jsonb not null check (jsonb_typeof(transportation) = 'object'),
  applicant_references jsonb not null check (jsonb_typeof(applicant_references) = 'array' and jsonb_array_length(applicant_references) = 2),
  certification jsonb not null check (jsonb_typeof(certification) = 'object' and coalesce(certification->>'accepted' = 'true' and certification->>'version' = 'employment-pdf-2026-10-v1', false))
);
create index employment_applications_status_date on public.employment_applications (status, submitted_at desc);
alter table public.employment_applications enable row level security;
revoke all on public.employment_applications from public, anon, authenticated, service_role;
-- No public policies or direct table grants. Future staff access requires a separate migration.

create table employment_private.submission_limits (
  bucket text primary key check (bucket ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table employment_private.submission_limits enable row level security;
revoke all on employment_private.submission_limits from public, anon, authenticated, service_role;

create function public.submit_employment_application(p_submission_id uuid, p_payload jsonb, p_digest text, p_bucket text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; saved_digest text; attempt_count integer;
begin
  if p_submission_id is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$'
     or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 50000 then
    raise exception 'Invalid application request';
  end if;
  -- Serialize retries for the same signed submission ID. No duplicate records on retry.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_submission_id::text, 0));
  select id, payload_digest into saved_id, saved_digest from public.employment_applications where submission_id = p_submission_id;
  if saved_id is not null then
    if saved_digest <> p_digest then raise exception 'Application already submitted with different contents'; end if;
    return saved_id;
  end if;
  -- Atomic across server instances: at most five saved applications per source per hour.
  -- Bucket is a server-keyed hash; raw IP addresses are never stored.
  delete from employment_private.submission_limits where window_start < now() - interval '24 hours';
  insert into employment_private.submission_limits as limits (bucket, window_start, attempts)
    values (p_bucket, now(), 1)
    on conflict (bucket) do update set
      attempts = case when limits.window_start <= now() - interval '1 hour' then 1 else limits.attempts + 1 end,
      window_start = case when limits.window_start <= now() - interval '1 hour' then now() else limits.window_start end
    returning attempts into attempt_count;
  if attempt_count > 5 then raise exception 'Application submission limit reached'; end if;
  insert into public.employment_applications
    (submission_id, payload_digest, applicant, availability, education, employment_history, experience, transportation, applicant_references, certification)
    values (p_submission_id, p_digest, p_payload->'applicant', p_payload->'availability', p_payload->'education', p_payload->'employment_history', p_payload->'experience', p_payload->'transportation', p_payload->'references', p_payload->'certification')
    returning id into saved_id;
  return saved_id;
end;
$$;
revoke all on function public.submit_employment_application(uuid,jsonb,text,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_employment_application(uuid,jsonb,text,text) to service_role;

create function public.employment_submission_ready() returns integer
language sql stable security definer set search_path = '' as $$
  select case when pg_catalog.to_regclass('public.employment_applications') is not null
    and pg_catalog.to_regclass('employment_private.submission_limits') is not null
    and pg_catalog.to_regprocedure('public.submit_employment_application(uuid,jsonb,text,text)') is not null then 1 else 0 end;
$$;
revoke all on function public.employment_submission_ready() from public, anon, authenticated, service_role;
grant execute on function public.employment_submission_ready() to service_role;
commit;
