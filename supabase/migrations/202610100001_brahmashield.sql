-- Additive MVP migration. Run with the Supabase SQL editor or database-owner connection.
-- Application tables/functions are deliberately server-only; browser keys get no access.
begin;
create table if not exists public.bs_state (
  id integer primary key check (id=1), version bigint not null default 0, payload jsonb not null
);
create table if not exists public.bs_submissions (
  client_id uuid primary key, incident_id text not null, owner_hash text not null, created_at timestamptz not null default now()
);
create table if not exists public.bs_jobs (
  id uuid primary key, incident_id text not null, report_id uuid not null,
  status text not null check (status in ('held','pending','processing','complete','failed')),
  attempts integer not null default 0, lease uuid, lease_until timestamptz, created_at timestamptz not null default now()
);
create index if not exists bs_jobs_pending on public.bs_jobs (status,created_at);
create table if not exists public.bs_responder_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.bs_state enable row level security;
alter table public.bs_submissions enable row level security;
alter table public.bs_jobs enable row level security;
alter table public.bs_responder_memberships enable row level security;
revoke all on public.bs_state,public.bs_submissions,public.bs_jobs,public.bs_responder_memberships from public,anon,authenticated;
grant all on public.bs_state,public.bs_submissions,public.bs_jobs,public.bs_responder_memberships to service_role;

create or replace function public.bs_snapshot(initial_state jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  insert into public.bs_state(id,payload) values (1,initial_state) on conflict do nothing;
  select jsonb_build_object('version',s.version,'payload',s.payload) into result from public.bs_state s where id=1;
  return result;
end $$;

create or replace function public.bs_submission(submission_id uuid,owner_hash text) returns text
language plpgsql security invoker set search_path='' as $$
declare existing public.bs_submissions%rowtype;
begin
  select * into existing from public.bs_submissions s where s.client_id=submission_id;
  if not found then return null; end if;
  if existing.owner_hash <> owner_hash then raise exception 'Submission belongs to another device' using errcode='42501'; end if;
  return existing.incident_id;
end $$;

create or replace function public.bs_commit(
  expected_version bigint,next_state jsonb,submission jsonb default null,job jsonb default null,
  job_action jsonb default null,job_finish jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_version bigint; existing public.bs_submissions%rowtype;
begin
  select version into current_version from public.bs_state where id=1 for update;
  if submission is not null then
    select * into existing from public.bs_submissions where client_id=(submission->>'client_id')::uuid;
    if found then
      if existing.owner_hash <> submission->>'owner_hash' then raise exception 'Submission belongs to another device' using errcode='42501'; end if;
      return jsonb_build_object('duplicate',true,'incident_id',existing.incident_id);
    end if;
  end if;
  if current_version is null or current_version<>expected_version then
    raise exception 'Concurrent state update' using errcode='40001';
  end if;
  if job_finish is not null then
    update public.bs_jobs set status=job_finish->>'status',lease=null,lease_until=null
    where id=(job_finish->>'id')::uuid and lease=(job_finish->>'lease')::uuid and status='processing' and lease_until>now();
    if not found then raise exception 'Job lease expired' using errcode='55000'; end if;
  end if;
  update public.bs_state set payload=next_state,version=version+1 where id=1;
  if submission is not null then
    insert into public.bs_submissions(client_id,incident_id,owner_hash) values ((submission->>'client_id')::uuid,submission->>'incident_id',submission->>'owner_hash');
  end if;
  if job is not null then
    insert into public.bs_jobs(id,incident_id,report_id,status) values ((job->>'id')::uuid,job->>'incident_id',(job->>'report_id')::uuid,job->>'status');
  end if;
  if job_action->>'action' in ('review','verify') then
    update public.bs_jobs set status='pending' where incident_id=job_action->>'incident_id' and status='held';
  elsif job_action->>'action'='retry_ai' then
    update public.bs_jobs set status='pending',attempts=0,lease=null,lease_until=null where incident_id=job_action->>'incident_id' and status='failed';
  end if;
  return jsonb_build_object('duplicate',false);
end $$;

create or replace function public.bs_claim_job() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare claimed public.bs_jobs%rowtype;
begin
  select * into claimed from public.bs_jobs where status='pending' or (status='processing' and lease_until<now())
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.bs_jobs set status='processing',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '5 minutes' where id=claimed.id returning * into claimed;
  return jsonb_build_object('id',claimed.id,'incident_id',claimed.incident_id,'report_id',claimed.report_id,'lease',claimed.lease);
end $$;

revoke all on function public.bs_snapshot(jsonb),public.bs_submission(uuid,text),public.bs_commit(bigint,jsonb,jsonb,jsonb,jsonb,jsonb),public.bs_claim_job() from public,anon,authenticated;
grant execute on function public.bs_snapshot(jsonb),public.bs_submission(uuid,text),public.bs_commit(bigint,jsonb,jsonb,jsonb,jsonb,jsonb),public.bs_claim_job() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('bs-evidence','bs-evidence',false,1000000,array['image/jpeg','image/png']) on conflict(id) do nothing;
-- No client-facing storage policy is created. Evidence is served by the authenticated app route.
notify pgrst,'reload schema';
commit;
