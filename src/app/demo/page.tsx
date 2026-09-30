import DemoWorkspace from "@/app/demo/workspace";
import { demoOpportunities } from "@/lib/demo/opportunities";
import { notFound } from "next/navigation";

export default function DemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DemoWorkspace opportunities={demoOpportunities} />;
}