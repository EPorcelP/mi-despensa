-- Ejecutar en el SQL Editor de TU proyecto Supabase.
-- No modifica tablas de MiGestor ni elimina inventarios existentes.
create table if not exists public.mdespensa_inventory (
  household text primary key,
  version bigint not null default 0,
  products jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  updated_at timestamptz not null default now()
);
create table if not exists public.mdespensa_mutations (
  household text not null,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (household, operation_id)
);
create table if not exists public.mdespensa_login_attempts (
  key_hash text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.mdespensa_inventory enable row level security;
alter table public.mdespensa_mutations enable row level security;
alter table public.mdespensa_login_attempts enable row level security;
revoke all on public.mdespensa_inventory, public.mdespensa_mutations, public.mdespensa_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.mdespensa_inventory, public.mdespensa_mutations, public.mdespensa_login_attempts to service_role;

create or replace function public.mdespensa_read(p_household text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.mdespensa_inventory%rowtype;
begin
  insert into public.mdespensa_inventory(household) values(p_household) on conflict do nothing;
  select * into strict v_row from public.mdespensa_inventory where household=p_household;
  return jsonb_build_object('version',v_row.version,'products',v_row.products);
end;
$$;

create or replace function public.mdespensa_put(p_household text, p_expected_version bigint, p_products jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.mdespensa_inventory%rowtype;
begin
  if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>1000 then
    raise exception 'Inventario no válido';
  end if;
  update public.mdespensa_inventory set products=p_products,version=version+1,updated_at=now()
    where household=p_household and version=p_expected_version returning * into v_row;
  if not found then return jsonb_build_object('conflict',true); end if;
  return jsonb_build_object('version',v_row.version,'products',v_row.products);
end;
$$;

create or replace function public.mdespensa_steps(p_household text, p_operations jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.mdespensa_inventory%rowtype;
  v_op jsonb;
  v_delta integer;
  v_slot integer;
  v_quantity numeric;
  v_inserted integer;
begin
  if jsonb_typeof(p_operations)<>'array' or jsonb_array_length(p_operations) not between 1 and 30 then
    raise exception 'Cambios no válidos';
  end if;
  -- Bloqueo de fila: dos dispositivos pueden pulsar + sin perder cambios.
  select * into strict v_row from public.mdespensa_inventory where household=p_household for update;
  for v_op in select value from jsonb_array_elements(p_operations) loop
    v_delta=(v_op->>'delta')::integer;
    if v_delta not in (-1,1) then raise exception 'Cambio no válido'; end if;
    insert into public.mdespensa_mutations(household,operation_id)
      values(p_household,(v_op->>'operationId')::uuid) on conflict do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      select (ordinality-1)::integer into v_slot
        from jsonb_array_elements(v_row.products) with ordinality
        where value->>'id'=v_op->>'productId' limit 1;
      if v_slot is not null then
        v_quantity=least(100000,greatest(0,round((v_row.products->v_slot->>'quantity')::numeric+v_delta,3)));
        v_row.products=jsonb_set(v_row.products,array[v_slot::text,'quantity'],to_jsonb(v_quantity),false);
        if v_delta>0 then v_row.products=jsonb_set(v_row.products,array[v_slot::text,'manual'],'false'::jsonb,false); end if;
        v_row.version=v_row.version+1;
      end if;
    end if;
  end loop;
  update public.mdespensa_inventory set products=v_row.products,version=v_row.version,updated_at=now()
    where household=p_household;
  return jsonb_build_object('version',v_row.version,'products',v_row.products);
end;
$$;

create or replace function public.mdespensa_login_attempt(p_key_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_attempts integer;
begin
  delete from public.mdespensa_login_attempts where started_at<now()-interval '24 hours';
  insert into public.mdespensa_login_attempts(key_hash) values(p_key_hash)
  on conflict(key_hash) do update set
    attempts=case when public.mdespensa_login_attempts.started_at<now()-interval '15 minutes' then 1 else public.mdespensa_login_attempts.attempts+1 end,
    started_at=case when public.mdespensa_login_attempts.started_at<now()-interval '15 minutes' then now() else public.mdespensa_login_attempts.started_at end
  returning attempts into v_attempts;
  return v_attempts<=10;
end;
$$;
-- Las funciones solo pueden ejecutarse desde el servidor de la aplicación.
revoke all on function public.mdespensa_read(text) from public,anon,authenticated;
revoke all on function public.mdespensa_put(text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.mdespensa_steps(text,jsonb) from public,anon,authenticated;
revoke all on function public.mdespensa_login_attempt(text) from public,anon,authenticated;
grant execute on function public.mdespensa_read(text) to service_role;
grant execute on function public.mdespensa_put(text,bigint,jsonb) to service_role;
grant execute on function public.mdespensa_steps(text,jsonb) to service_role;
grant execute on function public.mdespensa_login_attempt(text) to service_role;
