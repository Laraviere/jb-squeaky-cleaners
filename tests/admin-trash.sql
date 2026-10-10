-- Synthetic, transaction-scoped regression fixtures. Always rolls back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values
('61616161-6161-4161-8161-616161616161'),('62626262-6262-4262-8262-626262626262'),('63636363-6363-4363-8363-636363636363'),('67676767-6767-4767-8767-676767676767'),('68686868-6868-4868-8868-686868686868');
insert into public.staff_memberships(user_id,role) values
('61616161-6161-4161-8161-616161616161','administrator'),('62626262-6262-4262-8262-626262626262','manager'),('67676767-6767-4767-8767-676767676767','employee'),('68686868-6868-4868-8868-686868686868','administrator');
update public.staff_memberships set status='suspended' where user_id='68686868-6868-4868-8868-686868686868';
-- Even accidentally assigned deletion permissions must not authorize a manager.
insert into public.staff_role_permissions select 'manager', name from public.staff_permissions where name like 'quotes.%' and name in ('quotes.delete','quotes.trash','quotes.purge','quotes.hold');
insert into public.quote_requests(id,name,phone,email,service_type,location,frequency,property_size,preferred_timing,details)
values('64646464-6464-4464-8464-646464646464','Synthetic Trash Test','2765550144','trash-fixture@example.com','Residential','Galax, VA','One-time','Test size','Flexible','Synthetic fixture only');
insert into public.employment_applications(id,submission_id,payload_digest,applicant,availability,education,employment_history,experience,transportation,applicant_references,certification)
values('65656565-6565-4565-8565-656565656565','66666666-6666-4666-8666-666666666666',repeat('a',64),'{"full_name":"Synthetic Trash Test","email":"trash-fixture@example.com","position":"Synthetic"}','{}','{}','[]','{}','{}','[{},{}]','{"accepted":true,"version":"employment-pdf-2026-10-v1"}');
create temp table originals as select 'quotes' as kind,md5(to_jsonb(q)::text) as digest from public.quote_requests q where id='64646464-6464-4464-8464-646464646464'
union all select 'applications',md5(to_jsonb(a)::text) from public.employment_applications a where id='65656565-6565-4565-8565-656565656565';
select set_config('request.jwt.claims','{"sub":"61616161-6161-4161-8161-616161616161","aal":"aal2","role":"authenticated"}',true);
set local role authenticated;
select public.admin_set_status('quotes','64646464-6464-4464-8464-646464646464','quote_sent');
select public.admin_set_status('applications','65656565-6565-4565-8565-656565656565','interview');
select public.admin_add_note('quotes','64646464-6464-4464-8464-646464646464','Synthetic private note');
select public.admin_add_note('applications','65656565-6565-4565-8565-656565656565','Synthetic private note');
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','delete','MOVE TO TRASH');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','delete','MOVE TO TRASH');
do $$ begin
 if exists(select 1 from public.admin_quotes where id='64646464-6464-4464-8464-646464646464') or exists(select 1 from public.admin_applications where id='65656565-6565-4565-8565-656565656565') then raise exception 'Active views include Trash'; end if;
 if (select count(*) from public.admin_trash_quotes where id='64646464-6464-4464-8464-646464646464')<>1 then raise exception 'Trash quote missing'; end if;
 if (public.admin_list_trash('applications','Synthetic Trash','interview')->>'total')::int<>1 then raise exception 'Trash search/filter failed'; end if;
 if exists(select 1 from public.record_lifecycle where record_id in ('64646464-6464-4464-8464-646464646464','65656565-6565-4565-8565-656565656565') and (deleted_at is null or deleted_by<>auth.uid())) then raise exception 'Deletion attribution failed'; end if;
 if (select count(*) from public.staff_notes where quote_id='64646464-6464-4464-8464-646464646464' or application_id='65656565-6565-4565-8565-656565656565')<>2 then raise exception 'Soft deletion lost notes'; end if;
 begin perform public.admin_set_status('quotes','64646464-6464-4464-8464-646464646464','won'); raise exception 'Trash mutation permitted'; exception when raise_exception then if sqlerrm <> 'Restore the record before changing it' then raise; end if; end;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','purge',null); raise exception 'Null confirmation permitted'; exception when raise_exception then if sqlerrm <> 'Confirmation required' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"62626262-6262-4262-8262-626262626262","aal":"aal2","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.quote_requests where id='64646464-6464-4464-8464-646464646464') or exists(select 1 from public.employment_applications where id='65656565-6565-4565-8565-656565656565') or exists(select 1 from public.staff_notes where quote_id='64646464-6464-4464-8464-646464646464') then raise exception 'Manager can read Trash'; end if;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','restore','RESTORE'); raise exception 'Manager restored'; exception when insufficient_privilege then null; end;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','delete','MOVE TO TRASH'); raise exception 'Manager deleted'; exception when insufficient_privilege then null; end;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','purge','PERMANENTLY DELETE'); raise exception 'Manager purged'; exception when insufficient_privilege then null; end;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','release_hold','RELEASE HOLD'); raise exception 'Manager altered hold'; exception when insufficient_privilege then null; end;
 begin perform public.admin_list_trash('quotes'); raise exception 'Manager lists Trash'; exception when insufficient_privilege then null; end;
 begin delete from public.quote_requests where id='64646464-6464-4464-8464-646464646464'; raise exception 'Direct deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"61616161-6161-4161-8161-616161616161","aal":"aal1","role":"authenticated"}',true);
do $$ begin
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','purge','PERMANENTLY DELETE'); raise exception 'MFA bypass allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"63636363-6363-4363-8363-636363636363","aal":"aal2","role":"authenticated"}',true);
do $$ begin
 if public.has_record_admin_permission('quotes','delete') then raise exception 'Customer authorized'; end if;
 begin perform public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','delete','MOVE TO TRASH'); raise exception 'Customer deleted'; exception when insufficient_privilege then null; end;
end $$;
do $$ declare uid text; begin
 for uid in select * from (values ('67676767-6767-4767-8767-676767676767'),('68686868-6868-4868-8868-686868686868')) ids loop
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'aal','aal2','role','authenticated')::text,true);
 begin perform public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','purge','PERMANENTLY DELETE'); raise exception 'Employee/suspended deletion permitted'; exception when insufficient_privilege then null; end;
 end loop;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','delete','MOVE TO TRASH'); raise exception 'Anonymous deletion allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.admin_trash_quotes; raise exception 'Anonymous Trash allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"61616161-6161-4161-8161-616161616161","aal":"aal2","role":"authenticated"}',true);
set local role authenticated;
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','restore','RESTORE');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','restore','RESTORE');
do $$ begin
 if (select workflow_status from public.admin_quotes where id='64646464-6464-4464-8464-646464646464')<>'quote_sent' or (select workflow_status from public.admin_applications where id='65656565-6565-4565-8565-656565656565')<>'interview' then raise exception 'Restore lost status'; end if;
 if (public.admin_dashboard()->>'quotes')::bigint<>(select count(*) from public.admin_quotes) then raise exception 'Dashboard count mismatch'; end if;
 begin perform public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','purge','PERMANENTLY DELETE'); raise exception 'Active purge allowed'; exception when raise_exception then if sqlerrm <> 'Move to Trash first' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select digest from originals where kind='quotes')<>(select md5(to_jsonb(q)::text) from public.quote_requests q where id='64646464-6464-4464-8464-646464646464') or (select digest from originals where kind='applications')<>(select md5(to_jsonb(a)::text) from public.employment_applications a where id='65656565-6565-4565-8565-656565656565') then raise exception 'Original changed'; end if;
end $$;
set local role authenticated;
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','hold','PLACE HOLD');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','hold','PLACE HOLD');
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','delete','MOVE TO TRASH');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','delete','MOVE TO TRASH');
do $$ declare k text; rid uuid; begin
 for k,rid in select * from (values ('quotes','64646464-6464-4464-8464-646464646464'::uuid),('applications','65656565-6565-4565-8565-656565656565'::uuid)) r loop
 begin perform public.admin_record_lifecycle(k,rid,'purge','PERMANENTLY DELETE'); raise exception 'Held record purged'; exception when raise_exception then if sqlerrm <> 'Legal hold prevents permanent deletion' then raise; end if; end;
 end loop;
end $$;
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','release_hold','RELEASE HOLD');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','release_hold','RELEASE HOLD');
select public.admin_record_lifecycle('quotes','64646464-6464-4464-8464-646464646464','purge','PERMANENTLY DELETE');
select public.admin_record_lifecycle('applications','65656565-6565-4565-8565-656565656565','purge','PERMANENTLY DELETE');
do $$ begin
 if (select count(*) from public.record_deletion_receipts where record_id in ('64646464-6464-4464-8464-646464646464','65656565-6565-4565-8565-656565656565') and actor_id=auth.uid() and retain_until>=deleted_at+interval '24 months')<>2 then raise exception 'Missing retention receipts'; end if;
 begin delete from public.record_deletion_receipts; raise exception 'Receipt deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.quote_requests where id='64646464-6464-4464-8464-646464646464') or exists(select 1 from public.employment_applications where id='65656565-6565-4565-8565-656565656565') or exists(select 1 from public.staff_notes where quote_id='64646464-6464-4464-8464-646464646464' or application_id='65656565-6565-4565-8565-656565656565') or exists(select 1 from public.staff_audit_events where quote_id='64646464-6464-4464-8464-646464646464' or application_id='65656565-6565-4565-8565-656565656565') or exists(select 1 from public.record_lifecycle where record_id in ('64646464-6464-4464-8464-646464646464','65656565-6565-4565-8565-656565656565')) then raise exception 'Purge left private data'; end if;
 begin perform public.submit_employment_application('66666666-6666-4666-8666-666666666666','{}',repeat('a',64),repeat('b',64)); raise exception 'Purged retry recreated'; exception when raise_exception then if sqlerrm <> 'Application no longer available' then raise; end if; end;
end $$;
rollback;
