import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { updatePrayerRequest } from "@/app/actions/prayer";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";

const formSchema = z.object({
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  content: z.string().min(1, "Request details are required"),
  urgency: z.string().default("normal"),
  status: z.string().default("active"),
  isAnonymous: z.boolean().default(false),
});

interface EditPrayerRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prayerRequest: any;
}

export function EditPrayerRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  prayerRequest,
}: EditPrayerRequestDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: prayerRequest?.content || "",
      urgency: prayerRequest?.urgency || "normal",
      status: prayerRequest?.status || "active",
      contactId: prayerRequest?.contactId || "",
      contactName: prayerRequest?.contactName || "",
      isAnonymous: prayerRequest?.isAnonymous === "true",
    },
  });

  const isAnonymous = form.watch("isAnonymous");

  // Update form if prayerRequest changes while dialog is closed/reopened
  useEffect(() => {
    if (prayerRequest) {
      form.reset({
        content: prayerRequest.content || "",
        urgency: prayerRequest.urgency || "normal",
        status: prayerRequest.status || "active",
        contactId: prayerRequest.contactId || "",
        contactName: prayerRequest.contactName || "",
        isAnonymous: prayerRequest.isAnonymous === "true",
      });
    }
  }, [prayerRequest, form]);

  useEffect(() => {
    if (open && organization?.id) {
      getContacts(organization.id).then(setContacts);
    }
  }, [open, organization?.id]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization?.id || !prayerRequest?.id) return;
    setLoading(true);
    try {
      await updatePrayerRequest(prayerRequest.id, {
        contactId: values.isAnonymous ? null : (values.contactId || null),
        contactName: values.isAnonymous ? "Anonymous" : (values.contactName || null),
        content: values.content,
        urgency: values.urgency,
        status: values.status,
        isAnonymous: values.isAnonymous ? "true" : "false",
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to update prayer request:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Prayer Request</DialogTitle>
          <DialogDescription>
            Update the details or status for this prayer request.
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
                      value={field.value}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="answered">Answered</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select urgency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
