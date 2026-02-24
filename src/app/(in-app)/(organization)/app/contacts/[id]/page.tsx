"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Edit2,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getContact, updateContact, deleteContact } from "@/app/actions/contacts";
import { getDonations } from "@/app/actions/finances";

const STATUS_STYLES: Record<string, string> = {
  member: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  visitor: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  volunteer: "bg-lime-100 text-lime-800 dark:bg-lime-900/20 dark:text-lime-400",
  leader: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  regular_attendee: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  prospect: "bg-orange-100 text-orange-700",
  inactive: "bg-gray-200 text-gray-600",
};

const formatPhone = (phone: string) => {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export default function ContactProfilePage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const [c, d] = await Promise.all([
        getContact(contactId),
        getDonations(undefined as any, contactId),
      ]);
      setContact(c);
      setEditForm(c ?? {});
      setDonations(d ?? []);
    } catch (err) {
      console.error("Failed to load contact:", err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!editForm.firstName || !editForm.lastName) return;
    setSaving(true);
    try {
      await updateContact(contactId, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email ?? null,
        phone: editForm.phone ?? null,
        memberStatus: editForm.memberStatus,
        notes: editForm.notes ?? null,
      });
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error("Failed to update contact:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    await deleteContact(contactId);
    router.push("/app/contacts");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#bbff00]" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground mb-4">Contact not found.</p>
        <Link href="/app/contacts">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Contacts</Button>
        </Link>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`;
  const totalGiving = donations.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

  const fundBreakdown = donations.reduce((acc: Record<string, number>, d: any) => {
    acc[d.fund] = (acc[d.fund] || 0) + Number(d.amount || 0);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/app/contacts" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" />Contacts
          </Link>
          <h1 className="text-3xl font-bold">{fullName}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditForm({ ...contact }); setIsEditing(true); }}>
            <Edit2 className="w-4 h-4 mr-2" />Edit
          </Button>
          <Button variant="outline" className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Avatar + contact info */}
          <Card>
            <CardContent className="pt-6 text-center">
              <div
                className="mx-auto mb-4 w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-[#171717]"
                style={{ background: "linear-gradient(135deg, #c8f542 0%, #a8d435 100%)" }}
              >
                {initials}
              </div>
              <h2 className="font-bold text-lg mb-1">{fullName}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${STATUS_STYLES[contact.memberStatus] ?? "bg-gray-100 text-gray-600"}`}>
                {contact.memberStatus?.replace("_", " ")}
              </span>

              <div className="text-left mt-5 space-y-2.5">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{formatPhone(contact.phone)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Added {new Date(contact.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{contact.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Giving summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Giving Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-1">Total Giving</p>
                <h3 className="text-3xl font-bold">{formatCurrency(totalGiving)}</h3>
                <p className="text-xs text-muted-foreground mt-1">{donations.length} donation{donations.length !== 1 ? "s" : ""}</p>
              </div>
              {Object.entries(fundBreakdown).map(([fund, amount]) => (
                <div key={fund} className="flex justify-between items-center py-2 border-t text-sm">
                  <span className="text-muted-foreground">{fund}</span>
                  <span className="font-semibold">{formatCurrency(amount as number)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column — donation history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Donation History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {donations.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Amount</th>
                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fund</th>
                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Method</th>
                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {donations.map((d: any) => (
                        <tr key={d.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(d.donationDate ?? d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-6 py-4 font-semibold">{formatCurrency(Number(d.amount))}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{d.fund}</span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground capitalize">{d.method}</td>
                          <td className="px-6 py-4 text-muted-foreground">{d.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inline Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Contact</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.firstName || ""} onChange={e => setEditForm((p: any) => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.lastName || ""} onChange={e => setEditForm((p: any) => ({ ...p, lastName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <input type="email" className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.email || ""} onChange={e => setEditForm((p: any) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <input type="tel" className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.phone || ""} onChange={e => setEditForm((p: any) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.memberStatus || "visitor"} onChange={e => setEditForm((p: any) => ({ ...p, memberStatus: e.target.value }))}>
                  <option value="visitor">Visitor</option>
                  <option value="prospect">Prospect</option>
                  <option value="regular_attendee">Regular Attendee</option>
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3} value={editForm.notes || ""} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
