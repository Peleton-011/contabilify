-- ============================================================================
-- Fix: la conversión de tasa se aplicaba incluso cuando el período de la
-- tasa y el período de la operación son el mismo.
-- ----------------------------------------------------------------------------
-- `tasa_efectiva` convierte una tasa declarada en un período (ej. anual) a
-- la que corresponde para los días reales que dura la liquidación, por
-- interés compuesto — eso tiene sentido cuando esos dos períodos son
-- distintos (2% anual pagado mensualmente). Pero cuando alguien declara
-- "1% mensual, pagado mensualmente" (el caso simple, sin conversión
-- ninguna de por medio), la función igual aplicaba la fórmula usando los
-- días reales de ESE mes en particular contra los 30 días "nominales" de
-- 'mensual' — así que un mes de 31 días daba 1,0335% en vez de 1%, uno de
-- 28 días daba 0,933%, etc. Con un rate declarado en el mismo período que
-- se cobra, no hay ninguna conversión que hacer: el 1% mensual tiene que
-- aplicarse tal cual, todos los meses, sin importar cuántos días tenga
-- ese mes puntual.
--
-- La conversión por interés compuesto con días reales sigue aplicando -y
-- tiene sentido que así sea- cuando el período de la tasa y el de la
-- operación son distintos: ahí sí hace falta convertir, y un mes más
-- largo acumulando una tasa anual legítimamente devenga un poco más que
-- uno más corto (así calculan intereses los bancos de verdad).
-- ============================================================================
drop function if exists public.tasa_efectiva(numeric, public.periodo_recurrencia, integer);

create or replace function public.tasa_efectiva(
  p_tasa numeric,
  p_tasa_periodo public.periodo_recurrencia,
  p_operacion_periodo public.periodo_recurrencia,
  p_dias_reales integer
) returns numeric
language sql immutable as $$
  select case
    when p_tasa_periodo = p_operacion_periodo then p_tasa
    else power(1 + p_tasa, p_dias_reales::numeric / public.dias_nominales(p_tasa_periodo)) - 1
  end;
$$;

comment on function public.tasa_efectiva(numeric, public.periodo_recurrencia, public.periodo_recurrencia, integer) is 'Tasa a aplicar en esta liquidación. Si el período de la tasa y el de la operación coinciden, se aplica tal cual (sin conversión); si difieren, se convierte por interés compuesto usando los días reales de esta liquidación.';

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
        v_tasa := public.tasa_efectiva(r.porcentaje, r.tasa_periodo, r.operacion_periodo, v_fecha - v_periodo_desde);
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
