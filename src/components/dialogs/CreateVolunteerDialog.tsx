"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createVolunteer } from "@/app/actions/operations";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ChurchContact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

const COMMON_ROLES = [
  "Greeter",
  "Usher",
  "Worship Team",
  "Tech/Production",
  "Children's Ministry",
  "Youth Ministry",
  "Café/Hospitality",
  "Security",
  "Other"
];

const formSchema = z.object({
  contactId: z.string().min(1, "Please select a contact"),
  role: z.string().min(1, "Role is required"),
  status: z.enum(["active", "inactive", "pending"]),
  notes: z.string().optional(),
});

interface CreateVolunteerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function CreateVolunteerDialog({
  open,
  onOpenChange,
  onSuccess,
  children,
}: CreateVolunteerDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ChurchContact[]>([]);
  const [customRole, setCustomRole] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactId: "",
      role: "",
      status: "active",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open || !organization?.id) {
      return;
    }

    getContacts(organization.id)
      .then((data) => setContacts(data.contacts))
      .catch((error) => {
        console.error("Failed to load contacts:", error);
        toast.error("Failed to load contacts for volunteer selection");
      });
  }, [open, organization?.id]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization?.id) {
      return;
    }

    setLoading(true);
    try {
      await createVolunteer({
        contactId: values.contactId,
        role: values.role,
        status: values.status,
        organizationId: organization.id,
      });

      form.reset({
        contactId: "",
        role: "",
        status: "active",
        notes: "",
      });
      setCustomRole(false);
      toast.success("Volunteer added successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create volunteer:", error);
      toast.error("Failed to add volunteer. They may already be a volunteer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Volunteer</DialogTitle>
          <DialogDescription>
            Register an existing contact as a volunteer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Person *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact" />
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
                  <FormLabel>Primary Role *</FormLabel>
                  {customRole ? (
                    <div className="flex gap-2">
                       <FormControl>
                          <Input placeholder="Enter custom role" {...field} />
                       </FormControl>
                       <Button type="button" variant="outline" onClick={() => { setCustomRole(false); field.onChange(""); }}>List</Button>
                    </div>
                  ) : (
                    <Select 
                      value={field.value} 
                      onValueChange={(val) => {
                        if (val === "Other") {
                          setCustomRole(true);
                          field.onChange("");
                        } else {
                          field.onChange(val);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select or type role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMON_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">
                         <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-600">Active</Badge>
                         </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                         <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inactive</Badge>
                         </div>
                      </SelectItem>
                      <SelectItem value="pending">
                         <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-600">Pending</Badge>
                         </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Volunteer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
