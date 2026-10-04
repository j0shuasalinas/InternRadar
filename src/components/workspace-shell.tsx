import Link from "next/link";
import { Bell, BookOpenText, BriefcaseBusiness, Compass, LayoutDashboard, LogOut, Radar, Settings2, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/toolkit", label: "Student toolkit", icon: BookOpenText },
  { href: "/settings", label: "Preferences", icon: Settings2 },
];

export default function WorkspaceShell({ children, email, isAdmin }: { children: React.ReactNode; email: string; isAdmin: boolean }) {
  return <div className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link className="brand-lockup" href="/"><span className="brand-mark"><Radar size={18} /></span><span>intern<span className="brand-light">radar</span></span></Link>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        {links.map(({ href, label, icon: Icon }) => <Link className="workspace-nav-item" href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}
        {isAdmin && <Link className="workspace-nav-item" href="/admin"><ShieldCheck size={17} /><span>Opportunity admin</span></Link>}
      </nav>
      <div className="sidebar-spacer" />
      <div className="demo-note"><span className="demo-note-icon"><Bell size={15} /></span><div><strong>Your alerts</strong><p>Manage digest and deadline reminders in preferences.</p></div></div>
      <form action={signOutAction}><button className="sidebar-signup sign-out-button" type="submit"><span><LogOut size={14} /> Sign out</span><span className="email-short">{email}</span></button></form>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div className="mobile-brand"><Radar size={19} /> intern<span>radar</span></div><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Internship search</strong></div><span className="signed-in-email">{email}</span></header>
      <main className="workspace-content">{children}</main>
    </div>
  </div>;
}