-- English-only, service-role access. No changes to shared app_saves or mana-evo data.
create schema if not exists mee_private;
revoke all on schema mee_private from public, anon, authenticated;
grant usage on schema mee_private to service_role;
create table if not exists mee_private.live_buckets (
 user_id uuid not null,
 action text not null check (action in ('live-token','live-log')),
 hour_start timestamptz not null,
 count integer not null check (count >= 0),
 primary key(user_id,action,hour_start)
);
create table if not exists mee_private.live_leases (
 id uuid primary key,
 user_id uuid not null,
 expires_at timestamptz not null
);
create index if not exists mee_live_leases_user_expiry on mee_private.live_leases(user_id,expires_at);
alter table mee_private.live_buckets enable row level security;
alter table mee_private.live_leases enable row level security;
revoke all on mee_private.live_buckets,mee_private.live_leases from public,anon,authenticated;
grant select,insert,update,delete on mee_private.live_buckets,mee_private.live_leases to service_role;
create or replace function public.mee_live_guard(p_user_id uuid,p_action text,p_lease_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,mee_private as $$
declare v_hour timestamptz:=date_trunc('hour',now()); v_count integer; v_limit integer; v_lease uuid;
begin
 if p_user_id is null then return jsonb_build_object('ok',false,'code','auth'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,48173));
 delete from mee_private.live_leases where expires_at<=now();
 delete from mee_private.live_buckets where hour_start<v_hour-interval '2 hours';
 if p_action='live-release' then
  delete from mee_private.live_leases where id=p_lease_id and user_id=p_user_id;
  return jsonb_build_object('ok',true);
 end if;
 if p_action not in ('live-token','live-log') then return jsonb_build_object('ok',false,'code','bad_request');end if;
 if p_action='live-token' and (select count(*) from mee_private.live_leases where user_id=p_user_id)>=8 then
  return jsonb_build_object('ok',false,'code','concurrent_limit');
 end if;
 v_limit:=case when p_action='live-token' then 240 else 200 end;
 select count into v_count from mee_private.live_buckets where user_id=p_user_id and action=p_action and hour_start=v_hour;
 if coalesce(v_count,0)>=v_limit then return jsonb_build_object('ok',false,'code','rate_limited');end if;
 insert into mee_private.live_buckets(user_id,action,hour_start,count) values(p_user_id,p_action,v_hour,1)
 on conflict(user_id,action,hour_start) do update set count=mee_private.live_buckets.count+1;
 if p_action='live-token' then
  v_lease:=gen_random_uuid();
  insert into mee_private.live_leases(id,user_id,expires_at)values(v_lease,p_user_id,now()+interval '10 minutes');
  return jsonb_build_object('ok',true,'leaseId',v_lease);
 end if;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.mee_live_guard(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mee_live_guard(uuid,text,uuid) to service_role;
comment on function public.mee_live_guard(uuid,text,uuid) is 'English Live only: atomic durable hourly quotas and short-lived connection leases; service role only.';
