-- ============================================================================
-- Perfiles: columna de correo + soporte para el panel de administración
-- de usuarios (/usuarios). El correo se guarda en `profiles` (además de
-- vivir en auth.users) para poder listarlo desde el cliente sin necesitar
-- la service role key, que solo se usa server-side para invitar usuarios.
-- ============================================================================

alter table public.profiles add column if not exists email text;

-- Completa el email de perfiles ya existentes (si corrías 0001 antes de esto).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- El trigger de alta ahora también guarda el email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Mantiene profiles.email sincronizado si el usuario cambia su correo.
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_update();
