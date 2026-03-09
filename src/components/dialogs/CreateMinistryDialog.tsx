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
import { createMinistry } from "@/app/actions/ministries";
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

interface CreateMinistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export function CreateMinistryDialog({
  open,
  onOpenChange,
  onSuccess,
  children,
}: CreateMinistryDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (open && organization?.id) {
      getContacts(organization.id).then(r => setContacts(r.contacts));
    }
  }, [open, organization?.id]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
      leaderId: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization?.id) return;
    setLoading(true);
    try {
      await createMinistry({
        name: values.name,
        description: values.description || undefined,
        meetingDay: values.meetingDay || undefined,
        meetingTime: values.meetingTime || undefined,
        meetingLocation: values.meetingLocation || undefined,
        leaderId: values.leaderId || undefined,
        organizationId: organization.id,
      });
      form.reset();
      toast.success("Created successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create ministry:", error);
      toast.error("Failed to create ministry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Ministry</DialogTitle>
          <DialogDescription>
            Add a new ministry or group to your church.
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                Create Ministry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
