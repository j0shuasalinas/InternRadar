import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { updatePasswordAction } from "@/app/actions/auth";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  return <div className="auth-card">
    <span className="auth-icon"><KeyRound size={20} /></span>
    <span className="section-label">NEW PASSWORD</span>
    <h1>Choose a new password.</h1>
    <p className="auth-description">Use at least 8 characters. This link works only after opening the reset email.</p>
    {params.error === "session" && <p className="form-message form-error" role="alert">Your reset session expired. Request a fresh link.</p>}
    {params.error === "update" && <p className="form-message form-error" role="alert">We couldn’t update the password. Request a new link and try again.</p>}
    {params.error === "validation" && <p className="form-message form-error" role="alert">Passwords must match and contain at least 8 characters.</p>}
    <form action={updatePasswordAction} className="auth-form">
      <label>New password<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      <button className="button button-dark auth-submit" type="submit">Update password <ArrowRight size={15} /></button>
    </form>
    <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>
  </div>;
}