-- ============================================================================
-- Contabilify - esquema inicial
-- ----------------------------------------------------------------------------
-- Este esquema se diseñó para ser modular: los movimientos tienen columnas
-- "núcleo" (fecha, tipo, monto, concepto, entidad, cuenta) más una columna
-- `metadata` (jsonb) donde se pueden guardar campos nuevos sin necesidad de
-- una migración, y las tablas de catálogo (cuentas, entidades) se pueden
-- ampliar libremente más adelante.
-- ============================================================================

-- ------------------------------------------------------------------
-- Roles de usuario
-- ------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('member', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil y rol de cada usuario. Se crea automáticamente al registrarse.';

-- Crea el perfil automáticamente cuando se registra un usuario nuevo en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Función auxiliar: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------------
-- Cuentas (caja / banco / lo que se necesite en el futuro)
-- ------------------------------------------------------------------
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'otro', -- 'efectivo' | 'banco' | 'otro'
  saldo_inicial numeric(12, 2) not null default 0,
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.cuentas is 'Cajas/bancos sobre los que se registran movimientos. Modular: se pueden agregar más cuentas sin tocar código.';

insert into public.cuentas (nombre, tipo, orden)
select 'Caja', 'efectivo', 1
where not exists (select 1 from public.cuentas where nombre = 'Caja');

insert into public.cuentas (nombre, tipo, orden)
select 'Banco', 'banco', 2
where not exists (select 1 from public.cuentas where nombre = 'Banco');

-- ------------------------------------------------------------------
-- Entidades (proveedores, socios, entes con los que se opera)
-- ------------------------------------------------------------------
create table if not exists public.entidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.entidades is 'Lista editable de proveedores/entidades frecuentes para el modo de carga rápida.';

-- ------------------------------------------------------------------
-- Movimientos (ingresos / egresos)
-- ------------------------------------------------------------------
do $$ begin
  create type public.tipo_movimiento as enum ('ingreso', 'egreso');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo public.tipo_movimiento not null,
  monto numeric(12, 2) not null check (monto > 0),
  concepto text not null,
  entidad_id uuid references public.entidades (id) on delete set null,
  cuenta_id uuid not null references public.cuentas (id),
  notas text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.movimientos is 'Ingresos y egresos. Columnas núcleo + metadata jsonb para campos futuros sin migración.';

create index if not exists movimientos_fecha_idx on public.movimientos (fecha desc);
create index if not exists movimientos_cuenta_idx on public.movimientos (cuenta_id);
create index if not exists movimientos_entidad_idx on public.movimientos (entidad_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movimientos_set_updated_at on public.movimientos;
create trigger movimientos_set_updated_at
  before update on public.movimientos
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------------
-- Vista de saldos por cuenta (saldo inicial + ingresos - egresos)
-- ------------------------------------------------------------------
create or replace view public.saldos_cuentas
with (security_invoker = true) as
select
  c.id as cuenta_id,
  c.nombre,
  c.tipo,
  c.orden,
  c.saldo_inicial,
  c.saldo_inicial + coalesce(sum(
    case when m.tipo = 'ingreso' then m.monto else -m.monto end
  ), 0) as saldo_actual
from public.cuentas c
left join public.movimientos m on m.cuenta_id = c.id
group by c.id, c.nombre, c.tipo, c.orden, c.saldo_inicial;

comment on view public.saldos_cuentas is 'Saldo actual por cuenta. security_invoker=true para respetar RLS del usuario que consulta.';

-- ------------------------------------------------------------------
-- Vista de frecuencia de uso de entidades (para ordenar el dropdown
-- de la carga rápida por las entidades más usadas)
-- ------------------------------------------------------------------
create or replace view public.entidades_uso
with (security_invoker = true) as
select entidad_id, count(*) as usos
from public.movimientos
where entidad_id is not null
group by entidad_id;

comment on view public.entidades_uso is 'Cantidad de movimientos por entidad, usada para ordenar el selector de carga rápida por frecuencia.';

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cuentas enable row level security;
alter table public.entidades enable row level security;
alter table public.movimientos enable row level security;

-- profiles: cada quien ve su propio perfil; los admins ven todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- solo un admin puede cambiar roles de otros
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- cuentas: lectura para cualquier usuario autenticado (member o admin)
drop policy if exists cuentas_select on public.cuentas;
create policy cuentas_select on public.cuentas
  for select using (auth.role() = 'authenticated');

drop policy if exists cuentas_admin_insert on public.cuentas;
create policy cuentas_admin_insert on public.cuentas
  for insert with check (public.is_admin());

drop policy if exists cuentas_admin_update on public.cuentas;
create policy cuentas_admin_update on public.cuentas
  for update using (public.is_admin());

drop policy if exists cuentas_admin_delete on public.cuentas;
create policy cuentas_admin_delete on public.cuentas
  for delete using (public.is_admin());

-- entidades: lectura para cualquier usuario autenticado; escritura solo admin
drop policy if exists entidades_select on public.entidades;
create policy entidades_select on public.entidades
  for select using (auth.role() = 'authenticated');

drop policy if exists entidades_admin_insert on public.entidades;
create policy entidades_admin_insert on public.entidades
  for insert with check (public.is_admin());

drop policy if exists entidades_admin_update on public.entidades;
create policy entidades_admin_update on public.entidades
  for update using (public.is_admin());

drop policy if exists entidades_admin_delete on public.entidades;
create policy entidades_admin_delete on public.entidades
  for delete using (public.is_admin());

-- movimientos: lectura para cualquier usuario autenticado; escritura solo admin
drop policy if exists movimientos_select on public.movimientos;
create policy movimientos_select on public.movimientos
  for select using (auth.role() = 'authenticated');

drop policy if exists movimientos_admin_insert on public.movimientos;
create policy movimientos_admin_insert on public.movimientos
  for insert with check (public.is_admin());

drop policy if exists movimientos_admin_update on public.movimientos;
create policy movimientos_admin_update on public.movimientos
  for update using (public.is_admin());

drop policy if exists movimientos_admin_delete on public.movimientos;
create policy movimientos_admin_delete on public.movimientos
  for delete using (public.is_admin());
