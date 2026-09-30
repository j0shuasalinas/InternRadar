import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions/auth";

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  return <div className="auth-card">
    <span className="auth-icon"><Mail size={20} /></span>
    <span className="section-label">ACCOUNT RECOVERY</span>
    <h1>Reset your password.</h1>
    <p className="auth-description">We’ll email a link if an account exists for that address.</p>
    {params.error === "configuration" && <p className="form-message form-error" role="alert">Supabase is not configured. Add its public credentials to .env.local.</p>}
    {params.error === "validation" && <p className="form-message form-error" role="alert">Enter a valid email address.</p>}
    {params.message === "sent" ? <p className="form-message form-success" role="status">If that address is registered, a password reset link is on its way.</p> : <form action={requestPasswordResetAction} className="auth-form">
      <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={320} /></label>
      <button className="button button-dark auth-submit" type="submit">Send reset link <ArrowRight size={15} /></button>
    </form>}
    <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>
  </div>;
}