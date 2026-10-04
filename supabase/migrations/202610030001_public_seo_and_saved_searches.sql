alter table public.opportunities
  add column slug text;

update public.opportunities
set slug = trim(both '-' from regexp_replace(lower(company || '-' || title), '[^a-z0-9]+', '-', 'g'))
  || '-' || left(id::text, 8);

alter table public.opportunities
  alter column slug set not null;

create unique index opportunities_slug_idx on public.opportunities (slug);

create or replace function public.set_opportunity_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := trim(both '-' from regexp_replace(lower(new.company || '-' || new.title), '[^a-z0-9]+', '-', 'g'))
      || '-' || left(new.id::text, 8);
  end if;
  return new;
end;
$$;

create trigger opportunities_set_slug
  before insert on public.opportunities
  for each row execute function public.set_opportunity_slug();

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null check (
    jsonb_typeof(filters) = 'object'
    and (filters - array['query', 'classYear', 'location', 'workMode', 'compensation', 'deadlineBefore']) = '{}'::jsonb
  ),
  notify_email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, filters)
);

create index saved_searches_user_created_idx
  on public.saved_searches (user_id, created_at desc);

create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

alter table public.notification_settings
  add column saved_search_alerts_enabled boolean not null default false;

create table public.opportunity_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('closed', 'inaccurate', 'suspicious', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  unique (opportunity_id, user_id)
);

create index opportunity_reports_open_created_idx
  on public.opportunity_reports (created_at)
  where status = 'open';
create index opportunity_reports_opportunity_created_idx
  on public.opportunity_reports (opportunity_id, created_at desc);

alter table public.saved_searches enable row level security;
alter table public.opportunity_reports enable row level security;

create policy "Users manage their saved searches" on public.saved_searches
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users report published production listings" on public.opportunity_reports
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.opportunities
      where opportunities.id = opportunity_id
        and opportunities.status = 'published'
        and opportunities.is_demo = false
    )
  );
create policy "Admins review listing reports" on public.opportunity_reports
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.saved_searches to authenticated;
grant select, insert, update on public.opportunity_reports to authenticated;
grant all on public.saved_searches, public.opportunity_reports to service_role;

revoke delete on public.opportunity_reports from anon, authenticated;
