import type { ReactNode } from "react";
import WorkspaceShell from "@/components/workspace-shell";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from("admin_members").select("user_id").eq("user_id", user.id).maybeSingle();
  return <WorkspaceShell email={user.email ?? "Account"} isAdmin={Boolean(membership)}>{children}</WorkspaceShell>;
}