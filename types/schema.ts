// Tipos del esquema de datos. El esquema es intencionalmente modular:
// las columnas "núcleo" cubren lo esencial, y `metadata` permite agregar
// campos nuevos a futuro sin migraciones ni cambios de tipos.
//
// Nota: se usan `type` en lugar de `interface` a propósito. Los tipos de
// Supabase requieren que cada `Row` sea estructuralmente asignable a
// `Record<string, unknown>`, y TypeScript solo permite eso para alias de
// tipo (no para interfaces).

export type TipoMovimiento = 'ingreso' | 'egreso'

export type TipoCuenta = 'efectivo' | 'banco' | 'otro'

export type Rol = 'member' | 'admin'

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  created_at: string
}

export type Ledger = {
  id: string
  nombre: string
  created_by: string | null
  created_at: string
}

// Fila de ledger_members con el rol del usuario actual dentro de ese ledger,
// tal como la usa el selector de ledgers.
export type LedgerConRol = Ledger & {
  role: Rol
}

export type LedgerMember = {
  ledger_id: string
  user_id: string
  role: Rol
  created_at: string
}

// Fila de ledger_members con el perfil ya resuelto (join), como la devuelve
// el listado de miembros de /usuarios.
export type LedgerMemberConPerfil = LedgerMember & {
  profile: Pick<Profile, 'id' | 'full_name' | 'email'>
}

export type Cuenta = {
  id: string
  ledger_id: string
  nombre: string
  tipo: TipoCuenta
  saldo_inicial: number
  activa: boolean
  orden: number
  created_at: string
}

export type SaldoCuenta = {
  cuenta_id: string
  ledger_id: string
  nombre: string
  tipo: TipoCuenta
  orden: number
  saldo_inicial: number
  saldo_actual: number
}

export type Entidad = {
  id: string
  ledger_id: string
  nombre: string
  activa: boolean
  created_at: string
}

export type Movimiento = {
  id: string
  ledger_id: string
  fecha: string // yyyy-mm-dd
  tipo: TipoMovimiento
  monto: number
  concepto: string
  entidad_id: string | null
  cuenta_id: string
  notas: string | null
  numero_factura: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

// Vista de movimiento con los nombres de sus relaciones ya resueltos,
// tal como la devuelven los `select` con joins de Supabase.
export type MovimientoConRelaciones = Movimiento & {
  entidad: Pick<Entidad, 'id' | 'nombre'> | null
  cuenta: Pick<Cuenta, 'id' | 'nombre' | 'tipo'>
}

export type NuevoMovimiento = Omit<Movimiento, 'id' | 'created_at' | 'updated_at'>

export type PeriodoRecurrencia =
  | 'diaria'
  | 'semanal'
  | 'quincenal'
  | 'mensual'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'

export type BaseCalculoSaldo = 'inicio' | 'promedio' | 'fin'

export type MetodoRedondeo = 'matematico' | 'piso' | 'techo'

export type MovimientoRecurrente = {
  id: string
  ledger_id: string
  cuenta_id: string
  entidad_id: string | null
  tipo: TipoMovimiento
  concepto: string
  monto_fijo: number
  usa_dinamico: boolean
  porcentaje: number | null
  base_calculo: BaseCalculoSaldo | null
  tasa_periodo: PeriodoRecurrencia | null
  redondeo: MetodoRedondeo
  operacion_periodo: PeriodoRecurrencia
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean
  created_by: string | null
  created_at: string
}

export type MovimientoRecurrenteConRelaciones = MovimientoRecurrente & {
  entidad: Pick<Entidad, 'id' | 'nombre'> | null
  cuenta: Pick<Cuenta, 'id' | 'nombre' | 'tipo'>
}

export type NuevoMovimientoRecurrente = Omit<MovimientoRecurrente, 'id' | 'created_at'>
