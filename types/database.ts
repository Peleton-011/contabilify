import type { Cuenta, Entidad, Movimiento, Profile, SaldoCuenta } from './schema'

// Tipado mínimo de la base para el cliente de Supabase. No cubre todas las
// variantes de Postgres, solo lo necesario para autocompletar en los
// composables. Si agregás columnas nuevas, sumalas acá también.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
        Relationships: []
      }
      cuentas: {
        Row: Cuenta
        Insert: Partial<Cuenta> & { nombre: string }
        Update: Partial<Cuenta>
        Relationships: []
      }
      entidades: {
        Row: Entidad
        Insert: Partial<Entidad> & { nombre: string }
        Update: Partial<Entidad>
        Relationships: []
      }
      movimientos: {
        Row: Movimiento
        Insert: Partial<Movimiento> & {
          tipo: Movimiento['tipo']
          monto: number
          concepto: string
          cuenta_id: string
        }
        Update: Partial<Movimiento>
        Relationships: []
      }
    }
    Views: {
      saldos_cuentas: {
        Row: SaldoCuenta
        Relationships: []
      }
      entidades_uso: {
        Row: { entidad_id: string; usos: number }
        Relationships: []
      }
    }
    Functions: Record<string, never>
  }
}
