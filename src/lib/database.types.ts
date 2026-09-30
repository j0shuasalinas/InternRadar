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
  created_at: string;
  updated_at: string;
};

export type TrackedApplicationWithOpportunity = TrackedApplicationRecord & {
  opportunities: Pick<OpportunityRecord, "company" | "title" | "location" | "deadline_date" | "deadline_at" | "source_url"> | null;
};