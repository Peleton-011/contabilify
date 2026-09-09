-- ============================================================================
-- Multi-tenencia: "ledgers"
-- ----------------------------------------------------------------------------
-- Hasta ahora la app era de un solo inquilino: todas las cuentas, entidades y
-- movimientos eran globales, y `profiles.role` era el rol global del usuario.
-- Esta migración introduce `ledgers` (una organización/instancia contable
-- independiente) y `ledger_members` (el rol de cada usuario dentro de cada
-- ledger), y cuelga todo el resto de los datos de un `ledger_id`.
--
-- El aislamiento entre ledgers se refuerza a nivel de base de datos con
-- claves foráneas compuestas: cada tabla hija referencia (id_padre, ledger_id)
-- en vez de solo id_padre, así que es imposible que una fila apunte a un
-- padre de otro ledger aunque el RLS tuviera un error.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1) Columnas ledger_id (nullable por ahora; se completan más abajo)
-- ------------------------------------------------------------------
alter table public.cuentas add column if not exists ledger_id uuid;
alter table public.entidades add column if not exists ledger_id uuid;
alter table public.movimientos add column if not exists ledger_id uuid;

-- ------------------------------------------------------------------
-- 2) Tabla ledgers: raíz de cada inquilino
-- ------------------------------------------------------------------
create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ledgers is 'Una organización/instancia contable independiente (inquilino).';

-- ------------------------------------------------------------------
-- 3) Tabla ledger_members: rol de cada usuario dentro de cada ledger
-- ------------------------------------------------------------------
create table if not exists public.ledger_members (
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

comment on table public.ledger_members is 'Membresía y rol (member/admin) de un usuario dentro de un ledger.';

create index if not exists ledger_members_user_idx on public.ledger_members (user_id);

-- ------------------------------------------------------------------
-- 4) Funciones auxiliares para RLS (mismo patrón que is_admin())
-- ------------------------------------------------------------------
create or replace function public.is_ledger_member(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_ledger_admin(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------------
-- 5) Migración de datos: un ledger para lo que ya existía
-- ------------------------------------------------------------------
do $$
declare
  v_ledger_id uuid;
begin
  insert into public.ledgers (nombre, created_by)
  values ('Mi organización', (select id from public.profiles order by created_at asc limit 1))
  returning id into v_ledger_id;

  update public.cuentas set ledger_id = v_ledger_id where ledger_id is null;
  update public.entidades set ledger_id = v_ledger_id where ledger_id is null;
  update public.movimientos set ledger_id = v_ledger_id where ledger_id is null;

  insert into public.ledger_members (ledger_id, user_id, role)
  select v_ledger_id, id, role from public.profiles
  on conflict do nothing;
end $$;

-- ------------------------------------------------------------------
-- 6) RLS de profiles/cuentas/entidades/movimientos: ahora por ledger
-- ------------------------------------------------------------------
drop policy if exists profiles_admin_update on public.profiles;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from public.ledger_members lm1
      join public.ledger_members lm2 on lm2.ledger_id = lm1.ledger_id
      where lm1.user_id = auth.uid() and lm2.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists cuentas_select on public.cuentas;
create policy cuentas_select on public.cuentas
  for select using (public.is_ledger_member(ledger_id));

drop policy if exists cuentas_admin_insert on public.cuentas;
create policy cuentas_admin_insert on public.cuentas
  for insert with check (public.is_ledger_admin(ledger_id));

drop policy if exists cuentas_admin_update on public.cuentas;
create policy cuentas_admin_update on public.cuentas
  for update using (public.is_ledger_admin(ledger_id));

drop policy if exists cuentas_admin_delete on public.cuentas;
create policy cuentas_admin_delete on public.cuentas
  for delete using (public.is_ledger_admin(ledger_id));

drop policy if exists entidades_select on public.entidades;
create policy entidades_select on public.entidades
  for select using (public.is_ledger_member(ledger_id));

drop policy if exists entidades_admin_insert on public.entidades;
create policy entidades_admin_insert on public.entidades
  for insert with check (public.is_ledger_admin(ledger_id));

drop policy if exists entidades_admin_update on public.entidades;
create policy entidades_admin_update on public.entidades
  for update using (public.is_ledger_admin(ledger_id));

drop policy if exists entidades_admin_delete on public.entidades;
create policy entidades_admin_delete on public.entidades
  for delete using (public.is_ledger_admin(ledger_id));

drop policy if exists movimientos_select on public.movimientos;
create policy movimientos_select on public.movimientos
  for select using (public.is_ledger_member(ledger_id));

drop policy if exists movimientos_admin_insert on public.movimientos;
create policy movimientos_admin_insert on public.movimientos
  for insert with check (public.is_ledger_admin(ledger_id));

drop policy if exists movimientos_admin_update on public.movimientos;
create policy movimientos_admin_update on public.movimientos
  for update using (public.is_ledger_admin(ledger_id));

drop policy if exists movimientos_admin_delete on public.movimientos;
create policy movimientos_admin_delete on public.movimientos
  for delete using (public.is_ledger_admin(ledger_id));

-- ------------------------------------------------------------------
-- 7) El rol ahora vive en ledger_members: se retira el rol global
-- ------------------------------------------------------------------
drop function if exists public.is_admin();
alter table public.profiles drop column if exists role;

-- ------------------------------------------------------------------
-- 8) ledger_id obligatorio + aislamiento con claves foráneas compuestas
-- ------------------------------------------------------------------
alter table public.cuentas alter column ledger_id set not null;
alter table public.entidades alter column ledger_id set not null;
alter table public.movimientos alter column ledger_id set not null;

alter table public.cuentas add constraint cuentas_ledger_id_fkey
  foreign key (ledger_id) references public.ledgers (id) on delete cascade;
alter table public.entidades add constraint entidades_ledger_id_fkey
  foreign key (ledger_id) references public.ledgers (id) on delete cascade;
alter table public.movimientos add constraint movimientos_ledger_id_fkey
  foreign key (ledger_id) references public.ledgers (id) on delete cascade;

alter table public.cuentas add constraint cuentas_id_ledger_key unique (id, ledger_id);
alter table public.entidades add constraint entidades_id_ledger_key unique (id, ledger_id);

-- entidades: la unicidad de nombre ahora es por ledger, no global
alter table public.entidades drop constraint if exists entidades_nombre_key;
alter table public.entidades add constraint entidades_ledger_nombre_key unique (ledger_id, nombre);

-- movimientos.cuenta_id / entidad_id: de FK simple a FK compuesta (mismo ledger)
alter table public.movimientos drop constraint if exists movimientos_cuenta_id_fkey;
alter table public.movimientos add constraint movimientos_cuenta_id_fkey
  foreign key (cuenta_id, ledger_id) references public.cuentas (id, ledger_id);

alter table public.movimientos drop constraint if exists movimientos_entidad_id_fkey;
alter table public.movimientos add constraint movimientos_entidad_id_fkey
  foreign key (entidad_id, ledger_id) references public.entidades (id, ledger_id)
  on delete set null (entidad_id);

create index if not exists cuentas_ledger_idx on public.cuentas (ledger_id);
create index if not exists entidades_ledger_idx on public.entidades (ledger_id);
create index if not exists movimientos_ledger_idx on public.movimientos (ledger_id);

-- ------------------------------------------------------------------
-- 9) RPC para crear un ledger nuevo (resuelve el problema del huevo y la
--    gallina: no se puede insertar en ledger_members si el RLS exige ya
--    ser miembro del ledger que todavía no existe)
-- ------------------------------------------------------------------
create or replace function public.crear_ledger(p_nombre text)
returns public.ledgers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.ledgers;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre del ledger no puede estar vacío';
  end if;

  insert into public.ledgers (nombre, created_by)
  values (trim(p_nombre), auth.uid())
  returning * into v_ledger;

  insert into public.ledger_members (ledger_id, user_id, role)
  values (v_ledger.id, auth.uid(), 'admin');

  insert into public.cuentas (ledger_id, nombre, tipo, orden)
  values
    (v_ledger.id, 'Caja', 'efectivo', 1),
    (v_ledger.id, 'Banco', 'banco', 2);

  return v_ledger;
end;
$$;

comment on function public.crear_ledger(text) is 'Crea un ledger, hace admin a quien lo crea y le siembra cuentas por defecto. Único punto de entrada para crear ledgers.';

grant execute on function public.crear_ledger(text) to authenticated;

-- ------------------------------------------------------------------
-- 10) RLS de ledgers / ledger_members
-- ------------------------------------------------------------------
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;

drop policy if exists ledgers_select on public.ledgers;
create policy ledgers_select on public.ledgers
  for select using (public.is_ledger_member(id));

drop policy if exists ledgers_admin_update on public.ledgers;
create policy ledgers_admin_update on public.ledgers
  for update using (public.is_ledger_admin(id));

drop policy if exists ledger_members_select on public.ledger_members;
create policy ledger_members_select on public.ledger_members
  for select using (public.is_ledger_member(ledger_id));

drop policy if exists ledger_members_admin_insert on public.ledger_members;
create policy ledger_members_admin_insert on public.ledger_members
  for insert with check (public.is_ledger_admin(ledger_id));

drop policy if exists ledger_members_admin_update on public.ledger_members;
create policy ledger_members_admin_update on public.ledger_members
  for update using (public.is_ledger_admin(ledger_id));

drop policy if exists ledger_members_admin_delete on public.ledger_members;
create policy ledger_members_admin_delete on public.ledger_members
  for delete using (public.is_ledger_admin(ledger_id));

-- ------------------------------------------------------------------
-- 11) Vistas: agregan ledger_id para que el cliente pueda filtrar por
--     el ledger activo (con RLS solo, un usuario con varios ledgers
--     vería filas de todos mezclados)
-- ------------------------------------------------------------------
create or replace view public.saldos_cuentas
with (security_invoker = true) as
select
  c.id as cuenta_id,
  c.ledger_id,
  c.nombre,
  c.tipo,
  c.orden,
  c.saldo_inicial,
  c.saldo_inicial + coalesce(sum(
    case when m.tipo = 'ingreso' then m.monto else -m.monto end
  ), 0) as saldo_actual
from public.cuentas c
left join public.movimientos m on m.cuenta_id = c.id and m.ledger_id = c.ledger_id
group by c.id, c.ledger_id, c.nombre, c.tipo, c.orden, c.saldo_inicial;

create or replace view public.entidades_uso
with (security_invoker = true) as
select entidad_id, ledger_id, count(*) as usos
from public.movimientos
where entidad_id is not null
group by entidad_id, ledger_id;
