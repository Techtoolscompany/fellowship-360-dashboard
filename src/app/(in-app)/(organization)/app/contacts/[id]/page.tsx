"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import useSWR from "swr";
import { getContactProfile, updateContact, deleteContact } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const fmt$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const fmtDate = (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  d ? new Date(d).toLocaleDateString("en-US", opts ?? { month: "long", day: "numeric", year: "numeric" }) : "—";

const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

const STATUS_CONFIG: Record<string, string> = {
  member:           "Member",
  visitor:          "Visitor",
  prospect:         "Prospect",
  regular_attendee: "Regular Attendee",
  leader:           "Leader",
  inactive:         "Inactive",
};

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{label}</label>
      <input
        type={type}
        className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#84cc16]/20 focus:border-[#84cc16] transition-colors"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{label}</label>
      <select
        className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#84cc16]/20 focus:border-[#84cc16] transition-colors"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function ContactProfilePage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const { organization } = useOrganization();

  const { data: profile, error, isLoading, mutate } = useSWR(
    contactId && organization?.id ? ["contact", contactId, organization.id] : null,
    () => getContactProfile(contactId, organization!.id)
  );

  const loading = isLoading;
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.contact) {
      setEditForm({
        firstName:      profile.contact.firstName ?? "",
        lastName:       profile.contact.lastName ?? "",
        email:          profile.contact.email ?? "",
        phone:          profile.contact.phone ?? "",
        memberStatus:   profile.contact.memberStatus ?? "visitor",
        source:         profile.contact.source ?? "walk_in",
        dateOfBirth:    profile.contact.dateOfBirth
          ? new Date(profile.contact.dateOfBirth).toISOString().split("T")[0] : "",
        firstVisitDate: profile.contact.firstVisitDate
          ? new Date(profile.contact.firstVisitDate).toISOString().split("T")[0] : "",
        notes: profile.contact.notes ?? "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!editForm.firstName || !editForm.lastName) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    try {
      await updateContact(contactId, {
        firstName:    editForm.firstName,
        lastName:     editForm.lastName,
        email:        editForm.email || null,
        phone:        editForm.phone || null,
        memberStatus: editForm.memberStatus as any,
        source:       editForm.source as any,
        notes:        editForm.notes || null,
      });
      toast.success("Contact updated");
      setEditOpen(false);
      await mutate();
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await deleteContact(contactId);
    router.push("/app/contacts");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="material-symbols-outlined text-4xl text-[#84cc16] animate-spin">progress_activity</span>
      </div>
    );
  }

  if (!profile?.contact) {
    return (
      <div className="text-center py-32">
        <p className="text-slate-500 mb-4">Contact not found.</p>
        <Link href="/app/contacts">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Contacts</Button>
        </Link>
      </div>
    );
  }

  const { contact, donations, appointments, volunteer, ministries: contactMinistries } = profile;
  const fullName   = `${contact.firstName} ${contact.lastName}`;
  const initials   = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();
  const statusLabel = STATUS_CONFIG[contact.memberStatus ?? "visitor"] ?? "Visitor";

  const totalGiving = donations.reduce((s, d) => s + Number(d.amount ?? 0), 0);

  const upcomingAppts = appointments.filter(a =>
    new Date(a.dateTime) >= new Date() && a.status !== "cancelled"
  ).slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f6f7f8] dark:bg-[#101922] -m-4 sm:-m-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 font-display">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400">
                  {initials}
                </div>
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{fullName}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#84cc16]/10 text-[#84cc16] capitalize">
                    {statusLabel}
                  </span>
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    Member since {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setEditOpen(true)}
                className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
               >
                 Edit Profile
              </button>
              <button className="px-5 py-2.5 rounded-lg bg-[#84cc16] text-white font-semibold text-sm hover:bg-[#84cc16]/90 transition-colors shadow-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">mail</span>
                Message
              </button>
            </div>
          </div>
          
          {/* Profile Tabs */}
          <div className="flex gap-8 mt-10">
            <a className="pb-4 text-[#84cc16] border-b-2 border-[#84cc16] font-semibold text-sm" href="#">Overview</a>
            <a className="pb-4 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm" href="#">Giving</a>
            <a className="pb-4 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm" href="#">Spiritual Growth</a>
            <a className="pb-4 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm" href="#">Volunteer</a>
            <a className="pb-4 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm" href="#">Groups</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 font-display">
        {/* Left Column: Info & Details */}
        <div className="lg:col-span-1 space-y-8">
          {/* Contact Information */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Contact Information</h3>
              <button onClick={() => setEditOpen(true)} className="text-[#84cc16] text-xs font-bold hover:underline">UPDATE</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                  <span className="material-symbols-outlined text-base">email</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email Address</p>
                  <p className="text-sm font-medium">{contact.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                  <span className="material-symbols-outlined text-base">call</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone Number</p>
                  <p className="text-sm font-medium">{contact.phone ? fmtPhone(contact.phone) : "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                  <span className="material-symbols-outlined text-base">event</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Join Date</p>
                  <p className="text-sm font-medium">{contact.createdAt ? fmtDate(contact.createdAt) : "—"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Upcoming Events */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {upcomingAppts.length > 0 ? (
                upcomingAppts.map(appt => (
                  <div key={appt.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#84cc16]/10 flex flex-col items-center justify-center text-[#84cc16] shrink-0">
                      <span className="text-[10px] font-bold uppercase">{new Date(appt.dateTime).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{new Date(appt.dateTime).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{appt.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(appt.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} • {appt.type || "Event"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#84cc16]/10 flex flex-col items-center justify-center text-[#84cc16] shrink-0">
                      <span className="text-[10px] font-bold uppercase">Oct</span>
                      <span className="text-lg font-bold leading-none">24</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">New Members Dinner</p>
                      <p className="text-xs text-slate-500">6:30 PM • Fellowship Hall</p>
                    </div>
                </div>
              )}
            </div>
            <button className="w-full mt-6 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">View All Events</button>
          </section>
        </div>

        {/* Right Column: Dashboard Sections */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Giving & Stewardship */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-xl">Giving & Stewardship</h3>
                <p className="text-sm text-slate-500">Annual contribution summary</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Given</p>
                  <p className="text-2xl font-bold text-[#84cc16]">{fmt$(totalGiving)}</p>
                </div>
                <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-slate-500">download</span>
                </button>
              </div>
            </div>
            
            {/* Monthly giving bars — last 12 months from real data */}
            {(() => {
              const now = new Date();
              const months = Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
                return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("default", { month: "short" }) };
              });
              const totals = months.map(({ year, month }) =>
                donations.reduce((sum, d) => {
                  const dd = new Date(d.date ?? d.createdAt);
                  return dd.getFullYear() === year && dd.getMonth() === month ? sum + Number(d.amount ?? 0) : sum;
                }, 0)
              );
              const max = Math.max(...totals, 1);
              return (
                <div className="grid grid-cols-12 gap-2 h-32 items-end mb-2">
                  {totals.map((amt, i) => {
                    const pct = Math.max(amt > 0 ? Math.round((amt / max) * 95) : 0, amt > 0 ? 4 : 0);
                    return (
                      <div key={i} className="relative group flex flex-col items-center justify-end h-full">
                        <div
                          className={`w-full rounded-t-sm transition-colors ${amt > 0 ? "bg-[#84cc16]/60 hover:bg-[#84cc16]" : "bg-slate-100 dark:bg-slate-800"}`}
                          style={{ height: `${pct}%` }}
                        />
                        {amt > 0 && (
                          <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                            {fmt$(amt)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="grid grid-cols-12 gap-2 mb-8">
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1);
                return <div key={i} className="text-[9px] text-slate-400 text-center">{d.toLocaleString("default", { month: "short" })}</div>;
              })}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Fund</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {donations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-slate-400">No donations recorded yet</td>
                    </tr>
                  ) : (
                    donations.slice(0, 5).map(d => (
                       <tr key={d.id}>
                         <td className="py-4">{fmtDate(d.date ?? d.createdAt, {month: 'short', day: '2-digit', year: 'numeric'})}</td>
                         <td className="py-4">{d.fund || "General Offering"}</td>
                         <td className="py-4 flex items-center gap-2 capitalize">
                           <span className="material-symbols-outlined text-sm">{d.method?.includes("cash") ? "payments" : "credit_card"}</span> {d.method?.replace(/_/g, " ") || "Online"}
                         </td>
                         <td className="py-4 text-right font-bold">{fmt$(Number(d.amount))}</td>
                       </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          
          {/* Ministries */}
          {contactMinistries && contactMinistries.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#84cc16]">groups</span>
                Ministries
              </h3>
              <div className="space-y-3">
                {contactMinistries.map(({ membership, ministry }) => (
                  <div key={membership.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#84cc16]/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-[#84cc16]">church</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{ministry.name}</p>
                        {ministry.meetingDay && (
                          <p className="text-xs text-slate-500">
                            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][Number(ministry.meetingDay)] ?? ministry.meetingDay}
                            {ministry.meetingTime ? ` @ ${ministry.meetingTime}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#84cc16]/10 text-[#84cc16]">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Spiritual Growth */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#84cc16]">auto_stories</span>
                Spiritual Growth
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Current Study</p>
                  <div className="p-3 bg-[#84cc16]/5 rounded-lg border border-[#84cc16]/10">
                    <p className="text-sm font-bold">Foundations of Faith</p>
                    <p className="text-xs text-slate-500">6 of 12 Lessons Completed</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2">
                      <div className="bg-[#84cc16] h-1.5 rounded-full w-1/2"></div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Small Groups</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-500">groups</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">Young Professionals</p>
                      <p className="text-xs text-slate-500">Meets Tuesdays @ 7 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Volunteer Roles */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#84cc16]">volunteer_activism</span>
                Volunteer Roles
              </h3>
              <div className="space-y-4 flex-1">
                {volunteer ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400">meeting_room</span>
                      <span className="text-sm font-medium">{volunteer.role || "Greeter Team"}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">{volunteer.status || "ACTIVE"}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400">meeting_room</span>
                      <span className="text-sm font-medium">Greeter Team</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">ACTIVE</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">coffee</span>
                    <span className="text-sm font-medium">Hospitality</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">PENDING</span>
                </div>
              </div>
              <button className="w-full text-center text-[#84cc16] text-sm font-bold py-2 mt-2 hover:bg-[#84cc16]/5 rounded-lg transition-colors">
                Apply for New Role
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-0 font-display">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Profile</h2>
            <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
               <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name *" value={editForm.firstName ?? ""} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} />
              <Field label="Last Name *"  value={editForm.lastName  ?? ""} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} />
            </div>
            
            <div className="space-y-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">Contact</h4>
               <Field label="Email Address" type="email" value={editForm.email ?? ""}  onChange={v => setEditForm(p => ({ ...p, email: v }))} />
               <Field label="Phone Number"  type="tel"   value={editForm.phone ?? ""}  onChange={v => setEditForm(p => ({ ...p, phone: v }))} />
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">Status</h4>
               <SelectField
                  label="Member Status"
                  value={editForm.memberStatus ?? "visitor"}
                  onChange={v => setEditForm(p => ({ ...p, memberStatus: v }))}
                  options={[
                    { value: "visitor",          label: "Visitor" },
                    { value: "prospect",         label: "Prospect" },
                    { value: "regular_attendee", label: "Regular Attendee" },
                    { value: "member",           label: "Member" },
                    { value: "leader",           label: "Leader" },
                    { value: "inactive",         label: "Inactive" },
                  ]}
               />
               <SelectField
                  label="Source"
                  value={editForm.source ?? "walk_in"}
                  onChange={v => setEditForm(p => ({ ...p, source: v }))}
                  options={[
                    { value: "walk_in",      label: "Walk-in" },
                    { value: "website",      label: "Website" },
                    { value: "referral",     label: "Referral" },
                    { value: "event",        label: "Event" },
                    { value: "social_media", label: "Social Media" },
                    { value: "other",        label: "Other" },
                  ]}
               />
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">Dates</h4>
               <div className="grid grid-cols-2 gap-4">
                 <Field label="Date of Birth"   type="date" value={editForm.dateOfBirth    ?? ""} onChange={v => setEditForm(p => ({ ...p, dateOfBirth: v }))} />
                 <Field label="First Visit"     type="date" value={editForm.firstVisitDate ?? ""} onChange={v => setEditForm(p => ({ ...p, firstVisitDate: v }))} />
               </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">Notes</h4>
               <div>
                 <textarea
                   className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-3 text-sm bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#84cc16]/20 focus:border-[#84cc16] transition-colors resize-none"
                   rows={4}
                   value={editForm.notes ?? ""}
                   onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                   placeholder="Add internal notes about this contact..."
                 />
               </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky bottom-0 flex gap-3">
            <Button variant="outline" className="flex-1 font-bold shadow-sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#84cc16] text-white hover:bg-[#84cc16]/90 font-bold shadow-sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Profile
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
