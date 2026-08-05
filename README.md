# Contabilify

Aplicación en Vue/Nuxt 3 para llevar el control de ingresos y egresos de una
asociación cultural (caja y banco), con un modo de **carga rápida** pensado
para cargar movimientos en pocos toques desde el móvil.

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
Si más adelante quieres agregar una columna (por ejemplo `medio_pago`),
alcanza con una migración nueva y actualizar `types/schema.ts`.

## Roles

- **`member`**: puede iniciar sesión y ver todo (movimientos, saldos,
  entidades, cuentas), pero no puede agregar, editar ni borrar nada.
- **`admin`**: además puede cargar, editar y eliminar movimientos, administrar
  las listas de entidades y cuentas, e invitar usuarios y asignar el rol
  `admin` desde `/usuarios`.

La restricción real vive en las políticas de **Row Level Security** de
Postgres (no solo en la interfaz), así que aunque alguien manipule la app
desde la consola del navegador, no puede escribir datos sin ser admin.

## Usuarios: alta y primer inicio de sesión

- **Invitar usuarios**: un admin invita por correo desde `/usuarios`. Esto
  llama a la Admin API de Supabase (`/api/admin/invitar`, con la service role
  key) para enviar el email de invitación; no hace falta entrar al dashboard
  de Supabase para cada usuario nuevo.
- **Primer inicio de sesión**: el usuario invitado entra por el enlace del
  correo con sesión iniciada pero sin nombre ni contraseña propia. La app lo
  manda automáticamente a `/perfil` para completarlos antes de dejarlo usar
  el resto de la app (lo controla `middleware/perfil-completo.global.ts`,
  mirando si `profiles.full_name` está vacío).
- **Editar perfil después**: `/perfil` queda disponible para cualquier
  usuario en cualquier momento (para cambiar su nombre o su contraseña),
  accesible desde el botón con su nombre en la barra de navegación.
- **Asignar admins**: desde `/usuarios`, un admin puede promover o degradar
  a cualquier otro usuario con el botón "Hacer admin" / "Quitar admin" (no
  puede cambiarse el rol a sí mismo desde ahí, para evitar quedarse sin
  admins por accidente).

## Carga rápida

La cuenta sobre la que se cargan los movimientos (**cuenta activa**) no es un
paso más del formulario: se elige tocando su tarjeta de saldo en el panel
principal, ya que en el uso normal se cargan varios movimientos seguidos
contra una misma cuenta. La tarjeta seleccionada queda resaltada y la
elección se recuerda entre sesiones (`localStorage`).

El paso "¿Con quién es la operación?" también permite registrar una
**transferencia entre cuentas propias** en lugar de una entidad externa: al
elegir "Transferir a/desde [otra cuenta]" se generan dos movimientos
vinculados (un egreso en la cuenta de origen y un ingreso en la de destino,
mismo monto y fecha) enlazados por `metadata.transferencia_id` — sin
necesidad de ninguna columna nueva. Al eliminar o editar un movimiento que
forma parte de una transferencia, la otra mitad no se actualiza sola; hay
que hacerlo aparte (se avisa al eliminar desde `/movimientos`).

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecuta en orden los archivos de
   `supabase/migrations/` (`0001_init.sql`, `0002_grants_vistas.sql`,
   `0003_perfiles_email_y_admin.sql`). Esto crea las tablas, las vistas, las
   políticas de RLS y dos cuentas por defecto ("Caja" y "Banco").
3. En **Authentication > Providers**, deja habilitado el inicio de sesión por
   email/contraseña. **Desactiva el alta pública** (Supabase suele traerla
   activada por defecto): en este flujo los usuarios solo se crean por
   invitación desde `/usuarios` (ver más abajo), nunca con un formulario de
   registro abierto.
4. Invítate a ti mismo desde **Authentication > Users > Invite user** (todavía
   no hay ningún admin que pueda usar `/usuarios`, así que este primer usuario
   se crea a mano). Al crearse, un trigger genera automáticamente su fila en
   `profiles` con rol `member`.
5. Para convertirte en `admin` (necesario para poder cargar datos e invitar al
   resto), ejecuta en el SQL Editor lo siguiente, sustituyendo tu correo
   electrónico:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```

   De ahí en adelante, para agregar más admins ya no hace falta el SQL Editor:
   se hace desde `/usuarios` en la propia app.
6. Copia `.env.example` a `.env` y completa `SUPABASE_URL`, `SUPABASE_KEY` y
   `SUPABASE_SERVICE_KEY` con los datos de **Project Settings > API** (la
   service role key ahora hace falta también para invitar usuarios desde
   `/usuarios`, no solo para `/api/keepalive`).
7. En **Authentication > URL Configuration**, configura el **Site URL** y los
   **Redirect URLs** — ver la sección siguiente, es la causa más común de que
   los enlaces de los correos terminen apuntando a `localhost`.

## Arreglar los enlaces de correo que van a localhost

Si los enlaces de invitación o de recuperación de contraseña te llevan a
`http://localhost:3000` en vez de a tu app desplegada, el problema **no está
en el código**: está en la configuración del proyecto de Supabase.

Todo proyecto nuevo trae por defecto **Site URL = `http://localhost:3000`**.
Supabase usa ese valor como destino de los enlaces de los correos de
autenticación, y además **solo acepta un `redirectTo` explícito (el que la
app ya pasa en el código) si esa URL está en la lista de "Redirect URLs"
permitidas** — si no está, ignora el `redirectTo` y cae de nuevo en el Site
URL por defecto. Esto es exactamente lo que causa el síntoma.

Para arreglarlo, en el dashboard de Supabase, **Authentication > URL
Configuration**:

1. Cambia **Site URL** a la URL real de tu app desplegada (ej.
   `https://contabilify.vercel.app`).
2. En **Redirect URLs**, agrega esa misma URL. Si despliegas previews de
   Vercel por rama/PR, agrega también un wildcard como
   `https://*.vercel.app/**`. Si sigues probando en local, deja también
   `http://localhost:3000/**` en la lista.

Una vez actualizado, las invitaciones (`/usuarios`) y los enlaces de
recuperación de contraseña (el "¿Olvidaste tu contraseña?" del login) van a
apuntar al lugar correcto.

## Mantener activo el proyecto de Supabase (deploy en Vercel)

El plan gratuito de Supabase pausa los proyectos tras ~7 días sin actividad.
Si despliegas en Vercel, `vercel.json` ya incluye un **Cron Job** diario que
llama a `/api/keepalive` (`server/api/keepalive.get.ts`), el cual hace
una consulta real a la base de datos (con la service role key, para no
depender de ninguna sesión) y así cuenta como actividad.

Para activarlo:

1. En **Supabase > Project Settings > API**, copia la **`service_role` key**
   (secreta, nunca la expongas en el cliente) y cárgala en Vercel como
   variable de entorno `SUPABASE_SERVICE_KEY`.
2. Genera una cadena aleatoria larga y cárgala en Vercel como `CRON_SECRET`
   (por ejemplo con `openssl rand -hex 32`). Vercel añade automáticamente
   ese valor como cabecera `Authorization: Bearer <CRON_SECRET>` en cada
   invocación del cron, y el endpoint la valida antes de consultar la base.
3. Con eso ya cargado, el cron definido en `vercel.json` (`0 8 * * *`, una
   vez al día) queda activo en cuanto despliegues. El plan Hobby de Vercel
   limita los cron jobs a una ejecución diaria, pero es más que suficiente
   para evitar la pausa por inactividad de Supabase.

Si prefieres no depender de Vercel, `/api/keepalive` funciona igual con
cualquier otro disparador externo (por ejemplo un workflow de GitHub
Actions con `schedule:`), pasando el mismo `CRON_SECRET` como Bearer token.

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
  QuickEntry.vue      # el flujo de carga rápida (tipo → monto → entidad/transferencia → concepto → fecha)
  EntitySelect.vue     # combo de entidades con búsqueda + alta rápida de una nueva
  DateStepper.vue      # input de fecha aaaa-mm-dd con flechas +1/-1 día
  BalanceCard.vue      # tarjeta de saldo, seleccionable para elegir la cuenta activa
composables/
  useProfile.ts         # perfil, rol y estado "perfil completo" del usuario actual
  useUsuarios.ts        # listado de usuarios + cambio de rol (para /usuarios)
  useCuentas.ts
  useEntidades.ts
  useMovimientos.ts    # incluye crearTransferencia (par de movimientos vinculados)
  useSaldos.ts          # saldo actual por cuenta (vista `saldos_cuentas`)
  useUltimaFecha.ts      # recuerda la última fecha usada en la carga rápida
  useCuentaActiva.ts     # cuenta activa para la carga rápida (elegida desde el dashboard)
middleware/
  admin.ts                     # protege páginas de administración
  perfil-completo.global.ts    # fuerza a completar /perfil antes de usar el resto de la app
pages/
  login.vue              # incluye "¿Olvidaste tu contraseña?"
  actualizar-password.vue # destino del enlace de recuperación de contraseña
  perfil.vue              # completar/editar nombre y contraseña propios
  index.vue              # dashboard: saldos + carga rápida + últimos movimientos
  movimientos/index.vue   # tabla completa con filtros y edición (admin)
  entidades/index.vue     # ABM de entidades (admin)
  cuentas/index.vue       # ABM de cuentas (admin)
  usuarios/index.vue      # invitar usuarios y asignar rol admin (admin)
server/api/
  keepalive.get.ts        # cron para mantener activo el proyecto de Supabase
  admin/invitar.post.ts   # invita usuarios con la Admin API (requiere ser admin)
supabase/migrations/
  0001_init.sql                     # esquema completo + RLS
  0002_grants_vistas.sql            # permisos explícitos sobre las vistas
  0003_perfiles_email_y_admin.sql   # columna profiles.email + triggers de sincronización
types/
  schema.ts              # tipos de dominio
  database.ts            # tipado del cliente de Supabase
```

## Decisiones a revisar / fáciles de cambiar

- **Moneda**: se formatea como euros (`es-ES` / `EUR`) en `utils/moneda.ts`.
  Cambia esas dos constantes si corresponde otra moneda.
- **Lista de entidades**: es una tabla editable a mano (`/entidades`), pero el
  orden en el desplegable de la carga rápida es dinámico según cuántas veces
  se ha usado cada una. Si prefieres un orden totalmente manual, se puede
  añadir una columna `orden` a `entidades` sin tocar el resto del sistema.
- **Campos nuevos en movimientos**: usa la columna `metadata` (jsonb) para
  probar campos nuevos sin migración, y "súbelos" a columna propia cuando se
  vuelvan permanentes.
