"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createDonation } from "@/app/actions/finances";
import { getContacts } from "@/app/actions/contacts";
import useOrganization from "@/lib/organizations/useOrganization";
import { cn } from "@/lib/utils";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type ChurchContact = {
  id: string;
  firstName: string;
  lastName: string;
};

const DONATION_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
] as const;

const FUNDS = ["General", "Building", "Missions", "Youth", "Outreach"] as const;

const formSchema = z.object({
  contactId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.date({ required_error: "Donation date is required" }),
  method: z.enum(["cash", "check", "card", "online"]),
  fund: z.string().min(1, "Fund is required"),
  memo: z.string().optional(),
});

interface CreateDonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function CreateDonationDialog({
  open,
  onOpenChange,
  onSuccess,
  children,
}: CreateDonationDialogProps) {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ChurchContact[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactId: "anonymous",
      amount: 0,
      date: new Date(),
      method: "cash",
      fund: "General",
      memo: "",
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
        toast.error("Failed to load contacts");
      });
  }, [open, organization?.id]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization?.id) {
      return;
    }

    setLoading(true);
    try {
      await createDonation({
        contactId:
          values.contactId && values.contactId !== "anonymous"
            ? values.contactId
            : undefined,
        amount: values.amount,
        date: values.date,
        method: values.method,
        fund: values.fund,
        memo: values.memo || undefined,
        organizationId: organization.id,
      });

      form.reset({
        contactId: "anonymous",
        amount: 0,
        date: new Date(),
        method: "cash",
        fund: "General",
        memo: "",
      });
      toast.success("Donation recorded");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create donation:", error);
      toast.error("Failed to record donation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record Donation</DialogTitle>
          <DialogDescription>
            Log a donation received at the church front desk.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Donor</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select donor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="anonymous">Anonymous / Walk-in</SelectItem>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-7"
                          value={Number.isNaN(field.value) ? "" : field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DONATION_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
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
                name="fund"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fund *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fund" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUNDS.map((fund) => (
                          <SelectItem key={fund} value={fund}>
                            {fund}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional note about this donation"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Donation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
