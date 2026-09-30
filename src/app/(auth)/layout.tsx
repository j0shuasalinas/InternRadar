import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-shell">
    <header className="auth-header"><Link href="/" className="brand-lockup"><span className="brand-mark"><Radar size={18} /></span><span>intern<span className="brand-light">radar</span></span></Link><Link href="/" className="auth-back"><ArrowLeft size={14} /> Back to home</Link></header>
    <section className="auth-content">{children}</section>
    <footer className="auth-footer">InternRadar helps early-career students take a clearer next step.</footer>
  </main>;
}