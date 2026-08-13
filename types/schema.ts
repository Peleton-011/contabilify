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
  role: Rol
  created_at: string
}

export type Cuenta = {
  id: string
  nombre: string
  tipo: TipoCuenta
  saldo_inicial: number
  activa: boolean
  orden: number
  created_at: string
}

export type SaldoCuenta = {
  cuenta_id: string
  nombre: string
  tipo: TipoCuenta
  orden: number
  saldo_inicial: number
  saldo_actual: number
}

export type Entidad = {
  id: string
  nombre: string
  activa: boolean
  created_at: string
}

export type Movimiento = {
  id: string
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
