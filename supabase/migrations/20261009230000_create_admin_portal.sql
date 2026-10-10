-- Staff access is independent of customer Auth accounts. No original submission is changed.
begin;
create table public.staff_roles (name text primary key check (name in ('administrator','manager','employee')));
create table public.staff_permissions (name text primary key);
create table public.staff_role_permissions (
 role text references public.staff_roles(name), permission text references public.staff_permissions(name), primary key(role,permission)
);
create table public.staff_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null references public.staff_roles(name),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now()
);
insert into public.staff_roles values ('administrator'),('manager'),('employee');
insert into public.staff_permissions values ('dashboard.read'),('quotes.read'),('quotes.manage'),('applications.read'),('applications.manage'),('leads.export'),('staff.manage');
insert into public.staff_role_permissions select r.name,p.name from public.staff_roles r cross join public.staff_permissions p where r.name='administrator' or (r.name='manager' and p.name not in ('leads.export','staff.manage'));
create table public.quote_workflows (
 quote_id uuid primary key references public.quote_requests(id),
 status text not null default 'new' check(status in ('new','contacted','quote_in_progress','quote_sent','won','lost')),
 updated_at timestamptz not null default now()
);
create table public.application_workflows (
 application_id uuid primary key references public.employment_applications(id),
 status text not null default 'new' check(status in ('new','reviewing','interview','offered','hired','rejected','archived')),
 updated_at timestamptz not null default now()
);
create table public.staff_notes (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid references public.quote_requests(id),
 application_id uuid references public.employment_applications(id),
 body text not null check(length(btrim(body)) between 1 and 4000),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check (num_nonnulls(quote_id,application_id)=1)
);
create table public.staff_audit_events (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid references public.quote_requests(id), application_id uuid references public.employment_applications(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('status_changed','note_added')),
 old_status text, new_status text, note_id uuid references public.staff_notes(id),
 created_at timestamptz not null default now(),
 check(num_nonnulls(quote_id,application_id)=1),
 check((action='status_changed' and new_status is not null and note_id is null) or (action='note_added' and old_status is null and new_status is null and note_id is not null))
);
create index staff_notes_quote on public.staff_notes(quote_id,created_at desc);
create index staff_notes_application on public.staff_notes(application_id,created_at desc);
create index staff_audit_quote on public.staff_audit_events(quote_id,created_at desc);
create index staff_audit_application on public.staff_audit_events(application_id,created_at desc);
create index staff_audit_recent on public.staff_audit_events(created_at desc);

alter table public.staff_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.quote_workflows enable row level security;
alter table public.application_workflows enable row level security;
alter table public.staff_notes enable row level security;
alter table public.staff_audit_events enable row level security;
revoke all on public.staff_roles,public.staff_permissions,public.staff_role_permissions,public.staff_memberships,public.quote_workflows,public.application_workflows,public.staff_notes,public.staff_audit_events from public,anon,authenticated,service_role;

-- Only minimal own membership information is available before MFA enrollment.
create function public.admin_identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('role',m.role,'status',m.status) from public.staff_memberships m where m.user_id=(select auth.uid());
$$;
create function public.has_staff_permission(required_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt()->>'aal')='aal2',false) and exists(
 select 1 from public.staff_memberships m join public.staff_role_permissions p on p.role=m.role
 where m.user_id=(select auth.uid()) and m.status='active' and p.permission=required_permission
 );
$$;
revoke all on function public.admin_identity(),public.has_staff_permission(text) from public,anon,service_role;
grant execute on function public.admin_identity(),public.has_staff_permission(text) to authenticated;

-- Public submitter grants stay intact; staff get ONLY read access behind AAL2 + live membership.
grant select on public.quote_requests to authenticated;
grant select(id,submitted_at,applicant,availability,education,employment_history,experience,transportation,applicant_references,certification) on public.employment_applications to authenticated;
create policy staff_read_quotes on public.quote_requests for select to authenticated using(public.has_staff_permission('quotes.read'));
create policy staff_read_applications on public.employment_applications for select to authenticated using(public.has_staff_permission('applications.read'));
grant select on public.quote_workflows,public.application_workflows,public.staff_notes,public.staff_audit_events to authenticated;
create policy staff_read_quote_workflows on public.quote_workflows for select to authenticated using(public.has_staff_permission('quotes.read'));
create policy staff_read_application_workflows on public.application_workflows for select to authenticated using(public.has_staff_permission('applications.read'));
create policy staff_read_notes on public.staff_notes for select to authenticated using((quote_id is not null and public.has_staff_permission('quotes.read')) or (application_id is not null and public.has_staff_permission('applications.read')));
create policy staff_read_audit on public.staff_audit_events for select to authenticated using((quote_id is not null and public.has_staff_permission('quotes.read')) or (application_id is not null and public.has_staff_permission('applications.read')));

create view public.admin_quotes with(security_invoker=true) as
 select q.*,coalesce(w.status,'new') as workflow_status from public.quote_requests q left join public.quote_workflows w on w.quote_id=q.id;
create view public.admin_applications with(security_invoker=true) as
 select a.id,a.submitted_at,a.applicant,a.availability,a.education,a.employment_history,a.experience,a.transportation,a.applicant_references,a.certification,
 coalesce(w.status,'new') as workflow_status from public.employment_applications a left join public.application_workflows w on w.application_id=a.id;
revoke all on public.admin_quotes,public.admin_applications from public,anon,authenticated,service_role;
grant select on public.admin_quotes,public.admin_applications to authenticated;

-- Typed search parameters; literal substring matching avoids REST/filter injection.
create function public.admin_list_records(record_kind text, search_text text default '', status_filter text default '', oldest_first boolean default false, page_number integer default 1) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows_json jsonb; total bigint; begin
 if record_kind not in ('quotes','applications') or not public.has_staff_permission(record_kind||'.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if page_number < 1 or page_number > 100000 or length(search_text)>200 then raise exception 'Invalid search'; end if;
 if record_kind='quotes' then
 select count(*) into total from public.admin_quotes where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower(name||' '||email))>0;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows_json from (
 select id,created_at as submitted_at,name,email,service_type,workflow_status from public.admin_quotes
 where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower(name||' '||email))>0
 order by case when oldest_first then created_at end asc,case when not oldest_first then created_at end desc,id limit 20 offset (page_number-1)*20) r;
 else
 select count(*) into total from public.admin_applications where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower((applicant->>'full_name')||' '||(applicant->>'email')))>0;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows_json from (
 select id,submitted_at,applicant->>'full_name' as name,applicant->>'email' as email,applicant->>'position' as service_type,workflow_status from public.admin_applications
 where (status_filter='' or workflow_status=status_filter) and position(lower(search_text) in lower((applicant->>'full_name')||' '||(applicant->>'email')))>0
 order by case when oldest_first then submitted_at end asc,case when not oldest_first then submitted_at end desc,id limit 20 offset (page_number-1)*20) r;
 end if;
 return jsonb_build_object('rows',rows_json,'total',total);
end; $$;
create function public.admin_dashboard() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.has_staff_permission('dashboard.read') then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
 'quotes',(select count(*) from public.admin_quotes), 'newQuotes',(select count(*) from public.admin_quotes where workflow_status='new'),
 'applications',(select count(*) from public.admin_applications), 'newApplications',(select count(*) from public.admin_applications where workflow_status='new'),
 'activity',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select id,quote_id,application_id,action,old_status,new_status,created_at from public.staff_audit_events order by created_at desc,id limit 10) r)
 );
end; $$;

create function public.admin_set_status(record_kind text, record_id uuid, next_status text) returns void language plpgsql security definer set search_path='' as $$
declare previous text; begin
 if record_kind not in ('quotes','applications') or not public.has_staff_permission(record_kind||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
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
create function public.admin_add_note(record_kind text, record_id uuid, note_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare note_id uuid; begin
 if record_kind not in ('quotes','applications') or not public.has_staff_permission(record_kind||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if note_body is null or length(btrim(note_body)) not between 1 and 4000 then raise exception 'Invalid note'; end if;
 insert into public.staff_notes(quote_id,application_id,actor_id,body) values(case when record_kind='quotes' then record_id end,case when record_kind='applications' then record_id end,auth.uid(),btrim(note_body)) returning id into note_id;
 insert into public.staff_audit_events(quote_id,application_id,actor_id,action,note_id) values(case when record_kind='quotes' then record_id end,case when record_kind='applications' then record_id end,auth.uid(),'note_added',note_id);
 return note_id;
end; $$;
revoke all on function public.admin_list_records(text,text,text,boolean,integer),public.admin_dashboard(),public.admin_set_status(text,uuid,text),public.admin_add_note(text,uuid,text) from public,anon,service_role;
grant execute on function public.admin_list_records(text,text,text,boolean,integer),public.admin_dashboard(),public.admin_set_status(text,uuid,text),public.admin_add_note(text,uuid,text) to authenticated;
commit;
