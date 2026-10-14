-- Ejecutar una vez en SQL Editor del proyecto mi-despensa.
-- Actualiza la reposición con +: devuelve el producto a la despensa y usa enteros.
-- No carga, elimina ni sobrescribe productos del inventario.
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
        v_quantity=least(100000,greatest(0,round((v_row.products->v_slot->>'quantity')::numeric)+v_delta));
        v_row.products=jsonb_set(v_row.products,array[v_slot::text,'quantity'],to_jsonb(v_quantity),false);
        if v_delta>0 then
          v_row.products=jsonb_set(v_row.products,array[v_slot::text,'manual'],'false'::jsonb,false);
          v_row.products=jsonb_set(v_row.products,array[v_slot::text,'shoppingOnly'],'false'::jsonb,true);
        end if;
        v_row.version=v_row.version+1;
      end if;
    end if;
  end loop;
  update public.mdespensa_inventory set products=v_row.products,version=v_row.version,updated_at=now()
    where household=p_household;
  return jsonb_build_object('version',v_row.version,'products',v_row.products);
end;
$$;

revoke all on function public.mdespensa_steps(text,jsonb) from public,anon,authenticated;
grant execute on function public.mdespensa_steps(text,jsonb) to service_role;
