-- ============================================================================
-- Fix: materializar_movimientos_recurrentes insertaba movimientos con
-- monto 0, lo cual viola `movimientos_monto_check` (monto > 0) porque
-- `movimientos` guarda siempre una magnitud positiva y la dirección va
-- en `tipo`, no en el signo.
--
-- El caso típico: la primera liquidación de una regla dinámica cuando
-- todavía no hay saldo acumulado en la cuenta (ej. una regla de interés
-- que arranca antes de que exista ningún depósito) calcula un
-- componente_dinamico de 0,00 y, si además no tiene parte fija, el total
-- de esa ocurrencia es 0 y el insert explota.
--
-- Ahora, cuando el total calculado para una ocurrencia es <= 0, se omite
-- esa ocurrencia (no se genera movimiento) en vez de insertar. El avance
-- de fecha sigue igual, así que no se reintenta esa misma ocurrencia en
-- este llamado; si en un llamado futuro corresponde recalcularla porque
-- entretanto se cargó saldo, `materializar_movimientos_recurrentes` la
-- vuelve a considerar de todos modos, porque el punto de partida de cada
-- regla se lee del último movimiento realmente insertado, no de un
-- contador aparte.
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
        v_monto_dinamico := public.redondear_monto(v_base * v_tasa, r.redondeo);
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
