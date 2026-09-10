-- ============================================================================
-- Fix: la parte dinámica no debe heredar el signo del saldo.
-- ----------------------------------------------------------------------------
-- `v_base * v_tasa` usaba el saldo tal cual, con su signo. Eso funciona
-- para una cuenta con saldo positivo (una comisión o un interés dan un
-- monto positivo, como corresponde), pero se rompe apenas la cuenta se usa
-- para llevar una deuda (saldo negativo): el mismo cálculo da un monto
-- negativo, y como `monto_fijo` suele ser 0 en una regla puramente
-- dinámica, el total termina siendo <= 0 y la ocurrencia se omite (ver
-- 0007) — en la práctica, el interés sobre una deuda nunca se generaba.
--
-- El resto del esquema ya trata todo monto como una magnitud positiva,
-- con `tipo` (ingreso/egreso) llevando la dirección aparte (así es como
-- funciona `movimientos.monto`, y así ya funcionaba `monto_fijo`). La
-- parte dinámica tiene que seguir la misma regla: la magnitud sale de
-- `abs(saldo) * tasa`, nunca del saldo con signo. `base_calculo_valor`
-- en el metadata sigue guardando el saldo real (con signo) para que se
-- pueda auditar en qué contexto se calculó, aunque el monto que se cobra
-- ya no dependa de ese signo.
-- ============================================================================
create or replace function public.materializar_movimientos_recurrentes(p_ledger_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_ultima_fecha date;
  v_periodo_desde date;
  v_fecha date;
  v_base numeric;
  v_tasa numeric;
  v_monto_fijo numeric(12, 2);
  v_monto_dinamico numeric(12, 2);
  v_monto_total numeric(12, 2);
  v_generados integer := 0;
begin
  if not public.is_ledger_member(p_ledger_id) then
    raise exception 'No sos miembro de este ledger';
  end if;

  for r in
    select * from public.movimientos_recurrentes
    where ledger_id = p_ledger_id and activo and fecha_inicio <= current_date
  loop
    select max((metadata ->> 'periodo_hasta')::date) into v_ultima_fecha
    from public.movimientos
    where ledger_id = p_ledger_id and (metadata ->> 'recurrente_id')::uuid = r.id;

    v_periodo_desde := coalesce(v_ultima_fecha, r.fecha_inicio);
    v_fecha := public.avanzar_fecha(v_periodo_desde, r.operacion_periodo);

    while v_fecha <= current_date and (r.fecha_fin is null or v_fecha <= r.fecha_fin) loop
      v_monto_fijo := r.monto_fijo;
      v_monto_dinamico := 0;
      v_base := null;
      v_tasa := null;

      if r.usa_dinamico then
        v_base := case r.base_calculo
          when 'inicio'   then public.saldo_en_fecha(r.cuenta_id, p_ledger_id, v_periodo_desde)
          when 'fin'      then public.saldo_en_fecha(r.cuenta_id, p_ledger_id, v_fecha)
          when 'promedio' then public.saldo_promedio(r.cuenta_id, p_ledger_id, v_periodo_desde, v_fecha)
        end;
        v_tasa := public.tasa_efectiva(r.porcentaje, r.tasa_periodo, v_fecha - v_periodo_desde);
        -- La magnitud sale del valor absoluto del saldo: una cuenta usada
        -- para llevar una deuda (saldo negativo) también tiene que acumular
        -- interés, con la misma dirección (tipo) que cualquier otra regla.
        v_monto_dinamico := public.redondear_monto(abs(v_base) * v_tasa, r.redondeo);
      end if;

      v_monto_total := v_monto_fijo + v_monto_dinamico;

      if v_monto_total > 0 then
        insert into public.movimientos (
          ledger_id, fecha, tipo, monto, concepto, entidad_id, cuenta_id, created_by, metadata
        ) values (
          p_ledger_id, v_fecha, r.tipo, v_monto_total, r.concepto, r.entidad_id, r.cuenta_id, r.created_by,
          jsonb_build_object(
            'recurrente_id', r.id,
            'periodo_desde', v_periodo_desde,
            'periodo_hasta', v_fecha,
            'componente_fijo', v_monto_fijo,
            'componente_dinamico', v_monto_dinamico,
            'base_calculo_valor', v_base,
            'tasa_efectiva', v_tasa,
            'calculado_en', now()
          )
        );
        v_generados := v_generados + 1;
      end if;

      v_periodo_desde := v_fecha;
      v_fecha := public.avanzar_fecha(v_fecha, r.operacion_periodo);
    end loop;
  end loop;

  return v_generados;
end;
$$;
