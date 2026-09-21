-- PRJ-026 Supabase security/persistence overlay v0.32
-- Apply only AFTER api/postgres_schema_v0.26.sql in an isolated PRJ-026 Supabase sandbox.
-- This migration intentionally does not grant any access to anon.

begin;

insert into schema_meta(key,value) values('schema_version','7')
on conflict(key) do update set value=excluded.value;
insert into schema_meta(key,value) values('security_profile','supabase_rls_v0.32')
on conflict(key) do update set value=excluded.value;

alter table review_queue_items add column if not exists version_token text;

create index if not exists idx_review_queue_case_status on review_queue_items(case_id,queue_status);
create index if not exists idx_review_events_case_reviewed_at on review_events(case_id,reviewed_at desc);
create index if not exists idx_feedback_events_case_created_at on feedback_events(case_id,created_at desc);
create index if not exists idx_review_sessions_created_by_status on review_sessions(created_by,status);
create index if not exists idx_review_session_items_session_action on review_session_items(session_id,action);

-- Explicit privilege baseline. Never expose these PRJ-026 tables to signed-out callers.
revoke all on table cases,case_aliases,review_queue_items,review_events,feedback_events,rules,publish_gates,rule_proposals,auth_audit,review_sessions,review_session_items from anon,authenticated;

grant select on table cases,case_aliases,review_queue_items,review_events,feedback_events,rules,publish_gates,rule_proposals,auth_audit,review_sessions,review_session_items to authenticated;
grant insert,update on table review_sessions to authenticated;
grant insert,update,delete on table review_session_items to authenticated;

-- service_role / secret-key access is backend-only and is never granted to browser code by this migration.

alter table cases enable row level security;
alter table case_aliases enable row level security;
alter table review_queue_items enable row level security;
alter table review_events enable row level security;
alter table feedback_events enable row level security;
alter table rules enable row level security;
alter table publish_gates enable row level security;
alter table rule_proposals enable row level security;
alter table auth_audit enable row level security;
alter table review_sessions enable row level security;
alter table review_session_items enable row level security;

-- Idempotent policy reset.
drop policy if exists prj026_cases_read on cases;
drop policy if exists prj026_aliases_read on case_aliases;
drop policy if exists prj026_queue_read on review_queue_items;
drop policy if exists prj026_events_read on review_events;
drop policy if exists prj026_feedback_read on feedback_events;
drop policy if exists prj026_rules_read on rules;
drop policy if exists prj026_publish_read on publish_gates;
drop policy if exists prj026_rule_proposals_read on rule_proposals;
drop policy if exists prj026_auth_audit_admin_read on auth_audit;
drop policy if exists prj026_sessions_read on review_sessions;
drop policy if exists prj026_sessions_insert on review_sessions;
drop policy if exists prj026_sessions_update on review_sessions;
drop policy if exists prj026_session_items_read on review_session_items;
drop policy if exists prj026_session_items_insert on review_session_items;
drop policy if exists prj026_session_items_update on review_session_items;
drop policy if exists prj026_session_items_delete on review_session_items;

-- Authorization comes ONLY from server-controlled app_metadata.prj026_role.
-- raw_user_meta_data / user_metadata is deliberately not used.
create policy prj026_cases_read on cases for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_aliases_read on case_aliases for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_queue_read on review_queue_items for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_events_read on review_events for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_feedback_read on feedback_events for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_rules_read on rules for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_publish_read on publish_gates for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_rule_proposals_read on rule_proposals for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN'));
create policy prj026_auth_audit_admin_read on auth_audit for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) = 'ADMIN');

create policy prj026_sessions_read on review_sessions for select to authenticated
using (upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN'));
create policy prj026_sessions_insert on review_sessions for insert to authenticated
with check (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and (select auth.uid()) is not null
  and created_by=(select auth.uid())::text
  and status='DRAFT'
);
create policy prj026_sessions_update on review_sessions for update to authenticated
using (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and status not in ('COMMITTED','CANCELLED')
  and (created_by=(select auth.uid())::text or upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),''))='ADMIN')
)
with check (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and created_by=(select auth.uid())::text
  and status in ('DRAFT','READY')
);

create policy prj026_session_items_read on review_session_items for select to authenticated
using (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('VIEWER','REVIEWER','ADMIN')
  and exists (select 1 from review_sessions s where s.session_id=review_session_items.session_id)
);
create policy prj026_session_items_insert on review_session_items for insert to authenticated
with check (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and exists (
    select 1 from review_sessions s
    where s.session_id=review_session_items.session_id
      and s.status in ('DRAFT','READY')
      and (s.created_by=(select auth.uid())::text or upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),''))='ADMIN')
  )
);
create policy prj026_session_items_update on review_session_items for update to authenticated
using (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and exists (
    select 1 from review_sessions s
    where s.session_id=review_session_items.session_id
      and s.status in ('DRAFT','READY')
      and (s.created_by=(select auth.uid())::text or upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),''))='ADMIN')
  )
)
with check (
  exists (
    select 1 from review_sessions s
    where s.session_id=review_session_items.session_id
      and s.status in ('DRAFT','READY')
      and (s.created_by=(select auth.uid())::text or upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),''))='ADMIN')
  )
);
create policy prj026_session_items_delete on review_session_items for delete to authenticated
using (
  upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),'')) in ('REVIEWER','ADMIN')
  and exists (
    select 1 from review_sessions s
    where s.session_id=review_session_items.session_id
      and s.status in ('DRAFT','READY')
      and (s.created_by=(select auth.uid())::text or upper(coalesce((select auth.jwt()->'app_metadata'->>'prj026_role'),''))='ADMIN')
  )
);

-- Atomic commit is the one privileged mutation path for queue resolution + review event creation.
-- The function is SECURITY DEFINER only because direct writes to queue/events are intentionally revoked.
create schema if not exists prj026_private;
revoke all on schema prj026_private from public,anon,authenticated;
grant usage on schema prj026_private to authenticated;

create or replace function prj026_private.commit_review_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, prj026_private
as $$
declare
  v_uid uuid;
  v_role text;
  v_session review_sessions%rowtype;
  d review_session_items%rowtype;
  q review_queue_items%rowtype;
  v_event_id text;
  v_previous jsonb;
  v_new jsonb;
  v_count integer := 0;
begin
  v_uid := auth.uid();
  v_role := upper(coalesce(auth.jwt()->'app_metadata'->>'prj026_role',''));
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if v_role not in ('REVIEWER','ADMIN') then
    raise exception 'INSUFFICIENT_ROLE' using errcode='42501';
  end if;

  select * into v_session from review_sessions where session_id=p_session_id for update;
  if not found then raise exception 'REVIEW_SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'READY' then raise exception 'REVIEW_SESSION_NOT_READY'; end if;
  if coalesce(v_session.validation_json->>'status','') <> 'READY_TO_COMMIT' then
    raise exception 'REVIEW_SESSION_VALIDATION_REQUIRED';
  end if;
  if v_role <> 'ADMIN' and v_session.created_by <> v_uid::text then
    raise exception 'REVIEW_SESSION_OWNER_REQUIRED' using errcode='42501';
  end if;

  if not exists(select 1 from review_session_items where session_id=p_session_id and action<>'PENDING') then
    raise exception 'EMPTY_BATCH';
  end if;

  for d in
    select * from review_session_items
    where session_id=p_session_id and action<>'PENDING'
    order by review_item_id
  loop
    if d.action not in ('APPROVE','CORRECT','CONFIRM_AMBIGUITY','REJECT') then
      raise exception 'INVALID_ACTION:%', d.review_item_id;
    end if;

    select * into q from review_queue_items where review_item_id=d.review_item_id for update;
    if not found then raise exception 'UNKNOWN_REVIEW_ITEM_ID:%', d.review_item_id; end if;
    if q.queue_status <> 'PENDING' then raise exception 'REVIEW_ITEM_ALREADY_RESOLVED:%', d.review_item_id; end if;
    if q.version_token is null or q.version_token <> d.version_token then
      raise exception 'STALE_REVIEW_ITEM_VERSION:%', d.review_item_id;
    end if;
    if d.action='CORRECT' and (d.new_value_json is null or d.new_value_json='null'::jsonb) then
      raise exception 'CORRECT_REQUIRES_NEW_VALUE:%', d.review_item_id;
    end if;
    if d.action='CONFIRM_AMBIGUITY' and coalesce(q.payload_json->>'extraction_status','') <> 'AMBIGUOUS' then
      raise exception 'CONFIRM_AMBIGUITY_REQUIRES_AMBIGUOUS_STATUS:%', d.review_item_id;
    end if;

    v_previous := jsonb_build_object(
      'normalized_value',q.payload_json->'normalized_value',
      'unit',q.payload_json->'unit',
      'extraction_status',q.payload_json->'extraction_status'
    );
    if d.action in ('APPROVE','CONFIRM_AMBIGUITY') then v_new := v_previous;
    else v_new := d.new_value_json; end if;

    update review_queue_items set queue_status='RESOLVED' where review_item_id=q.review_item_id and queue_status='PENDING';
    if not found then raise exception 'REVIEW_ITEM_ALREADY_RESOLVED:%', d.review_item_id; end if;

    v_event_id := 'RVE-' || substr(md5(p_session_id || '|' || q.review_item_id || '|' || clock_timestamp()::text),1,16);
    insert into review_events(
      event_id,case_id,review_item_id,target_type,target_id,action,
      previous_value_json,new_value_json,reviewed_by,reviewed_at,note,
      feedback_id,rule_id,raw_extraction_sha256,canonical_field_sha256
    ) values (
      v_event_id,q.case_id,q.review_item_id,
      coalesce(q.payload_json->>'target_type','field'),
      coalesce(q.payload_json->>'target_id',q.payload_json->>'field_key',q.review_item_id),
      d.action,v_previous,v_new,v_uid::text,now(),d.note,
      d.feedback_id,d.rule_id,q.raw_extraction_sha256,q.canonical_field_sha256
    );
    v_count := v_count + 1;
  end loop;

  update review_sessions
  set status='COMMITTED',committed_at=now(),updated_at=now(),
      validation_json=coalesce(validation_json,'{}'::jsonb) || jsonb_build_object('committed_count',v_count,'committed_by',v_uid::text)
  where session_id=p_session_id;

  insert into auth_audit(ts,actor_id,role,action,target,result)
  values(now(),v_uid::text,v_role,'COMMIT_REVIEW_SESSION',p_session_id,'COMMITTED');

  return jsonb_build_object('status','COMMITTED','session_id',p_session_id,'committed_count',v_count);
end;
$$;

revoke all on function prj026_private.commit_review_session(text) from public,anon;
grant execute on function prj026_private.commit_review_session(text) to authenticated;

create or replace function public.prj026_commit_review_session(p_session_id text)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, prj026_private
as $$
  select prj026_private.commit_review_session(p_session_id)
$$;
revoke all on function public.prj026_commit_review_session(text) from public,anon;
grant execute on function public.prj026_commit_review_session(text) to authenticated;

commit;
