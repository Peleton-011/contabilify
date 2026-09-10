-- ============================================================================
-- Fix: la conversión de tasa entre períodos usaba siempre días reales,
-- incluso entre períodos que tienen una conversión exacta y calendario-
-- independiente entre sí.
-- ----------------------------------------------------------------------------
-- Los ocho períodos se dividen en dos familias con una relación EXACTA y
-- fija entre sus miembros, sin depender de fechas concretas:
--   - familia "mes": mensual (1), bimestral (2), trimestral (3),
--     semestral (6), anual (12) — se convierten entre sí por una razón
--     exacta de cantidad de meses. Un interés mensual pagado anualmente
--     ocurre exactamente 12 veces al año, sin importar si ese año tiene
--     365 o 366 días — de la misma manera que una tasa anual declarada Y
--     pagada anualmente no varía en años bisiestos.
--   - familia "día": diaria (1), semanal (7), quincenal (15) — también
--     tienen una cantidad de días fija y exacta entre sí (una semana
--     siempre son 7 días), así que también convierten por una razón
--     exacta, nunca aproximada.
--
-- Los días reales de la liquidación (`p_dias_reales`) solo hacen falta
-- para conversiones ENTRE familias (ej. una tasa semanal pagada
-- mensualmente, o mensual pagada semanalmente): ahí no hay una razón
-- exacta posible porque un mes no tiene una cantidad fija de días, así
-- que no queda otra que aproximar con los días reales de esa liquidación
-- puntual.
--
-- Esto además generaliza (y reemplaza) el caso especial de la migración
-- anterior (mismo período = misma tasa sin conversión): si el período de
-- la tasa y el de la operación coinciden, quedan en la misma familia y la
-- razón de conversión da exactamente 1, así que el resultado es
-- idéntico, sin necesidad de un caso aparte.
-- ============================================================================
create or replace function public.familia_periodo(p_periodo public.periodo_recurrencia)
returns text
language sql immutable as $$
  select case p_periodo
    when 'diaria'    then 'dia'
    when 'semanal'   then 'dia'
    when 'quincenal' then 'dia'
    else 'mes'
  end;
$$;

-- Cantidad exacta de unidades de su propia familia que representa el
-- período (días para la familia "dia", meses para la familia "mes").
-- No confundir con dias_nominales(), que es una aproximación en días
-- usada solo para convertir ENTRE familias.
create or replace function public.unidades_periodo(p_periodo public.periodo_recurrencia)
returns numeric
language sql immutable as $$
  select case p_periodo
    when 'diaria'     then 1
    when 'semanal'    then 7
    when 'quincenal'  then 15
    when 'mensual'    then 1
    when 'bimestral'  then 2
    when 'trimestral' then 3
    when 'semestral'  then 6
    when 'anual'      then 12
  end;
$$;

create or replace function public.tasa_efectiva(
  p_tasa numeric,
  p_tasa_periodo public.periodo_recurrencia,
  p_operacion_periodo public.periodo_recurrencia,
  p_dias_reales integer
) returns numeric
language sql immutable as $$
  select case
    when public.familia_periodo(p_tasa_periodo) = public.familia_periodo(p_operacion_periodo)
      then power(
        1 + p_tasa,
        public.unidades_periodo(p_operacion_periodo) / public.unidades_periodo(p_tasa_periodo)
      ) - 1
    else power(1 + p_tasa, p_dias_reales::numeric / public.dias_nominales(p_tasa_periodo)) - 1
  end;
$$;

comment on function public.tasa_efectiva(numeric, public.periodo_recurrencia, public.periodo_recurrencia, integer) is 'Tasa a aplicar en esta liquidación. Entre períodos de la misma familia (mes o día) usa una razón exacta e independiente del calendario; entre familias distintas, aproxima con los días reales de esta liquidación.';
