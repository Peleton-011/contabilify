import type { Cuenta, Entidad, Ledger, LedgerMember, Movimiento, Profile, SaldoCuenta } from './schema'

// Tipado mínimo de la base para el cliente de Supabase. No cubre todas las
// variantes de Postgres, solo lo necesario para autocompletar en los
// composables. Si añades columnas nuevas, súmalas aquí también.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
        Relationships: []
      }
      ledgers: {
        Row: Ledger
        Insert: Partial<Ledger> & { nombre: string }
        Update: Partial<Ledger>
        Relationships: []
      }
      ledger_members: {
        Row: LedgerMember
        Insert: Partial<LedgerMember> & { ledger_id: string; user_id: string }
        Update: Partial<LedgerMember>
        Relationships: []
      }
      cuentas: {
        Row: Cuenta
        Insert: Partial<Cuenta> & { nombre: string; ledger_id: string }
        Update: Partial<Cuenta>
        Relationships: []
      }
      entidades: {
        Row: Entidad
        Insert: Partial<Entidad> & { nombre: string; ledger_id: string }
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
          ledger_id: string
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
        Row: { entidad_id: string; ledger_id: string; usos: number }
        Relationships: []
      }
    }
    Functions: {
      crear_ledger: {
        Args: { p_nombre: string }
        Returns: Ledger
      }
    }
  }
}
