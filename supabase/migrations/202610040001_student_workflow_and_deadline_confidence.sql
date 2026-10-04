alter table public.opportunities
  add column source_posted_date date,
  add column deadline_type text not null default 'unknown'
    check (deadline_type in ('exact_timestamp', 'date_only', 'rolling', 'not_listed', 'unknown'));

update public.opportunities
set deadline_type = case
  when deadline_at is not null then 'exact_timestamp'
  when deadline_date is not null then 'date_only'
  else 'unknown'
end;

alter table public.opportunities
  add constraint opportunities_deadline_type_consistency check (
    (deadline_type = 'exact_timestamp' and deadline_at is not null and deadline_date is null)
    or (deadline_type = 'date_only' and deadline_date is not null and deadline_at is null)
    or (deadline_type in ('rolling', 'not_listed', 'unknown') and deadline_date is null and deadline_at is null)
  );

alter table public.tracked_applications
  add column application_checklist jsonb not null default
    '{"requirementsReviewed":false,"materialsPrepared":false,"appliedOnSource":false}'::jsonb
    check (
      jsonb_typeof(application_checklist) = 'object'
      and application_checklist ? 'requirementsReviewed'
      and application_checklist ? 'materialsPrepared'
      and application_checklist ? 'appliedOnSource'
      and jsonb_typeof(application_checklist -> 'requirementsReviewed') = 'boolean'
      and jsonb_typeof(application_checklist -> 'materialsPrepared') = 'boolean'
      and jsonb_typeof(application_checklist -> 'appliedOnSource') = 'boolean'
      and (application_checklist - array['requirementsReviewed', 'materialsPrepared', 'appliedOnSource']) = '{}'::jsonb
    ),
  add column experience_examples text not null default ''
    check (char_length(experience_examples) <= 3000);

create table public.opportunity_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  reason text not null check (reason in ('wrong_year', 'location', 'compensation', 'field', 'requirements', 'other')),
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create index opportunity_feedback_user_created_idx
  on public.opportunity_feedback (user_id, created_at desc);

alter table public.opportunity_feedback enable row level security;

create policy "Users manage their opportunity feedback" on public.opportunity_feedback
  for all to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.opportunities
      where opportunities.id = opportunity_id
        and opportunities.status = 'published'
        and opportunities.is_demo = false
    )
  );

grant select, insert, update, delete on public.opportunity_feedback to authenticated;
grant all on public.opportunity_feedback to service_role;
