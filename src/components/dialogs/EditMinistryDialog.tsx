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
import { updateMinistry } from "@/app/actions/ministries";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";

const formSchema = z.object({
  name: z.string().min(1, "Ministry name is required"),
  description: z.string().optional(),
  meetingDay: z.string().optional(),
  meetingTime: z.string().optional(),
  meetingLocation: z.string().optional(),
  leaderId: z.string().optional(),
});

interface EditMinistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  ministry: any;
}

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export function EditMinistryDialog({
  open,
  onOpenChange,
  onSuccess,
  ministry,
}: EditMinistryDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (open && organization?.id) {
      getContacts(organization.id).then(setContacts);
    }
  }, [open, organization?.id]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: ministry?.name || "",
      description: ministry?.description || "",
      meetingDay: ministry?.meetingDay || "",
      meetingTime: ministry?.meetingTime || "",
      meetingLocation: ministry?.meetingLocation || "",
      leaderId: ministry?.leaderId || "",
    },
  });

  useEffect(() => {
    if (ministry) {
      form.reset({
        name: ministry.name || "",
        description: ministry.description || "",
        meetingDay: ministry.meetingDay || "",
        meetingTime: ministry.meetingTime || "",
        meetingLocation: ministry.meetingLocation || "",
        leaderId: ministry.leaderId || "",
      });
    }
  }, [ministry, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!ministry?.id) return;
    setLoading(true);
    try {
      await updateMinistry(ministry.id, {
        name: values.name,
        description: values.description || null,
        meetingDay: values.meetingDay || null,
        meetingTime: values.meetingTime || null,
        meetingLocation: values.meetingLocation || null,
        leaderId: values.leaderId || null,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to update ministry:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Ministry</DialogTitle>
          <DialogDescription>
            Update the details for this ministry or group.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ministry Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Youth Ministry" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is the purpose of this ministry?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meetingDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Day</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meetingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="meetingLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main Hall" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leaderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ministry Leader</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign a leader" />
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
