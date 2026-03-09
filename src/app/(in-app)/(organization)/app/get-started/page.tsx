"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import {
  Loader2,
} from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getContactCount } from "@/app/actions/contacts";
import { getConversations } from "@/app/actions/communications";
import { getTasks } from "@/app/actions/tasks";
import { getAppointments } from "@/app/actions/operations";

type SetupMetrics = {
  contacts: number;
  conversations: number;
  tasks: number;
  appointments: number;
  smsActive: boolean;
};

export default function GetStartedPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SetupMetrics>({
    contacts: 0,
    conversations: 0,
    tasks: 0,
    appointments: 0,
    smsActive: false,
  });

  const fetchSetupState = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { getAssignedSmsDevice } = await import("@/app/actions/sms");
      const [contacts, conversations, tasks, appointments, smsDevice] = await Promise.all([
        getContactCount(orgId),
        getConversations(orgId),
        getTasks(orgId),
        getAppointments(orgId),
        getAssignedSmsDevice(orgId),
      ]);

      setMetrics({
        contacts: Number(contacts ?? 0),
        conversations: conversations.length,
        tasks: tasks.length,
        appointments: appointments.length,
        smsActive: !!smsDevice?.isActive,
      });
    } catch (error) {
      console.error("Failed to load setup metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSetupState();
  }, [fetchSetupState]);

  const setupSteps = useMemo(
    () => [
      {
        key: "profile",
        title: "Confirm Organization Profile",
        description: "Add your organization name, team, and settings.",
        done: Boolean(organization?.name),
        href: "/app/settings",
        cta: "Open Settings",
      },
      {
        key: "contacts",
        title: "Add Your First Contacts",
        description: "Import CSV or add contacts manually to activate your workspace.",
        done: metrics.contacts > 0,
        href: "/app/contacts",
        cta: "Add Contacts",
      },
      {
        key: "conversation",
        title: "Start First Conversation",
        description: "Use Conversations to send your first outreach message.",
        done: metrics.conversations > 0,
        href: "/app/conversations",
        cta: "Open Conversations",
      },
      {
        key: "task",
        title: "Create First Task",
        description: "Assign your first follow-up task so your team can execute.",
        done: metrics.tasks > 0,
        href: "/app/tasks",
        cta: "Create Task",
      },
      {
        key: "appointment",
        title: "Schedule First Appointment",
        description: "Book one appointment to validate your calendar workflow.",
        done: metrics.appointments > 0,
        href: "/app/appointments",
        cta: "Schedule Appointment",
      },
      {
        key: "sms-integration",
        title: "Confirm SMS Gateway",
        description: "Ensure your agency-managed TextBee Android device is assigned and strictly active.",
        done: metrics.smsActive,
        href: "/app/settings/integrations",
        cta: "View Integrations",
      },
    ],
    [organization?.name, metrics]
  );

  const completed = setupSteps.filter((step) => step.done).length;
  const completionPercent = Math.round((completed / setupSteps.length) * 100);
  const nextStep = setupSteps.find((step) => !step.done) ?? null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="h-48 relative rounded-3xl overflow-hidden group">
        <div className="absolute inset-0 bg-slate-900" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent p-10 flex flex-col justify-center">
          <span className="inline-block px-3 py-1 bg-[#84cc16] text-slate-950 text-[10px] font-black rounded w-max uppercase tracking-wider mb-4">Readiness</span>
          <h1 className="text-3xl font-black text-white mb-2">Workspace Launch Status</h1>
          <div className="flex items-center gap-4 max-w-xl">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#84cc16] transition-all" style={{ width: `${completionPercent}%` }}></div>
            </div>
            <span className="text-white font-bold">{completionPercent}%</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/50">
          <Loader2 className="h-6 w-6 animate-spin text-[#84cc16]" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {setupSteps.map((step) => (
              <div key={step.key} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-[#84cc16]/20 text-[#84cc16]' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {step.done ? 'check' : 'pending'}
                    </span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{step.title}</h5>
                    <p className="text-xs text-slate-500 leading-snug">{step.description}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                  <Link href={step.href} className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1">
                    {step.done ? 'Review' : step.cta} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MiniCard label="Contacts" value={metrics.contacts} icon="groups" href="/app/contacts" />
            <MiniCard label="Conversations" value={metrics.conversations} icon="forum" href="/app/conversations" />
            <MiniCard label="Tasks" value={metrics.tasks} icon="check_box" href="/app/tasks" />
            <MiniCard label="Appointments" value={metrics.appointments} icon="event" href="/app/appointments" />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hover:-translate-y-1 transition-all h-full group"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="material-symbols-outlined text-[#84cc16] text-[20px]">{icon}</span>
        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-[18px]">open_in_new</span>
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
    </Link>
  );
}
