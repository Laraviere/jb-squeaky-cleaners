-- Local review only. Never apply to hosted Supabase without separate approval.
begin;
insert into public.staff_permissions(name)
select kind||'.'||operation from (values ('quotes'),('applications')) k(kind)
cross join (values ('delete'),('trash'),('purge'),('hold')) o(operation);
insert into public.staff_role_permissions(role,permission)
select 'administrator',name from public.staff_permissions where name in
('quotes.delete','quotes.trash','quotes.purge','quotes.hold','applications.delete','applications.trash','applications.purge','applications.hold');

create table public.record_lifecycle (
 record_kind text not null check(record_kind in ('quotes','applications')),
 record_id uuid not null,
 quote_id uuid generated always as (case when record_kind='quotes' then record_id end) stored references public.quote_requests(id),
 application_id uuid generated always as (case when record_kind='applications' then record_id end) stored references public.employment_applications(id),
 deleted_at timestamptz, deleted_by uuid references auth.users(id),
 legal_hold boolean not null default false,
 hold_changed_at timestamptz, hold_changed_by uuid references auth.users(id),
 primary key(record_kind,record_id),
 check((deleted_at is null)=(deleted_by is null))
);
create index record_lifecycle_deleted on public.record_lifecycle(record_kind,deleted_at desc) where deleted_at is not null;
create table public.record_deletion_receipts (
 id uuid primary key default gen_random_uuid(),
 record_kind text not null check(record_kind in ('quotes','applications')),
 record_id uuid not null, actor_id uuid not null,
 deleted_at timestamptz not null default now(),
 retain_until timestamptz not null default now()+interval '24 months',
 legal_hold boolean not null default false,
 unique(record_kind,record_id),
 check(retain_until >= deleted_at+interval '24 months')
);
-- Not applicant content: prevents a retry of a purged submission recreating it.
create table employment_private.deleted_submissions (
 submission_id uuid primary key, deleted_at timestamptz not null default now()
);
alter table public.record_lifecycle enable row level security;
alter table public.record_deletion_receipts enable row level security;
alter table employment_private.deleted_submissions enable row level security;
revoke all on public.record_lifecycle,public.record_deletion_receipts,employment_private.deleted_submissions from public,anon,authenticated,service_role;
grant select on public.record_lifecycle,public.record_deletion_receipts to authenticated;

create function public.has_record_admin_permission(kind text, operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select kind in ('quotes','applications') and operation in ('delete','trash','purge','hold')
 and public.has_staff_permission(kind||'.'||operation)
 and exists(select 1 from public.staff_memberships where user_id=auth.uid() and role='administrator' and status='active');
$$;
create function public.staff_record_visible(kind text, rid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select kind in ('quotes','applications') and public.has_staff_permission(kind||'.read') and
 (not exists(select 1 from public.record_lifecycle where record_kind=kind and record_id=rid and deleted_at is not null)
 or public.has_record_admin_permission(kind,'trash'));
$$;
revoke all on function public.has_record_admin_permission(text,text),public.staff_record_visible(text,uuid) from public,anon,service_role;
grant execute on function public.has_record_admin_permission(text,text),public.staff_record_visible(text,uuid) to authenticated;
create policy admin_lifecycle_read on public.record_lifecycle for select to authenticated using(public.has_record_admin_permission(record_kind,'trash'));
create policy admin_receipt_read on public.record_deletion_receipts for select to authenticated using(public.has_record_admin_permission(record_kind,'trash'));

drop policy staff_read_quotes on public.quote_requests;
create policy staff_read_quotes on public.quote_requests for select to authenticated using(public.staff_record_visible('quotes',id));
drop policy staff_read_applications on public.employment_applications;
create policy staff_read_applications on public.employment_applications for select to authenticated using(public.staff_record_visible('applications',id));
drop policy staff_read_quote_workflows on public.quote_workflows;
create policy staff_read_quote_workflows on public.quote_workflows for select to authenticated using(public.staff_record_visible('quotes',quote_id));
drop policy staff_read_application_workflows on public.application_workflows;
create policy staff_read_application_workflows on public.application_workflows for select to authenticated using(public.staff_record_visible('applications',application_id));
drop policy staff_read_notes on public.staff_notes;
create policy staff_read_notes on public.staff_notes for select to authenticated using((quote_id is not null and public.staff_record_visible('quotes',quote_id)) or (application_id is not null and public.staff_record_visible('applications',application_id)));
drop policy staff_read_audit on public.staff_audit_events;
create policy staff_read_audit on public.staff_audit_events for select to authenticated using((quote_id is not null and public.staff_record_visible('quotes',quote_id)) or (application_id is not null and public.staff_record_visible('applications',application_id)));

-- Views retain the same active columns and now exclude Trash. Invoker RLS remains enforced.
create or replace view public.admin_quotes with(security_invoker=true) as
 select q.*,coalesce(w.status,'new') as workflow_status from public.quote_requests q left join public.quote_workflows w on w.quote_id=q.id
 where not exists(select 1 from public.record_lifecycle l where l.record_kind='quotes' and l.record_id=q.id and l.deleted_at is not null);
create or replace view public.admin_applications with(security_invoker=true) as
 select a.id,a.submitted_at,a.applicant,a.availability,a.education,a.employment_history,a.experience,a.transportation,a.applicant_references,a.certification,
 coalesce(w.status,'new') as workflow_status from public.employment_applications a left join public.application_workflows w on w.application_id=a.id
 where not exists(select 1 from public.record_lifecycle l where l.record_kind='applications' and l.record_id=a.id and l.deleted_at is not null);
create view public.admin_trash_quotes with(security_invoker=true) as
 select q.*,coalesce(w.status,'new') as workflow_status,l.deleted_at,l.deleted_by,l.legal_hold
 from public.quote_requests q join public.record_lifecycle l on l.record_kind='quotes' and l.record_id=q.id
 left join public.quote_workflows w on w.quote_id=q.id where l.deleted_at is not null;
create view public.admin_trash_applications with(security_invoker=true) as
 select a.id,a.submitted_at,a.applicant,a.availability,a.education,a.employment_history,a.experience,a.transportation,a.applicant_references,a.certification,
 coalesce(w.status,'new') as workflow_status,l.deleted_at,l.deleted_by,l.legal_hold
 from public.employment_applications a join public.record_lifecycle l on l.record_kind='applications' and l.record_id=a.id
 left join public.application_workflows w on w.application_id=a.id where l.deleted_at is not null;
revoke all on public.admin_trash_quotes,public.admin_trash_applications from public,anon,authenticated,service_role;
grant select on public.admin_trash_quotes,public.admin_trash_applications to authenticated;

alter table public.staff_audit_events drop constraint staff_audit_events_action_check;
alter table public.staff_audit_events drop constraint staff_audit_events_check1;
alter table public.staff_audit_events add constraint staff_audit_events_action_check
 check(action in ('status_changed','note_added','deleted','restored','hold_set','hold_released'));
alter table public.staff_audit_events add constraint staff_audit_events_shape_check check(
 (action='status_changed' and new_status is not null and note_id is null) or
 (action='note_added' and old_status is null and new_status is null and note_id is not null) or
 (action in ('deleted','restored','hold_set','hold_released') and old_status is null and new_status is null and note_id is null));

create function public.admin_record_lifecycle(record_kind text,record_id uuid,operation text,confirmation text default '') returns void
language plpgsql security definer set search_path='' as $$
declare state public.record_lifecycle; submitted uuid;
 permission_operation text;
begin
 permission_operation:=case operation when 'delete' then 'delete' when 'restore' then 'delete' when 'purge' then 'purge' when 'hold' then 'hold' when 'release_hold' then 'hold' else null end;
 if permission_operation is null or not public.has_record_admin_permission(record_kind,permission_operation) then raise exception 'Access denied' using errcode='42501'; end if;
 -- Serialize lifecycle changes and existing workflow mutations for the same record.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_kind||record_id::text,0));
 if record_kind='quotes' then
  if not exists(select 1 from public.quote_requests where id=record_id) then raise exception 'Not found'; end if;
 else
  select submission_id into submitted from public.employment_applications where id=record_id;
  if submitted is null then raise exception 'Not found'; end if;
 end if;
 if confirmation is distinct from (case operation when 'delete' then 'MOVE TO TRASH' when 'restore' then 'RESTORE' when 'purge' then 'PERMANENTLY DELETE' when 'hold' then 'PLACE HOLD' else 'RELEASE HOLD' end) then raise exception 'Confirmation required'; end if;
 insert into public.record_lifecycle(record_kind,record_id) values(record_kind,record_id) on conflict do nothing;
 select * into state from public.record_lifecycle l where l.record_kind=admin_record_lifecycle.record_kind and l.record_id=admin_record_lifecycle.record_id for update;
 if operation='purge' then
  if state.deleted_at is null then raise exception 'Move to Trash first'; end if;
  if state.legal_hold then raise exception 'Legal hold prevents permanent deletion'; end if;
  if submitted is not null then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(submitted::text,0));
   insert into employment_private.deleted_submissions(submission_id) values(submitted) on conflict do nothing;
  end if;
  insert into public.record_deletion_receipts(record_kind,record_id,actor_id) values(record_kind,record_id,auth.uid());
  -- Explicit dependency order; no cascading deletes and no bulk API.
  delete from public.staff_audit_events where quote_id=state.quote_id or application_id=state.application_id;
  delete from public.staff_notes where quote_id=state.quote_id or application_id=state.application_id;
  delete from public.quote_workflows where quote_id=state.quote_id;
  delete from public.application_workflows where application_id=state.application_id;
  delete from public.record_lifecycle l where l.record_kind=admin_record_lifecycle.record_kind and l.record_id=admin_record_lifecycle.record_id;
  if record_kind='quotes' then delete from public.quote_requests where id=record_id;
  else delete from public.employment_applications where id=record_id; end if;
  return;
 elsif operation='delete' then
  if state.deleted_at is not null then return; end if;
  update public.record_lifecycle l set deleted_at=now(),deleted_by=auth.uid() where l.record_kind=admin_record_lifecycle.record_kind and l.record_id=admin_record_lifecycle.record_id;
 elsif operation='restore' then
  if state.deleted_at is null then return; end if;
  update public.record_lifecycle l set deleted_at=null,deleted_by=null where l.record_kind=admin_record_lifecycle.record_kind and l.record_id=admin_record_lifecycle.record_id;
 else
  if state.legal_hold=(operation='hold') then return; end if;
  update public.record_lifecycle l set legal_hold=(operation='hold'),hold_changed_at=now(),hold_changed_by=auth.uid() where l.record_kind=admin_record_lifecycle.record_kind and l.record_id=admin_record_lifecycle.record_id;
 end if;
 insert into public.staff_audit_events(quote_id,application_id,actor_id,action)
 values(state.quote_id,state.application_id,auth.uid(),case operation when 'delete' then 'deleted' when 'restore' then 'restored' when 'hold' then 'hold_set' else 'hold_released' end);
end; $$;
revoke all on function public.admin_record_lifecycle(text,uuid,text,text) from public,anon,service_role;
grant execute on function public.admin_record_lifecycle(text,uuid,text,text) to authenticated;

create function public.admin_list_trash(record_kind text,search_text text default '',status_filter text default '',oldest_first boolean default false,page_number integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare rows_json jsonb; total bigint;
begin
 if not public.has_record_admin_permission(record_kind,'trash') then raise exception 'Access denied' using errcode='42501'; end if;
 if page_number is null or page_number<1 or page_number>100000 or search_text is null or length(search_text)>200 then raise exception 'Invalid search'; end if;
 if record_kind='quotes' then
 select count(*) into total from public.admin_trash_quotes where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower(name||' '||email))>0;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows_json from (select id,created_at as submitted_at,name,email,service_type,workflow_status,deleted_at,deleted_by,legal_hold from public.admin_trash_quotes
 where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower(name||' '||email))>0
 order by case when oldest_first then deleted_at end asc,case when not oldest_first then deleted_at end desc,id limit 20 offset (page_number-1)*20) r;
 else
 select count(*) into total from public.admin_trash_applications where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower((applicant->>'full_name')||' '||(applicant->>'email')))>0;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows_json from (select id,submitted_at,applicant->>'full_name' as name,applicant->>'email' as email,applicant->>'position' as service_type,workflow_status,deleted_at,deleted_by,legal_hold from public.admin_trash_applications
 where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower((applicant->>'full_name')||' '||(applicant->>'email')))>0
 order by case when oldest_first then deleted_at end asc,case when not oldest_first then deleted_at end desc,id limit 20 offset (page_number-1)*20) r;
 end if;
 return jsonb_build_object('rows',rows_json,'total',total);
end; $$;
revoke all on function public.admin_list_trash(text,text,text,boolean,integer) from public,anon,service_role;
grant execute on function public.admin_list_trash(text,text,text,boolean,integer) to authenticated;

create or replace function public.admin_set_status(record_kind text, record_id uuid, next_status text) returns void language plpgsql security definer set search_path='' as $$
declare previous text; begin
 if record_kind not in ('quotes','applications') or not public.has_staff_permission(record_kind||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_kind||record_id::text,0));
 if exists(select 1 from public.record_lifecycle l where l.record_kind=admin_set_status.record_kind and l.record_id=admin_set_status.record_id and l.deleted_at is not null) then raise exception 'Restore the record before changing it'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_kind||record_id::text,0));
 if record_kind='quotes' then
 if not exists(select 1 from public.quote_requests where id=record_id) then raise exception 'Not found'; end if;
 if next_status not in ('new','contacted','quote_in_progress','quote_sent','won','lost') then raise exception 'Invalid status'; end if;
 select status into previous from public.quote_workflows where quote_id=record_id; previous:=coalesce(previous,'new');
 if previous=next_status then return; end if;
 insert into public.quote_workflows(quote_id,status) values(record_id,next_status) on conflict(quote_id) do update set status=excluded.status,updated_at=now();
 else
 if not exists(select 1 from public.employment_applications where id=record_id) then raise exception 'Not found'; end if;
 if next_status not in ('new','reviewing','interview','offered','hired','rejected','archived') then raise exception 'Invalid status'; end if;
 select status into previous from public.application_workflows where application_id=record_id; previous:=coalesce(previous,'new');
 if previous=next_status then return; end if;
 insert into public.application_workflows(application_id,status) values(record_id,next_status) on conflict(application_id) do update set status=excluded.status,updated_at=now();
 end if;
 insert into public.staff_audit_events(quote_id,application_id,actor_id,action,old_status,new_status) values(case when record_kind='quotes' then record_id end,case when record_kind='applications' then record_id end,auth.uid(),'status_changed',previous,next_status);
end; $$;

create or replace function public.admin_add_note(record_kind text, record_id uuid, note_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare note_id uuid; begin
 if record_kind not in ('quotes','applications') or not public.has_staff_permission(record_kind||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_kind||record_id::text,0));
 if exists(select 1 from public.record_lifecycle l where l.record_kind=admin_add_note.record_kind and l.record_id=admin_add_note.record_id and l.deleted_at is not null) then raise exception 'Restore the record before changing it'; end if;
 if note_body is null or length(btrim(note_body)) not between 1 and 4000 then raise exception 'Invalid note'; end if;
 insert into public.staff_notes(quote_id,application_id,actor_id,body) values(case when record_kind='quotes' then record_id end,case when record_kind='applications' then record_id end,auth.uid(),btrim(note_body)) returning id into note_id;
 insert into public.staff_audit_events(quote_id,application_id,actor_id,action,note_id) values(case when record_kind='quotes' then record_id end,case when record_kind='applications' then record_id end,auth.uid(),'note_added',note_id);
 return note_id;
end; $$;

create or replace function public.submit_employment_application(p_submission_id uuid, p_payload jsonb, p_digest text, p_bucket text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid; saved_digest text; attempt_count integer;
begin
  if p_submission_id is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$'
     or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 50000 then
    raise exception 'Invalid application request';
  end if;
  -- Serialize retries for the same signed submission ID. No duplicate records on retry.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_submission_id::text, 0));
  if exists(select 1 from employment_private.deleted_submissions where submission_id=p_submission_id) then raise exception 'Application no longer available'; end if;
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
create or replace function public.admin_dashboard() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.has_staff_permission('dashboard.read') then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
 'quotes',(select count(*) from public.admin_quotes), 'newQuotes',(select count(*) from public.admin_quotes where workflow_status='new'),
 'applications',(select count(*) from public.admin_applications), 'newApplications',(select count(*) from public.admin_applications where workflow_status='new'),
 'activity',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select id,quote_id,application_id,action,old_status,new_status,created_at from public.staff_audit_events e where not exists(select 1 from public.record_lifecycle l where l.deleted_at is not null and (l.quote_id=e.quote_id or l.application_id=e.application_id)) order by created_at desc,id limit 10) r)
 );
end; $$;
commit;
