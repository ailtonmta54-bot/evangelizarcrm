REVOKE ALL ON FUNCTION public.protect_profile_tenant_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_tenant_fields() TO service_role;