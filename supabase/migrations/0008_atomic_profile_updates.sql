-- FounderUp - atomic settings mutations
--
-- A profile Save used to be three independent requests: username, country,
-- then public fields. A later failure could therefore leave a partially saved
-- form. These RPCs make each user action one database transaction.

create or replace function public.update_founder_profile(
  p_username text,
  p_country_code text,
  p_full_name text,
  p_avatar_url text,
  p_headline text,
  p_bio text,
  p_website_url text,
  p_x_url text,
  p_linkedin_url text,
  p_github_url text,
  p_contact_type text,
  p_contact_value text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_founder_id uuid := public.current_founder_id();
begin
  if v_founder_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Both guarded mutations are part of this RPC's transaction. If the final
  -- update or either guard fails, PostgreSQL rolls every change back.
  perform public.change_username(p_username);
  perform public.change_country(p_country_code);

  update public.profiles
     set full_name = p_full_name,
         avatar_url = p_avatar_url,
         headline = p_headline,
         bio = p_bio,
         website_url = p_website_url,
         x_url = p_x_url,
         linkedin_url = p_linkedin_url,
         github_url = p_github_url,
         contact_type = p_contact_type,
         contact_value = p_contact_value
   where id = v_founder_id;
end;
$$;

create or replace function public.reorder_founder_ventures(p_ordered_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_founder_id uuid := public.current_founder_id();
  v_owned_count int;
begin
  if v_founder_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select count(*) into v_owned_count
    from public.ventures where founder_id = v_founder_id;

  if coalesce(cardinality(p_ordered_ids), 0) <> v_owned_count
     or (select count(distinct id) from unnest(p_ordered_ids) as ids(id)) <> v_owned_count
     or exists (
       select 1 from unnest(p_ordered_ids) as ids(id)
        where not exists (
          select 1 from public.ventures v
           where v.id = ids.id and v.founder_id = v_founder_id
        )
     ) then
    raise exception 'VENTURE_ORDER_INVALID';
  end if;

  update public.ventures v
     set sort_order = ordered.position - 1
    from unnest(p_ordered_ids) with ordinality as ordered(id, position)
   where v.id = ordered.id and v.founder_id = v_founder_id;
end;
$$;

revoke all on function public.update_founder_profile(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.update_founder_profile(
  text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.reorder_founder_ventures(uuid[]) from public, anon;
grant execute on function public.reorder_founder_ventures(uuid[]) to authenticated;
