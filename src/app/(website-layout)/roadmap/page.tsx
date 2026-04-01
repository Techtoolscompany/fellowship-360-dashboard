import { Metadata } from "next";
import { WebPageJsonLd } from "next-seo";
import { appConfig } from "@/lib/config";

const roadmapSections = [
  {
    title: "Completed",
    items: [
      "Grace multi-tenant security hardening and policy enforcement",
      "Service template model, role slots, and timeline steps",
      "Service run creation and assignment generation",
      "Waitlist and Contact flows (public form + API + admin surfaces)",
      "Dual-mode automations workspace (template install + visual builder)",
      "Enrollment/re-entry policy engine with broadcast action handoff",
      "Event-driven sequence run logs with compliance controls (quiet hours/caps/opt-out)",
      "Workflow versions with draft/publish/rollback controls",
      "Deterministic emergency auto-escalation path with immediate handoff execution",
      "Automation dead-letter queue with replay processing and backoff scheduling",
      "Automation concurrency and dispatch throttling controls",
      "Daily/weekly ministry ops scheduled automation dispatch",
      "Service-run payroll ledger export and auto-generated post-service recap",
      "Grace knowledge base edit/delete with version history",
      "Workflow analytics dashboard (reply/completion/conversion)",
      "Expanded built-in sequence library (new member 30-day, volunteer onboarding, inactive-member re-engagement, event RSVP reminders)",
      "Weekly finance digest pipeline and reporting normalization",
      "Leadership inbox auto-delivery for weekly finance digest",
      "Finance exception alerts for spikes, recurring failures, and reconciliation mismatches",
      "Voice query support for weekly finance summaries",
      "Grace-first workspace and voice-first entry flow",
      "Approval queue SLA and runtime failure monitoring + alerting",
    ],
  },
  {
    title: "In Progress",
    items: [
      "Unified AI/action audit stream and model cost-latency health dashboard",
      "Authenticated browser journey expansion for deep in-app QA",
    ],
  },
  {
    title: "Up Next",
    items: [
      "Provider health checks with guided remediation",
      "End-to-end QA matrix for launch-critical paths",
    ],
  },
];

export const metadata: Metadata = {
  title: `Roadmap | ${appConfig.projectName}`,
  description: "Track product functionality that is complete, in progress, and next for launch.",
  openGraph: {
    title: `Roadmap | ${appConfig.projectName}`,
    description:
      "Track product functionality that is complete, in progress, and next for launch.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/roadmap`,
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/images/og.png`,
        width: 1200,
        height: 630,
        alt: "Product roadmap",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Roadmap | ${appConfig.projectName}`,
    description:
      "Track product functionality that is complete, in progress, and next for launch.",
    images: [`${process.env.NEXT_PUBLIC_APP_URL}/images/og.png`],
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL}/roadmap`,
  },
};

export default function RoadmapPage() {
  return (
    <article className="py-16">
      <WebPageJsonLd
        useAppDir
        id={`${process.env.NEXT_PUBLIC_APP_URL}/roadmap`}
        title={`Roadmap | ${appConfig.projectName}`}
        description="Track product functionality that is complete, in progress, and next for launch."
        isAccessibleForFree={true}
        publisher={{
          "@type": "Organization",
          name: appConfig.projectName,
          url: process.env.NEXT_PUBLIC_APP_URL,
        }}
      />

      <div className="mx-auto max-w-4xl space-y-12">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
            Product Roadmap
          </h1>
          <p className="text-xl text-muted-foreground">
            Functional delivery status for launch-critical work.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {roadmapSections.map((section) => (
            <section
              key={section.title}
              aria-labelledby={section.title}
              className="rounded-xl border bg-card p-6"
            >
              <h2 id={section.title} className="text-lg font-semibold">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
