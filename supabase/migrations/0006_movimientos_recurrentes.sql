-- ============================================================================
-- Movimientos recurrentes
-- ----------------------------------------------------------------------------
-- Reglas que generan movimientos automáticamente en una cadencia (semanal,
-- mensual, ...): cargos fijos tipo suscripción, comisiones porcentuales,
-- intereses, o una combinación de ambos (ej. "0,5% + 20€ de comisión fija").
--
-- Diseño (ver la conversación de diseño para el detalle):
-- - Una regla puede tener una parte fija (`monto_fijo`), una parte dinámica
--   (`usa_dinamico` + `porcentaje` + ...), o ambas a la vez. Cuando tiene
--   ambas, se genera UN solo movimiento por ocurrencia con el monto
--   combinado (así se ve en el resumen bancario real), y el desglose queda
--   en `metadata` para poder auditar cada parte por separado.
-- - La tasa puede declararse en un período distinto al que realmente se
--   cobra (2% anual pagado mensualmente), convertida por interés compuesto.
-- - El % puede calcularse sobre el saldo al inicio, al final, o el saldo
--   promedio ponderado por días del período (el default, y lo que
--   realmente usan los bancos para intereses).
-- - Los movimientos generados se etiquetan en `metadata` con el período
--   exacto que cubren y cuándo se calcularon, para poder detectar más
--   adelante si un movimiento cargado después, con fecha dentro de ese
--   período, dejó ese cálculo desactualizado (ver la vista al final).
--   Nada se recalcula solo: se muestra para que un humano decida.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1) Tipos
-- ------------------------------------------------------------------
do $$ begin
  create type public.periodo_recurrencia as enum (
    'diaria', 'semanal', 'quincenal', 'mensual',
    'bimestral', 'trimestral', 'semestral', 'anual'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.base_calculo_saldo as enum ('inicio', 'promedio', 'fin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.metodo_redondeo as enum ('matematico', 'piso', 'techo');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------
-- 2) Tabla
-- ------------------------------------------------------------------
create table public.movimientos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  cuenta_id uuid not null,
  entidad_id uuid,
  tipo public.tipo_movimiento not null,
  concepto text not null,

  -- parte fija (ej. 20 de cargo). 0 si esta regla no la usa.
  monto_fijo numeric(12, 2) not null default 0,

  -- parte dinámica (ej. 0,5% de comisión, o 2% anual de interés)
  usa_dinamico boolean not null default false,
  porcentaje numeric(7, 4),
  base_calculo public.base_calculo_saldo,
  tasa_periodo public.periodo_recurrencia,
  redondeo public.metodo_redondeo not null default 'matematico',

  -- cadencia real de cobro/pago (puede diferir del período de la tasa)
  operacion_periodo public.periodo_recurrencia not null,

  fecha_inicio date not null default current_date,
  fecha_fin date,

  activo boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  foreign key (cuenta_id, ledger_id) references public.cuentas (id, ledger_id),
  foreign key (entidad_id, ledger_id) references public.entidades (id, ledger_id) on delete set null (entidad_id),

  constraint movimientos_recurrentes_algo_check
    check (monto_fijo <> 0 or usa_dinamico),
  constraint movimientos_recurrentes_dinamico_check
    check (not usa_dinamico or (porcentaje is not null and base_calculo is not null and tasa_periodo is not null)),
  constraint movimientos_recurrentes_fechas_check
    check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

comment on table public.movimientos_recurrentes is 'Reglas que generan movimientos automáticamente (suscripciones, comisiones, intereses). Ver materializar_movimientos_recurrentes().';

create index movimientos_recurrentes_ledger_idx on public.movimientos_recurrentes (ledger_id);
create index movimientos_recurrentes_cuenta_idx on public.movimientos_recurrentes (cuenta_id);

alter table public.movimientos_recurrentes enable row level security;

create policy movimientos_recurrentes_select on public.movimientos_recurrentes
  for select using (public.is_ledger_member(ledger_id));

create policy movimientos_recurrentes_admin_insert on public.movimientos_recurrentes
  for insert with check (public.is_ledger_admin(ledger_id));

create policy movimientos_recurrentes_admin_update on public.movimientos_recurrentes
  for update using (public.is_ledger_admin(ledger_id));

create policy movimientos_recurrentes_admin_delete on public.movimientos_recurrentes
  for delete using (public.is_ledger_admin(ledger_id));

-- ------------------------------------------------------------------
-- 3) Avance de fechas para la cadencia, con clamp de fin de mes
-- ------------------------------------------------------------------
-- Sumar N meses a una fecha sin desbordar al mes siguiente cuando el día no
-- existe ahí (ej. 31 de enero + 1 mes -> 28/29 de febrero, no 3 de marzo).
create or replace function public.sumar_meses_clamp(p_fecha date, p_meses integer)
returns date
language sql immutable as $$
  select least(
    -- primer día del mes destino + 1 mes - 1 día = último día del mes destino
    (date_trunc('month', p_fecha) + (p_meses || ' months')::interval + interval '1 month' - interval '1 day')::date,
    -- mismo día del mes en el mes destino (puede desbordar si no existe)
    (date_trunc('month', p_fecha) + (p_meses || ' months')::interval + (extract(day from p_fecha)::int - 1) * interval '1 day')::date
  );
$$;

create or replace function public.avanzar_fecha(p_fecha date, p_periodo public.periodo_recurrencia)
returns date
language sql immutable as $$
  select case p_periodo
    when 'diaria'     then p_fecha + 1
    when 'semanal'    then p_fecha + 7
    when 'quincenal'  then p_fecha + 15
    when 'mensual'    then public.sumar_meses_clamp(p_fecha, 1)
    when 'bimestral'  then public.sumar_meses_clamp(p_fecha, 2)
    when 'trimestral' then public.sumar_meses_clamp(p_fecha, 3)
    when 'semestral'  then public.sumar_meses_clamp(p_fecha, 6)
    when 'anual'      then public.sumar_meses_clamp(p_fecha, 12)
  end;
$$;

comment on function public.avanzar_fecha(date, public.periodo_recurrencia) is 'Próxima fecha de cobro dada una cadencia. Los períodos basados en meses hacen clamp al último día del mes destino en vez de desbordar (31 ene + 1 mes = 28/29 feb, no 3 mar).';

-- ------------------------------------------------------------------
-- 4) Conversión de tasa por interés compuesto y redondeo
-- ------------------------------------------------------------------
create or replace function public.dias_nominales(p_periodo public.periodo_recurrencia)
returns numeric
language sql immutable as $$
  select case p_periodo
    when 'diaria'     then 1
    when 'semanal'    then 7
    when 'quincenal'  then 15
    when 'mensual'    then 30
    when 'bimestral'  then 60
    when 'trimestral' then 90
    when 'semestral'  then 180
    when 'anual'      then 365
  end;
$$;

-- Convierte una tasa declarada en un período (ej. anual) a la tasa efectiva
-- para los días reales que cubre esta liquidación, por interés compuesto.
create or replace function public.tasa_efectiva(
  p_tasa numeric,
  p_tasa_periodo public.periodo_recurrencia,
  p_dias_reales integer
) returns numeric
language sql immutable as $$
  select power(1 + p_tasa, p_dias_reales::numeric / public.dias_nominales(p_tasa_periodo)) - 1;
$$;

create or replace function public.redondear_monto(p_monto numeric, p_metodo public.metodo_redondeo)
returns numeric
language sql immutable as $$
  select case p_metodo
    when 'matematico' then round(p_monto, 2)
    when 'piso'       then floor(p_monto * 100) / 100
    when 'techo'      then ceil(p_monto * 100) / 100
  end;
$$;

-- ------------------------------------------------------------------
-- 5) Saldo de una cuenta en una fecha, y saldo promedio ponderado por días
-- ------------------------------------------------------------------
create or replace function public.saldo_en_fecha(p_cuenta_id uuid, p_ledger_id uuid, p_fecha date)
returns numeric
language sql stable as $$
  select c.saldo_inicial + coalesce(sum(
    case when m.tipo = 'ingreso' then m.monto else -m.monto end
  ), 0)
  from public.cuentas c
  left join public.movimientos m
    on m.cuenta_id = c.id and m.ledger_id = c.ledger_id and m.fecha < p_fecha
  where c.id = p_cuenta_id and c.ledger_id = p_ledger_id
  group by c.saldo_inicial;
$$;

comment on function public.saldo_en_fecha(uuid, uuid, date) is 'Saldo de la cuenta justo antes de p_fecha (no incluye movimientos con esa misma fecha).';

-- Saldo promedio diario en [p_desde, p_hasta): pondera cada nivel de saldo
-- por la cantidad de días que se mantuvo antes del siguiente movimiento.
create or replace function public.saldo_promedio(
  p_cuenta_id uuid, p_ledger_id uuid, p_desde date, p_hasta date
) returns numeric
language plpgsql stable as $$
declare
  v_saldo numeric(12, 2);
  v_ponderado numeric := 0;
  v_fecha_actual date := p_desde;
  r record;
begin
  v_saldo := coalesce(public.saldo_en_fecha(p_cuenta_id, p_ledger_id, p_desde), 0);

  for r in
    select fecha, tipo, monto
    from public.movimientos
    where cuenta_id = p_cuenta_id and ledger_id = p_ledger_id
      and fecha >= p_desde and fecha < p_hasta
    order by fecha, created_at
  loop
    v_ponderado := v_ponderado + v_saldo * (r.fecha - v_fecha_actual);
    v_saldo := v_saldo + case when r.tipo = 'ingreso' then r.monto else -r.monto end;
    v_fecha_actual := r.fecha;
  end loop;

  v_ponderado := v_ponderado + v_saldo * (p_hasta - v_fecha_actual);

  if p_hasta = p_desde then
    return v_saldo;
  end if;

  return round(v_ponderado / (p_hasta - p_desde), 2);
end;
$$;

-- ------------------------------------------------------------------
-- 6) Materialización: genera los movimientos que falten hasta hoy
-- ------------------------------------------------------------------
-- Se llama de forma perezosa (no hace falta cron): cada vez que se carga un
-- ledger, esta función pone al día únicamente lo que falte desde la última
-- vez, leyendo dónde quedó cada regla directamente de sus propios
-- movimientos ya generados (metadata->>'periodo_hasta'), sin necesidad de
-- una tabla de estado aparte.
--
-- La primera ocurrencia de una regla cae un período después de
-- fecha_inicio, no en fecha_inicio mismo: fecha_inicio es cuándo empieza a
-- correr el reloj del primer período, no una fecha de cobro en sí.
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

      insert into public.movimientos (
        ledger_id, fecha, tipo, monto, concepto, entidad_id, cuenta_id, created_by, metadata
      ) values (
        p_ledger_id, v_fecha, r.tipo, v_monto_fijo + v_monto_dinamico, r.concepto, r.entidad_id, r.cuenta_id, r.created_by,
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

      v_periodo_desde := v_fecha;
      v_fecha := public.avanzar_fecha(v_fecha, r.operacion_periodo);
    end loop;
  end loop;

  return v_generados;
end;
$$;

comment on function public.materializar_movimientos_recurrentes(uuid) is 'Genera los movimientos que falten (hasta hoy) para cada regla activa del ledger. Idempotente: cada llamada retoma desde donde quedó la anterior.';

grant execute on function public.materializar_movimientos_recurrentes(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 7) Detección de cálculos desactualizados por una carga retroactiva
-- ------------------------------------------------------------------
-- Un movimiento generado queda "desactualizado" si después se cargó otro
-- movimiento en la misma cuenta con fecha dentro del período que ya se
-- había calculado. No se recalcula solo: esto es para mostrarlo y que un
-- humano decida (borrar y dejar que se regenere, o dejarlo como está).
create or replace view public.movimientos_recurrentes_desactualizados
with (security_invoker = true) as
select
  m.id as movimiento_id,
  m.ledger_id,
  m.fecha,
  (m.metadata ->> 'recurrente_id')::uuid as recurrente_id
from public.movimientos m
where m.metadata ? 'recurrente_id'
  and exists (
    select 1
    from public.movimientos otro
    where otro.ledger_id = m.ledger_id
      and otro.cuenta_id = m.cuenta_id
      and otro.fecha >= (m.metadata ->> 'periodo_desde')::date
      and otro.fecha < (m.metadata ->> 'periodo_hasta')::date
      and otro.id <> m.id
      and otro.created_at > (m.metadata ->> 'calculado_en')::timestamptz
  );

comment on view public.movimientos_recurrentes_desactualizados is 'Movimientos generados cuyo cálculo pudo quedar desactualizado por una carga posterior con fecha dentro de su período.';

grant select on public.movimientos_recurrentes_desactualizados to authenticated;
