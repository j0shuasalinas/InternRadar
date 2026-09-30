"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { preferencesSchema } from "@/lib/domain";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email().trim().max(320),
  password: z.string().min(8).max(128),
});

function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}

function requireConfiguration(destination: string): void {
  if (!isSupabaseConfigured()) redirect(`${destination}?error=configuration`);
}

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signInAction(formData: FormData): Promise<void> {
  requireConfiguration("/sign-in");
  const credentials = parseCredentials(formData);
  if (!credentials.success) redirect("/sign-in?error=validation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error) redirect("/sign-in?error=credentials");
  redirect(safeNextPath(formData.get("next")));
}

export async function signUpAction(formData: FormData): Promise<void> {
  requireConfiguration("/sign-up");
  const credentials = parseCredentials(formData);
  if (!credentials.success) redirect("/sign-up?error=validation");

  const supabase = await createSupabaseServerClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    ...credentials.data,
    options: { emailRedirectTo: `${baseUrl}/auth/callback?next=%2Fonboarding` },
  });
  if (error) redirect("/sign-up?error=signup");
  redirect("/sign-up?message=confirmation");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  requireConfiguration("/forgot-password");
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) redirect("/forgot-password?error=validation");

  const supabase = await createSupabaseServerClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${baseUrl}/auth/callback?next=%2Freset-password`,
  });
  redirect("/forgot-password?message=sent");
}

export async function updatePasswordAction(formData: FormData): Promise<void> {
  requireConfiguration("/reset-password");
  const password = z.string().min(8).max(128).safeParse(formData.get("password"));
  const confirmation = formData.get("confirmPassword");
  if (!password.success || password.data !== confirmation) redirect("/reset-password?error=validation");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?error=session");
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/reset-password?error=update");
  redirect("/sign-in?message=password-updated");
}

export async function saveOnboardingAction(formData: FormData): Promise<void> {
  requireConfiguration("/onboarding");
  const parsed = preferencesSchema.safeParse({
    graduationYear: formData.get("graduationYear"),
    major: formData.get("major"),
    skills: String(formData.get("skills") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    preferredLocations: String(formData.get("preferredLocations") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    remotePreference: formData.get("remotePreference"),
    currentClassYear: formData.get("currentClassYear"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) redirect("/onboarding?error=validation");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { error } = await supabase.from("profiles").update({
    graduation_year: parsed.data.graduationYear,
    major: parsed.data.major,
    skills: parsed.data.skills,
    preferred_locations: parsed.data.preferredLocations,
    remote_preference: parsed.data.remotePreference,
    current_class_year: parsed.data.currentClassYear,
    timezone: parsed.data.timezone,
    onboarding_completed_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) redirect("/onboarding?error=save");
  redirect("/dashboard");
}

export async function saveNotificationSettingsAction(formData: FormData): Promise<void> {
  requireConfiguration("/settings");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.from("notification_settings").update({
    weekly_digest_enabled: formData.get("weeklyDigest") === "on",
    deadline_reminders_enabled: formData.get("deadlineReminders") === "on",
  }).eq("user_id", user.id);
  if (error) redirect("/settings?error=save");
  redirect("/settings?message=saved");
}