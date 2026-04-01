"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import useSWR from "swr";
import {
  getContactProfile,
  updateContact,
  deleteContact,
  archiveContact,
  restoreContact,
} from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  MEMBER_STATUS_VALUES,
  getMemberStatusLabel,
} from "@/lib/contacts/member-status";

const fmt$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const fmtDate = (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  d ? new Date(d).toLocaleDateString("en-US", opts ?? { month: "long", day: "numeric", year: "numeric" }) : "—";

const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

const STATUS_CONFIG: Record<string, string> = {
  member: getMemberStatusLabel("member"),
  visitor: getMemberStatusLabel("visitor"),
  prospect: getMemberStatusLabel("prospect"),
  regular_attendee: getMemberStatusLabel("regular_attendee"),
  leader: getMemberStatusLabel("leader"),
  inactive: getMemberStatusLabel("inactive"),
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
  const [statusSaving, setStatusSaving] = useState(false);

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
    try {
      await deleteContact(contactId);
      toast.success("Contact deleted");
      router.push("/app/contacts");
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast.error("Failed to delete contact");
    }
  };

  const handleArchiveToggle = async () => {
    const currentlyInactive = profile?.contact?.memberStatus === "inactive";
    const confirmed = confirm(
      currentlyInactive
        ? "Restore this contact to active status?"
        : "Archive this contact? You can restore it later."
    );
    if (!confirmed) return;

    setStatusSaving(true);
    try {
      if (currentlyInactive) {
        await restoreContact(contactId, "visitor");
        toast.success("Contact restored");
      } else {
        await archiveContact(contactId);
        toast.success("Contact archived");
      }
      await mutate();
    } catch (error) {
      console.error("Failed to update contact status:", error);
      toast.error("Failed to update contact status");
    } finally {
      setStatusSaving(false);
    }
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

  const {
    contact,
    donations,
    appointments,
    prayer,
    volunteer,
    shifts,
    ministries: contactMinistries,
  } = profile;
  const fullName   = `${contact.firstName} ${contact.lastName}`;
  const initials   = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();
  const statusLabel = STATUS_CONFIG[contact.memberStatus ?? "visitor"] ?? "Visitor";

  const totalGiving = donations.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const totalVolunteerHours = shifts.reduce(
    (sum, shift) => sum + Number(shift.hours ?? 0),
    0
  );
  const openPrayerCount = prayer.filter((row) => row.status !== "answered").length;
  const answeredPrayerCount = prayer.filter((row) => row.status === "answered").length;

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
              <button
                onClick={handleArchiveToggle}
                disabled={statusSaving}
                className="px-5 py-2.5 rounded-lg bg-[#84cc16] text-white font-semibold text-sm hover:bg-[#84cc16]/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {statusSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">
                    {contact.memberStatus === "inactive" ? "unarchive" : "archive"}
                  </span>
                )}
                {contact.memberStatus === "inactive" ? "Restore" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 font-display">
        <div className="lg:col-span-1 space-y-8">
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
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                  <span className="material-symbols-outlined text-base">flag</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Source</p>
                  <p className="text-sm font-medium capitalize">{(contact.source ?? "walk_in").replaceAll("_", " ")}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Upcoming Appointments</h3>
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
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500">
                  No upcoming appointments.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-8">
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
              </div>
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

          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#84cc16]">groups</span>
              Ministries
            </h3>
            {contactMinistries && contactMinistries.length > 0 ? (
              <div className="space-y-3">
                {contactMinistries.map(({ membership, ministry }) => (
                  <div key={membership.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#84cc16]/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-[#84cc16]">church</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{ministry.name}</p>
                        {(ministry.meetingDay || ministry.meetingTime) ? (
                          <p className="text-xs text-slate-500">
                            {[ministry.meetingDay, ministry.meetingTime].filter(Boolean).join(" @ ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#84cc16]/10 text-[#84cc16]">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No ministry memberships yet.</p>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#84cc16]">volunteer_activism</span>
                Volunteer Summary
              </h3>
              {volunteer ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{volunteer.role || "Volunteer"}</p>
                    <span className="text-xs font-bold uppercase text-emerald-600">{volunteer.status}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-600 dark:text-slate-300">
                    <p>Total logged hours: <span className="font-semibold">{totalVolunteerHours.toFixed(1)}</span></p>
                    <p>Last shift: <span className="font-semibold">{shifts[0] ? fmtDate(shifts[0].date, { month: "short", day: "numeric", year: "numeric" }) : "No shifts logged"}</span></p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No volunteer role assigned.</p>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#84cc16]">favorite</span>
                Prayer Requests
              </h3>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Open</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{openPrayerCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Answered</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{answeredPrayerCount}</p>
                </div>
              </div>
              {prayer.length > 0 ? (
                <div className="space-y-2">
                  {prayer.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <p className="text-xs text-slate-500">{fmtDate(request.createdAt, { month: "short", day: "numeric", year: "numeric" })}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{request.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No prayer requests recorded.</p>
              )}
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
                  options={MEMBER_STATUS_VALUES.map((status) => ({
                    value: status,
                    label: getMemberStatusLabel(status),
                  }))}
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
          
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky bottom-0 grid grid-cols-3 gap-3">
            <Button
              variant="destructive"
              className="font-bold shadow-sm"
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button variant="outline" className="font-bold shadow-sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-[#84cc16] text-white hover:bg-[#84cc16]/90 font-bold shadow-sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
