create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  graduation_year integer check (graduation_year between 2026 and 2040),
  major text check (char_length(major) <= 100),
  skills text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  remote_preference text not null default 'any'
    check (remote_preference in ('any', 'remote', 'hybrid', 'onsite')),
  current_class_year text check (current_class_year in ('freshman', 'sophomore', 'junior', 'senior', 'graduate')),
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  canonical_source_id text unique,
  company text not null check (char_length(company) between 1 and 120),
  title text not null check (char_length(title) between 1 and 180),
  description text not null,
  eligible_class_years text[] not null default '{}'
    check (eligible_class_years <@ array['freshman', 'sophomore', 'junior', 'senior', 'graduate']::text[]),
  eligibility_basis text not null
    check (eligibility_basis in ('listed_years', 'undergraduates', 'unclear')),
  eligibility_notes text,
  location text not null,
  work_mode text not null check (work_mode in ('remote', 'hybrid', 'onsite')),
  compensation_type text not null check (compensation_type in ('paid', 'unpaid', 'unknown')),
  compensation_details text,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  deadline_date date,
  deadline_at timestamptz,
  last_verified_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (not (deadline_date is not null and deadline_at is not null)),
  check (
    (eligibility_basis = 'listed_years' and cardinality(eligible_class_years) > 0)
    or (eligibility_basis <> 'listed_years' and cardinality(eligible_class_years) = 0)
  ),
  check (
    status <> 'published'
    or eligibility_basis = 'listed_years'
    or nullif(btrim(eligibility_notes), '') is not null
  )
);

create index opportunities_published_verified_idx
  on public.opportunities (last_verified_at desc)
  where status = 'published' and is_demo = false;
create index opportunities_deadline_idx
  on public.opportunities (deadline_date)
  where status = 'published' and deadline_date is not null;
create index opportunities_search_idx
  on public.opportunities using gin (to_tsvector('english', company || ' ' || title));

create table public.tracked_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes text not null default '',
  applied_at date,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index tracked_applications_user_status_idx
  on public.tracked_applications (user_id, status, updated_at desc);
create index tracked_applications_follow_up_idx
  on public.tracked_applications (follow_up_date)
  where follow_up_date is not null;

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  tracked_application_id uuid not null references public.tracked_applications (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  previous_status text,
  new_status text not null,
  changed_at timestamptz not null default now()
);

create index application_status_history_app_date_idx
  on public.application_status_history (tracked_application_id, changed_at desc);

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_digest_enabled boolean not null default false,
  deadline_reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  kind text not null check (kind in ('weekly_digest', 'deadline_reminder')),
  period_key text not null,
  delivery_key text not null unique,
  provider_idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, opportunity_id, kind, period_key)
);

create index email_deliveries_user_period_idx
  on public.email_deliveries (user_id, kind, period_key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger tracked_applications_set_updated_at before update on public.tracked_applications
  for each row execute function public.set_updated_at();
create trigger notification_settings_set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_members
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_user_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.notification_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users
  for each row execute function public.create_user_records();

create or replace function public.record_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (tracked_application_id, actor_id, new_status)
      values (new.id, (select auth.uid()), new.status);
  elsif old.status is distinct from new.status then
    insert into public.application_status_history
      (tracked_application_id, actor_id, previous_status, new_status)
      values (new.id, (select auth.uid()), old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger tracked_application_status_history
  after insert or update of status on public.tracked_applications
  for each row execute function public.record_application_status();

alter table public.profiles enable row level security;
alter table public.admin_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.tracked_applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.notification_settings enable row level security;
alter table public.email_deliveries enable row level security;

create policy "Users read their profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users insert their profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update their profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users read their notification settings" on public.notification_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their notification settings" on public.notification_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their notification settings" on public.notification_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Published production listings are readable" on public.opportunities
  for select to anon, authenticated
  using (status = 'published' and is_demo = false);
create policy "Admins manage opportunities" on public.opportunities
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins read admin memberships" on public.admin_members
  for select to authenticated using ((select public.is_admin()));

create policy "Users manage their tracked applications" on public.tracked_applications
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users read their status history" on public.application_status_history
  for select to authenticated using (
    exists (
      select 1 from public.tracked_applications tracked
      where tracked.id = tracked_application_id
        and tracked.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.admin_members from anon, authenticated;
revoke insert, update, delete on public.application_status_history from anon, authenticated;
revoke all on public.email_deliveries from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.notification_settings to authenticated;
grant select on public.opportunities to anon;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert, update, delete on public.tracked_applications to authenticated;
grant select on public.application_status_history to authenticated;
grant select on public.admin_members to authenticated;

grant usage on schema public to service_role;
grant all on public.profiles, public.admin_members, public.opportunities,
  public.tracked_applications, public.application_status_history,
  public.notification_settings, public.email_deliveries to service_role;