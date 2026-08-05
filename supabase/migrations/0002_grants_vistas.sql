-- ============================================================================
-- Ajuste: asegurar permisos explícitos de lectura sobre las vistas.
-- ----------------------------------------------------------------------------
-- Las vistas creadas en 0001 no tenían un GRANT explícito. En la mayoría de
-- los proyectos de Supabase los privilegios por defecto ya cubren esto, pero
-- si tu proyecto no los heredó (por ejemplo, el desplegable de la carga
-- rápida no se ordenaba por frecuencia de uso porque `entidades_uso` no era
-- legible), este grant explícito lo soluciona sin depender de esa herencia.
-- ============================================================================

grant select on public.saldos_cuentas to authenticated;
grant select on public.entidades_uso to authenticated;
