import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "InternRadar | Find your next internship",
    template: "%s | InternRadar",
  },
  description: "Find internships you’re eligible for. Track your next step.",
  openGraph: {
    type: "website",
    siteName: "InternRadar",
    title: "Find internships you’re eligible for. Track your next step.",
    description: "Discover opportunities with transparent eligibility and keep every application moving.",
  },
  twitter: {
    card: "summary",
    title: "InternRadar | Find your next internship",
    description: "Find internships you’re eligible for. Track your next step.",
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
