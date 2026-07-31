# Contabilify

Aplicación en Vue/Nuxt 3 para llevar el control de ingresos y egresos de una
asociación cultural (caja y banco), con un modo de **carga rápida** pensado
para cargar movimientos en pocos toques desde el celular.

## Stack

- [Nuxt 3](https://nuxt.com/)
- [`@nuxtjs/supabase`](https://supabase.nuxtjs.org/) para autenticación y acceso a datos
- Supabase (Postgres + Auth + Row Level Security) como backend

## Esquema de datos (modular)

El esquema está pensado para poder ajustarse más adelante sin romper nada:

- **`cuentas`**: caja, banco, o cualquier otra cuenta que quieras sumar. Cada
  una tiene `saldo_inicial`, y el saldo actual se calcula sumando/restando
  los movimientos.
- **`entidades`**: proveedores, socios, etc. Lista editable a mano
  (`/entidades`) que en la carga rápida se ordena automáticamente por
  frecuencia de uso.
- **`movimientos`**: cada ingreso/egreso, con columnas núcleo (`fecha`,
  `tipo`, `monto`, `concepto`, `entidad_id`, `cuenta_id`, `notas`) más una
  columna `metadata` (jsonb) para agregar campos nuevos a futuro sin
  necesidad de otra migración.
- **`profiles`**: guarda el rol de cada usuario (`member` o `admin`).

Todo el esquema vive en [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).
Si más adelante querés agregar una columna (por ejemplo `medio_pago`),
alcanza con una migración nueva y actualizar `types/schema.ts`.

## Roles

- **`member`**: puede iniciar sesión y ver todo (movimientos, saldos,
  entidades, cuentas), pero no puede agregar, editar ni borrar nada.
- **`admin`**: además puede cargar, editar y eliminar movimientos, y
  administrar las listas de entidades y cuentas.

La restricción real vive en las políticas de **Row Level Security** de
Postgres (no solo en la interfaz), así que aunque alguien manipule la app
desde la consola del navegador, no puede escribir datos sin ser admin.

## Configuración de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecutá el contenido de
   `supabase/migrations/0001_init.sql`. Esto crea las tablas, la vista de
   saldos y las políticas de RLS (y dos cuentas por defecto: "Caja" y "Banco").
3. En **Authentication > Providers**, dejá habilitado el login por
   email/contraseña. Se recomienda **desactivar el alta pública** (o invitar
   usuarios manualmente desde el panel) ya que es una app de uso interno.
4. Invitá a los usuarios de la asociación desde **Authentication > Users**.
   Al crearse el usuario, un trigger crea automáticamente su fila en
   `profiles` con rol `member`.
5. Para convertirte en `admin` (necesario para poder cargar datos), corré en
   el SQL Editor, reemplazando por tu email:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```

6. Copiá `.env.example` a `.env` y completá `SUPABASE_URL` y `SUPABASE_KEY`
   con los datos de **Project Settings > API**.

## Desarrollo local

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3000`. Cualquier ruta salvo
`/login` requiere sesión iniciada.

## Estructura relevante

```
components/
  QuickEntry.vue      # el flujo de carga rápida (tipo → monto → entidad → concepto → cuenta → fecha)
  EntitySelect.vue     # combo de entidades con búsqueda + alta rápida de una nueva
  DateStepper.vue      # input de fecha aaaa-mm-dd con flechas +1/-1 día
  BalanceCard.vue
composables/
  useProfile.ts         # perfil y rol del usuario actual
  useCuentas.ts
  useEntidades.ts
  useMovimientos.ts
  useSaldos.ts          # saldo actual por cuenta (vista `saldos_cuentas`)
  useUltimaFecha.ts      # recuerda la última fecha usada en la carga rápida
pages/
  login.vue
  index.vue              # dashboard: saldos + carga rápida + últimos movimientos
  movimientos/index.vue   # tabla completa con filtros y edición (admin)
  entidades/index.vue     # ABM de entidades (admin)
  cuentas/index.vue       # ABM de cuentas (admin)
supabase/migrations/
  0001_init.sql          # esquema completo + RLS
types/
  schema.ts              # tipos de dominio
  database.ts            # tipado del cliente de Supabase
```

## Decisiones a revisar / fáciles de cambiar

- **Moneda**: se formatea como pesos argentinos (`es-AR` / `ARS`) en
  `utils/moneda.ts`. Cambiá esas dos constantes si corresponde otra moneda.
- **Lista de entidades**: es una tabla editable a mano (`/entidades`), pero el
  orden en el dropdown de la carga rápida es dinámico según cuántas veces se
  usó cada una. Si preferís un orden totalmente manual, se puede agregar una
  columna `orden` a `entidades` sin tocar el resto del sistema.
- **Campos nuevos en movimientos**: usá la columna `metadata` (jsonb) para
  probar campos nuevos sin migración, y "subilos" a columna propia cuando se
  vuelvan permanentes.
