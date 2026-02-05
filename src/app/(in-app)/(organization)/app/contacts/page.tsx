"use client";
import React, { useState, useEffect } from "react";
import {
  Plus,
  Download,
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import ContactCard from "@/components/shared/ContactCard";
import { Button } from "@/components/ui/button";

// Mock Data for 1:1 Port
const MOCK_CONTACTS = [
  {
    id: 1,
    first_name: "Sarah",
    last_name: "Johnson",
    email: "sarah.j@example.com",
    phone: "555-123-4567",
    member_status: "member",
    created_at: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    first_name: "Michael",
    last_name: "Davis",
    email: "m.davis@example.com",
    phone: "555-987-6543",
    member_status: "visitor",
    created_at: "2024-02-01T14:30:00Z",
  },
  {
    id: 3,
    first_name: "Emily",
    last_name: "White",
    email: "emily.white@test.com",
    phone: "555-456-7890",
    member_status: "volunteer",
    created_at: "2024-02-03T09:15:00Z",
  },
  {
    id: 4,
    first_name: "Robert",
    last_name: "Brown",
    email: "robert.b@example.com",
    phone: "555-222-3333",
    member_status: "leader",
    created_at: "2023-12-10T11:20:00Z",
  },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>(MOCK_CONTACTS);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    member_status: "visitor",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const filteredContacts = contacts.filter((contact) => {
    const fullName =
      `${contact.first_name} ${contact.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      (contact.email && contact.email.toLowerCase().includes(query)) ||
      (contact.phone && contact.phone.includes(query))
    );
  });

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "member":
        return "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400";
      case "visitor":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
      case "volunteer":
        return "bg-lime-100 text-lime-800 dark:bg-lime-900/20 dark:text-lime-400"; // approximating Primary
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
      return `(${digits.slice(0, 3)}) ${digits.slice(
        3,
        6
      )}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleAddContact = async () => {
    // Stub functionality for visual port
    setSaving(true);
    setTimeout(() => {
      const added = {
        id: contacts.length + 1,
        ...newContact,
        created_at: new Date().toISOString(),
      };
      setContacts([added, ...contacts]);
      setShowAddModal(false);
      setNewContact({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        member_status: "visitor",
        notes: "",
      });
      setSaving(false);
      // alert("Contact added (mock)"); 
    }, 1000);
  };

  const handleDeleteContact = (id: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(contacts.filter(c => c.id !== id));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contacts</h2>
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mt-1">
            <ol className="flex items-center gap-1">
              <li>
                <Link href="/app/home" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>People</li>
              <li>/</li>
              <li className="text-foreground font-medium" aria-current="page">
                Contacts
              </li>
            </ol>
          </nav>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter size={14} /> Filter
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={14} /> Export
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} /> Add Contact
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
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
              {loading ? "Loading..." : `${filteredContacts.length} contacts`}
            </span>
            <div className="flex bg-muted/50 rounded-lg p-1 border border-border">
              <button
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-[#bbff00] text-[#1a1d21] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-[#bbff00] text-[#1a1d21] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#bbff00]"></div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery
              ? "No contacts match your search."
              : "No contacts yet. Add your first contact!"}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                id={contact.id}
                name={`${contact.first_name} ${contact.last_name}`}
                email={contact.email}
                phone={formatPhone(contact.phone)}
                status={contact.member_status}
                groups={[]}
                lastActivity={new Date(contact.created_at).toLocaleDateString()}
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
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs text-[#171717]"
                            style={{
                              background:
                                "linear-gradient(135deg, #c8f542 0%, #a8d435 100%)",
                            }}
                          >
                            {contact.first_name[0]}
                            {contact.last_name[0]}
                          </div>
                          <Link
                            href={`/people/contacts/${contact.id}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {contact.first_name} {contact.last_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {contact.email}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatPhone(contact.phone)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${getStatusStyle(
                            contact.member_status
                          )}`}
                        >
                          {contact.member_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            Delete
                          </Button>
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

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h5 className="text-lg font-semibold text-foreground">
                Add Contact
              </h5>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    First Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newContact.first_name}
                    onChange={(e) =>
                      setNewContact({
                        ...newContact,
                        first_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newContact.last_name}
                    onChange={(e) =>
                      setNewContact({
                        ...newContact,
                        last_name: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newContact.email}
                    onChange={(e) =>
                      setNewContact({ ...newContact, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Phone
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newContact.phone}
                    onChange={(e) =>
                      setNewContact({ ...newContact, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={newContact.member_status}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      member_status: e.target.value,
                    })
                  }
                >
                  <option value="visitor">Visitor</option>
                  <option value="member">Member</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="leader">Leader</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
                  value={newContact.notes}
                  onChange={(e) =>
                    setNewContact({ ...newContact, notes: e.target.value })
                  }
                ></textarea>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="gap-2"
              >
                <X size={16} /> Cancel
              </Button>
              <Button
                onClick={handleAddContact}
                disabled={saving}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Check size={16} /> {saving ? "Saving..." : "Add Contact"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
