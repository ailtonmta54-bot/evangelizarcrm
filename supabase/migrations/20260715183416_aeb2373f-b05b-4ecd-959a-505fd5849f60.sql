CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Cada signup cria sua própria empresa (via handle_new_user),
  -- portanto o usuário deve ser owner + admin da própria conta.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Backfill: usuários existentes que são donos únicos da própria empresa
-- mas não têm papel admin/owner ficam sem poder criar workspace.
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'owner'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'owner'
)
AND (
  SELECT COUNT(*) FROM public.profiles p2 WHERE p2.company_id = p.company_id
) = 1
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'admin'
)
AND (
  SELECT COUNT(*) FROM public.profiles p2 WHERE p2.company_id = p.company_id
) = 1
ON CONFLICT DO NOTHING;