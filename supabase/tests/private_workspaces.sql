-- Run the entire script. All synthetic identities and records are rolled back.
-- No email, password, refresh token or usable Auth session is created.
begin;
select set_config('catering.verify_user_a',gen_random_uuid()::text,true);
select set_config('catering.verify_user_b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous)
values (current_setting('catering.verify_user_a')::uuid,'authenticated','authenticated',false),
       (current_setting('catering.verify_user_b')::uuid,'authenticated','authenticated',false);

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('catering.verify_user_a'),true);
insert into public.catering_workspaces(user_id) values(auth.uid());
do $$
declare affected bigint;
begin
  if (select count(*) from public.catering_workspaces) <> 1 then raise exception 'A must see exactly its own workspace'; end if;
  if (select jsonb_array_length(data->'orders') from public.catering_workspaces) <> 0 then raise exception 'A must start empty'; end if;
  begin
    insert into public.catering_workspaces(user_id) values(current_setting('catering.verify_user_b')::uuid);
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.catering_workspaces
    set data=jsonb_set(data,'{settings,businessName}','"RLS verification account A"'::jsonb)
    where user_id=auth.uid() and revision=0;
  get diagnostics affected=row_count;
  if affected <> 1 or (select revision from public.catering_workspaces) <> 1 then raise exception 'Owner save/revision failed'; end if;
  update public.catering_workspaces set data=data where user_id=auth.uid() and revision=0;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Stale revision overwrote records'; end if;
  begin
    update public.catering_workspaces set revision=99 where user_id=auth.uid();
    raise exception 'Client revision update was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.catering_workspaces set user_id=current_setting('catering.verify_user_b')::uuid;
    raise exception 'Client ownership update was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.catering_workspaces;
    raise exception 'Client workspace deletion was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('catering.verify_user_b'),true);
do $$
declare affected bigint;
begin
  if (select count(*) from public.catering_workspaces) <> 0 then raise exception 'B could see A'; end if;
  insert into public.catering_workspaces(user_id) values(auth.uid());
  if (select data->'settings'->>'businessName' from public.catering_workspaces) = 'RLS verification account A' then raise exception 'B loaded A data'; end if;
  update public.catering_workspaces set data=data where user_id=current_setting('catering.verify_user_a')::uuid;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'B could update A'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('catering.verify_user_a'),true);
do $$
begin
  if (select count(*) from public.catering_workspaces) <> 1
     or (select data->'settings'->>'businessName' from public.catering_workspaces) <> 'RLS verification account A'
  then raise exception 'A did not recover its own saved records'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
  if (select count(*) from public.catering_workspaces) <> 0 then raise exception 'Missing identity could read records'; end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform user_id from public.catering_workspaces;
    raise exception 'Anonymous read was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
select 'PASS: owner access, account isolation, revision conflicts and anonymous denial; all fixtures rolled back' as result;
