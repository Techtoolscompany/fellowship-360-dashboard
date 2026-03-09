"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users, UsersRound, Calendar, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { getMinistryMembers, addMinistryMember, removeMinistryMember } from "@/app/actions/ministries";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";

interface MinistryMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministryId: string | null;
  ministryName: string;
}

const addMemberSchema = z.object({
  contactId: z.string().min(1, "Please select a person"),
  role: z.string().min(1, "Role is required"),
});

export function MinistryMembersSheet({
  open,
  onOpenChange,
  ministryId,
  ministryName,
}: MinistryMembersSheetProps) {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<z.infer<typeof addMemberSchema>>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      contactId: "",
      role: "Member",
    },
  });

  const fetchMembersAndContacts = async () => {
    if (!ministryId || !organization?.id) return;
    setLoading(true);
    try {
      const [membersData, contactsData] = await Promise.all([
        getMinistryMembers(ministryId),
        getContacts(organization.id),
      ]);
      setMembers(membersData as any[]);
      setContacts(contactsData.contacts as any[]);
    } catch (error) {
      console.error("Failed to load ministry data:", error);
      toast.error("Failed to load ministry members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembersAndContacts();
      setShowAddForm(false);
      form.reset();
    }
  }, [open, ministryId, organization?.id]);

  const handleAddMember = async (values: z.infer<typeof addMemberSchema>) => {
    if (!ministryId) return;
    try {
      await addMinistryMember(ministryId, values.contactId, values.role);
      toast.success("Member added successfully");
      setShowAddForm(false);
      form.reset();
      fetchMembersAndContacts();
    } catch (error) {
      console.error("Failed to add member:", error);
      toast.error("Failed to add member. They may already be in this ministry.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMinistryMember(memberId);
      toast.success("Member removed");
      fetchMembersAndContacts();
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error("Failed to remove member");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-0 border-l border-slate-200 dark:border-slate-800">
        
        {/* Sticky Header Hero Section */}
        <div className="sticky top-0 z-10">
          <div className="h-32 bg-gradient-to-r from-lime-500 to-lime-500/60 relative">
             <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 pb-6 pt-4 relative shadow-sm">
             <div className="flex justify-between items-end -mt-12 mb-4 relative z-20">
               <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 shadow-md border-4 border-slate-50 dark:border-slate-950 flex items-center justify-center text-lime-500">
                  <UsersRound className="w-10 h-10" />
               </div>
               {!showAddForm && (
                 <Button 
                   className="bg-lime-500 text-slate-950 hover:bg-lime-400 font-bold shadow-sm"
                   onClick={() => setShowAddForm(true)}
                 >
                   <Plus className="w-4 h-4 mr-1.5" /> Add Member
                 </Button>
               )}
             </div>
             
             <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{ministryName}</h2>
                <div className="flex items-center gap-4 mt-2">
                   <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{members.length} Members</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {showAddForm && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-lime-500"></div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                 <Plus className="w-5 h-5 text-lime-500" />
                 Add New Member
              </h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddMember)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wide">Person</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-lime-500/20 focus:border-lime-500">
                              <SelectValue placeholder="Select a person" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.firstName} {contact.lastName} {contact.email ? `(${contact.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wide">Role</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Leader, Volunteer, Member" 
                            {...field} 
                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-lime-500/20 focus:border-lime-500" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                    <Button type="button" variant="outline" className="font-semibold shadow-sm" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-lime-500 text-slate-950 hover:bg-lime-400 font-bold shadow-sm">
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add to Ministry
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                 <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wide">Directory</h3>
             </div>
             
             {loading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center p-12 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                     <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-500 font-medium">No members found.</p>
                  <p className="text-sm text-slate-400 mt-1">Add folks to get started.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((row) => (
                    <div key={row.member.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-slate-100 dark:border-slate-800">
                          <AvatarImage src={row.contact?.avatarUrl || ''} />
                          <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                            {row.contact?.firstName?.[0]}
                            {row.contact?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {row.contact?.firstName} {row.contact?.lastName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-lime-500/10 text-lime-600 dark:text-lime-400">
                              {row.member.role || "Member"}
                            </span>
                            {row.contact?.email && <p className="text-xs text-slate-500 truncate max-w-[150px]">{row.contact.email}</p>}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (confirm("Remove this member?")) {
                             handleRemoveMember(row.member.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </div>
          
        </div>
      </SheetContent>
    </Sheet>
  );
}
