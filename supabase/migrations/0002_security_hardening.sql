-- Address security advisor findings:
-- 1. Pin search_path on the trigger function.
-- 2. SECURITY DEFINER RPCs require a signed-in user; remove anon EXECUTE.

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.create_family(text, text) from anon;
revoke execute on function public.join_family(text, text) from anon;
revoke execute on function public.is_family_member(uuid) from anon;
