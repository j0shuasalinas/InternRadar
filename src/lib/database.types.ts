export type ProfileRecord = {
  id: string;
  graduation_year: number | null;
  major: string | null;
  skills: string[];
  preferred_locations: string[];
  remote_preference: "any" | "remote" | "hybrid" | "onsite";
  current_class_year: "freshman" | "sophomore" | "junior" | "senior" | "graduate" | null;
  timezone: string;
  onboarding_completed_at: string | null;
};

export type OpportunityRecord = {
  id: string;
  slug: string;
  canonical_source_id: string | null;
  company: string;
  title: string;
  description: string;
  eligible_class_years: string[];
  eligibility_basis: "listed_years" | "undergraduates" | "unclear";
  eligibility_notes: string | null;
  location: string;
  work_mode: "remote" | "hybrid" | "onsite";
  compensation_type: "paid" | "unpaid" | "unknown";
  compensation_details: string | null;
  source_url: string;
  deadline_date: string | null;
  deadline_at: string | null;
  deadline_type: "exact_timestamp" | "date_only" | "rolling" | "not_listed" | "unknown";
  source_posted_date: string | null;
  last_verified_at: string;
  status: "draft" | "published" | "closed";
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type TrackedApplicationRecord = {
  id: string;
  opportunity_id: string;
  status: "saved" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";
  notes: string;
  applied_at: string | null;
  follow_up_date: string | null;
  application_checklist: {
    requirementsReviewed: boolean;
    materialsPrepared: boolean;
    appliedOnSource: boolean;
  };
  experience_examples: string;
  created_at: string;
  updated_at: string;
};

export type TrackedApplicationWithOpportunity = TrackedApplicationRecord & {
  opportunities: Pick<OpportunityRecord, "company" | "title" | "location" | "deadline_date" | "deadline_at" | "deadline_type" | "source_url"> | null;
};

export type ApplicationStatusHistoryRecord = {
  id: string;
  tracked_application_id: string;
  previous_status: TrackedApplicationRecord["status"] | null;
  new_status: TrackedApplicationRecord["status"];
  changed_at: string;
};

export type SavedSearchRecord = {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, string>;
  notify_email: boolean;
  created_at: string;
};

export type OpportunityReportRecord = {
  id: string;
  opportunity_id: string;
  user_id: string;
  reason: "closed" | "inaccurate" | "suspicious" | "other";
  details: string;
  status: "open" | "reviewed" | "resolved";
  created_at: string;
  reviewed_at: string | null;
};

export type OpportunityFeedbackRecord = {
  opportunity_id: string;
  reason: "wrong_year" | "location" | "compensation" | "field" | "requirements" | "other";
  created_at: string;
  opportunities?: Pick<OpportunityRecord, "company" | "title" | "slug"> | null;
};