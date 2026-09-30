import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const previewHref = process.env.NODE_ENV === "production" ? "/sign-up" : "/demo";

const errors: Record<string, string> = {
  configuration: "Supabase is not configured yet. Add your project URL and publishable key to .env.local.",
  credentials: "That email and password did not match. Try again.",
  validation: "Enter a valid email and a password with at least 8 characters.",
  callback: "That confirmation link is invalid or expired. Request a fresh email and try again.",
  session: "Your password reset session expired. Request a new reset email.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <div className="auth-card">
    <span className="auth-icon"><LockKeyhole size={20} /></span>
    <span className="section-label">WELCOME BACK</span>
    <h1>Sign in to your radar.</h1>
    <p className="auth-description">Pick up where your search left off.</p>
    {error && <p className="form-message form-error" role="alert">{errors[error] ?? "We could not sign you in. Try again."}</p>}
    {params.message === "password-updated" && <p className="form-message form-success" role="status">Your password is updated. Sign in with the new one.</p>}
    {params.message === "confirmed" && <p className="form-message form-success" role="status">Email confirmed. Complete your student profile to get started.</p>}
    <form action={signInAction} className="auth-form">
      <input type="hidden" name="next" value={typeof params.next === "string" ? params.next : "/dashboard"} />
      <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={320} /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required minLength={8} maxLength={128} /></label>
      <div className="auth-form-options"><Link href="/forgot-password">Forgot password?</Link></div>
      <Button className="button button-dark auth-submit" type="submit">Sign in <ArrowRight size={15} /></Button>
    </form>
    <p className="auth-switch">New to InternRadar? <Link href="/sign-up">Create an account</Link></p>
    <p className="auth-demo-link">Want to look around first? <Link href={previewHref}>{process.env.NODE_ENV === "production" ? "Create an account" : "Open the local demo"}</Link></p>
  </div>;
}