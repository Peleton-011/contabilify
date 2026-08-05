-- ============================================================================
-- Número de factura: campo presente de forma consistente en la contabilidad
-- en Excel desde 2023, se promueve a columna propia en vez de vivir en
-- `metadata` porque se usa para buscar/filtrar y aparece en las
-- exportaciones a Excel.
-- ============================================================================

alter table public.movimientos add column if not exists numero_factura text;

comment on column public.movimientos.numero_factura is 'Número de factura o comprobante, opcional.';
