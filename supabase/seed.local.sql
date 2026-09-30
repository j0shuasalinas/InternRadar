-- Fictional local-only examples. This file is intentionally not auto-loaded.
-- Never copy these rows into production; email jobs must exclude is_demo = true.
insert into public.opportunities (
  canonical_source_id, company, title, description, eligible_class_years,
  eligibility_basis, eligibility_notes, location, work_mode,
  compensation_type, compensation_details, source_url, deadline_date,
  last_verified_at, status, is_demo
) values
  (
    'demo-northstar-product', 'Northstar Labs (fictional)', 'Product Design Intern',
    'Local demo listing. Fictional opportunity used only to preview InternRadar.',
    array['freshman', 'sophomore'], 'listed_years', 'Fictional demo eligibility.',
    'Boston, MA', 'hybrid', 'paid', '$28/hour (fictional)',
    'https://example.org/demo/northstar-product', current_date + 30,
    now(), 'published', true
  ),
  (
    'demo-fieldnote-data', 'Fieldnote (fictional)', 'Data Research Intern',
    'Local demo listing. Fictional opportunity used only to preview InternRadar.',
    '{}', 'unclear', 'The fictional source does not state class-year eligibility.',
    'Remote', 'remote', 'unknown', null,
    'https://example.org/demo/fieldnote-data', null,
    now(), 'published', true
  ),
  (
    'demo-greenhouse-ops', 'Greenhouse Studio (fictional)', 'Operations Intern',
    'Local demo listing. Fictional opportunity used only to preview InternRadar.',
    '{}', 'undergraduates', 'Fictional source says currently enrolled undergraduates.',
    'Chicago, IL', 'onsite', 'unpaid', 'Unpaid (fictional)',
    'https://example.org/demo/greenhouse-ops', current_date + 45,
    now(), 'published', true
  )
on conflict (canonical_source_id) do nothing;