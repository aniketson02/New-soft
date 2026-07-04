-- Secret accessor for the extraction pipeline. The key itself lives in
-- Supabase Vault (encrypted at rest); only service_role may read it.
-- Store the key with:
--   select vault.create_secret('<key>', 'llm_api_key', 'LLM API key');

create or replace function public.get_llm_key()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'llm_api_key'
  order by created_at desc
  limit 1
$$;

revoke execute on function public.get_llm_key() from public;
revoke execute on function public.get_llm_key() from anon;
revoke execute on function public.get_llm_key() from authenticated;
grant execute on function public.get_llm_key() to service_role;
