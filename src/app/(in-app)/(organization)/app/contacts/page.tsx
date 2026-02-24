"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Download,
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import ContactCard from "@/components/shared/ContactCard";
import { CreateContactDialog } from "@/components/dialogs/CreateContactDialog";
import { Button } from "@/components/ui/button";
import useOrganization from "@/lib/organizations/useOrganization";
import { getContacts, createContact, deleteContact } from "@/app/actions/contacts";

export default function ContactsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState("list");

  const fetchContacts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getContacts(orgId, searchQuery ? { search: searchQuery } : undefined);
      setContacts(data);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, searchQuery]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "member":
        return "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400";
      case "visitor":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
      case "volunteer":
        return "bg-lime-100 text-lime-800 dark:bg-lime-900/20 dark:text-lime-400";
      case "leader":
        return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      try {
        await deleteContact(id);
        await fetchContacts();
      } catch (err) {
        console.error("Failed to delete contact:", err);
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contacts</h2>
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mt-1">
            <ol className="flex items-center gap-1">
              <li><Link href="/app/home" className="hover:text-primary">Home</Link></li>
              <li>/</li>
              <li>People</li>
              <li>/</li>
              <li className="text-foreground font-medium" aria-current="page">Contacts</li>
            </ol>
          </nav>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Filter size={14} /> Filter</Button>
          <Button variant="outline" size="sm" className="gap-2"><Download size={14} /> Export</Button>
          <CreateContactDialog 
            open={showAddModal} 
            onOpenChange={setShowAddModal} 
            onSuccess={fetchContacts}
          >
            <Button size="sm" className="gap-2 bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]">
              <Plus size={14} /> Add Contact
            </Button>
          </CreateContactDialog>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">
              {loading ? "Loading..." : `${contacts.length} contacts`}
            </span>
            <div className="flex bg-muted/50 rounded-lg p-1 border border-border">
              <button className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-[#bbff00] text-[#1a1d21] shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("grid")}>
                <LayoutGrid size={16} />
              </button>
              <button className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-[#bbff00] text-[#1a1d21] shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")}>
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Loading contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No contacts match your search." : "No contacts yet. Add your first contact!"}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                id={contact.id}
                name={`${contact.firstName} ${contact.lastName}`}
                email={contact.email}
                phone={formatPhone(contact.phone)}
                status={contact.memberStatus}
                groups={[]}
                lastActivity={new Date(contact.createdAt).toLocaleDateString()}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Phone</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Added</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs text-[#171717]" style={{ background: "linear-gradient(135deg, #c8f542 0%, #a8d435 100%)" }}>
                            {contact.firstName?.[0]}{contact.lastName?.[0]}
                          </div>
                          <Link href={`/people/contacts/${contact.id}`} className="font-semibold text-foreground hover:underline">
                            {contact.firstName} {contact.lastName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{contact.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatPhone(contact.phone)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${getStatusStyle(contact.memberStatus)}`}>
                          {contact.memberStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">View</Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteContact(contact.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
