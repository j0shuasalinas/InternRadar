import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { OpportunityRecord } from "@/lib/database.types";

const batchSize = 500;
const maxPublicListings = 5000;

function publicClient() {
  const { url, key } = getSupabasePublicConfig();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getPublishedOpportunities(): Promise<OpportunityRecord[]> {
  const supabase = publicClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const { data, error, count } = await supabase.from("opportunities")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("is_demo", false)
    .or(`deadline_date.is.null,deadline_date.gte.${today}`)
    .or(`deadline_at.is.null,deadline_at.gte.${now}`)
    .order("last_verified_at", { ascending: false })
    .range(0, batchSize - 1);

  if (error) throw new Error(`Could not load public opportunities: ${error.message}`);
  const total = count ?? data.length;
  if (total > maxPublicListings) {
    throw new Error(`Public SEO routes currently support up to ${maxPublicListings} current listings; found ${total}.`);
  }
  const listings = [...((data ?? []) as unknown as OpportunityRecord[])];
  for (let offset = batchSize; offset < total; offset += batchSize) {
    const { data: page, error: pageError } = await supabase.from("opportunities")
      .select("*")
      .eq("status", "published")
      .eq("is_demo", false)
      .or(`deadline_date.is.null,deadline_date.gte.${today}`)
      .or(`deadline_at.is.null,deadline_at.gte.${now}`)
      .order("last_verified_at", { ascending: false })
      .range(offset, Math.min(offset + batchSize - 1, total - 1));
    if (pageError) throw new Error(`Could not load public opportunities: ${pageError.message}`);
    listings.push(...((page ?? []) as unknown as OpportunityRecord[]));
  }
  return listings;
}

export async function getPublishedOpportunity(slug: string): Promise<OpportunityRecord | null> {
  const supabase = publicClient();
  const { data, error } = await supabase.from("opportunities")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_demo", false)
    .maybeSingle();
  if (error) throw new Error(`Could not load public opportunity: ${error.message}`);
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  if (data.deadline_date && data.deadline_date < today) return null;
  if (data.deadline_at && Date.parse(data.deadline_at) < now) return null;
  return data as unknown as OpportunityRecord;
}
