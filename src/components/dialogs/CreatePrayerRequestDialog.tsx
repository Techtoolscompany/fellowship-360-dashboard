
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { createPrayerRequest } from "@/app/actions/prayer";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";

const formSchema = z.object({
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  content: z.string().min(1, "Request details are required"),
  urgency: z.enum(["normal", "urgent", "critical"]).default("normal"),
  assignedTeam: z.string().default("auto"),
  isAnonymous: z.boolean().default(false),
});

interface CreatePrayerRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function CreatePrayerRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  children,
}: CreatePrayerRequestDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      urgency: "normal",
      assignedTeam: "auto",
      isAnonymous: false,
    },
  });

  const isAnonymous = form.watch("isAnonymous");

  useEffect(() => {
    if (open && organization?.id) {
      getContacts(organization.id).then(r => setContacts(r.contacts));
    }
  }, [open, organization?.id]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization?.id) return;
    setLoading(true);
    try {
      await createPrayerRequest({
        contactId: values.isAnonymous ? undefined : values.contactId,
        contactName: values.isAnonymous ? "Anonymous" : values.contactName,
        content: values.content,
        urgency: values.urgency,
        assignedTeam: values.assignedTeam === "auto" ? undefined : values.assignedTeam,
        isAnonymous: values.isAnonymous,
        organizationId: organization.id,
      });
      form.reset();
      toast.success("Created successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create prayer request:", error);
      toast.error("Failed to create prayer request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Prayer Request</DialogTitle>
          <DialogDescription>
            Record a new prayer request for the team.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="isAnonymous"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Anonymous Request</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {!isAnonymous && (
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact (Optional)</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        const contact = contacts.find((c) => c.id === val);
                        if (contact) {
                          form.setValue(
                            "contactName",
                            `${contact.firstName} ${contact.lastName}`
                          );
                        }
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.firstName} {contact.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isAnonymous && !form.watch("contactId") && (
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requester Name (if not in contacts)</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedTeam"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Team</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-route by urgency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="auto">Auto-route by urgency</SelectItem>
                      <SelectItem value="Prayer Team">Prayer Team</SelectItem>
                      <SelectItem value="Care Team">Care Team</SelectItem>
                      <SelectItem value="Pastoral Team">Pastoral Team</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the prayer request details..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
