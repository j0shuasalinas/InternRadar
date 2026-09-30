import Link from "next/link";
import { ArrowRight, UserRoundPlus } from "lucide-react";
import { signUpAction } from "@/app/actions/auth";

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  return <div className="auth-card">
    <span className="auth-icon"><UserRoundPlus size={20} /></span>
    <span className="section-label">START WITH YOUR FIT</span>
    <h1>Make your search yours.</h1>
    <p className="auth-description">Create an account, then tell us what year you are and what you want to explore.</p>
    {params.error === "configuration" && <p className="form-message form-error" role="alert">Supabase is not configured yet. Add your project URL and publishable key to .env.local.</p>}
    {params.error && params.error !== "configuration" && <p className="form-message form-error" role="alert">We could not create that account. Check your details and try again.</p>}
    {params.message === "confirmation" ? <div className="confirmation-message" role="status"><strong>Check your inbox.</strong><p>If the address can be registered, Supabase will send a confirmation link. Follow it to finish setting up your profile.</p><Link href="/sign-in">Return to sign in <ArrowRight size={14} /></Link></div> : <form action={signUpAction} className="auth-form">
      <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={320} /></label>
      <label>Password<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} /><small>At least 8 characters.</small></label>
      <button className="button button-blue auth-submit" type="submit">Create your account <ArrowRight size={15} /></button>
      <p className="auth-legal">By continuing, you agree to use InternRadar listings as a starting point and verify details with the original source.</p>
    </form>}
    <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
  </div>;
}