import { useEffect } from "react";

import { SiteFooter } from "~/components/SiteFooter";
import { SiteHeader } from "~/components/SiteHeader";
import { CallToAction } from "~/features/landing/CallToAction";
import { Hero } from "~/features/landing/Hero";
import { InstructorsSection } from "~/features/landing/InstructorsSection";
import { LearningLoop } from "~/features/landing/LearningLoop";
import { ShiftDemo } from "~/features/landing/ShiftDemo";
import { ZonesSection } from "~/features/landing/ZonesSection";
import { loadZoneContent } from "~/features/zones/content.server";

import type { Route } from "./+types/home";

const SECTIONS = [
  { href: "#ca-truc", label: "Một ca trực" },
  { href: "#khu-hoc", label: "Khu học" },
  { href: "#cach-hoc", label: "Cách học" },
  { href: "#giang-vien", label: "Giảng viên" },
] as const;

// Pre-rendered at build time from the backend content seed.
export async function loader() {
  return { zones: await loadZoneContent() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // A free-tier API sleeps when idle; waking it here hides most of the cold start before the
  // visitor opens the campus. Fire and forget: the landing page needs no answer.
  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/health`).catch(() => undefined);
  }, []);

  return (
    <>
      <a
        href="#noi-dung"
        className="sr-only z-50 rounded-sm bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <SiteHeader sections={SECTIONS} />
      <main id="noi-dung">
        <Hero />
        <ShiftDemo />
        <ZonesSection zones={loaderData.zones} />
        <LearningLoop />
        <InstructorsSection />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
