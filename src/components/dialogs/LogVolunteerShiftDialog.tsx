"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { logVolunteerShift } from "@/app/actions/operations";
import { cn } from "@/lib/utils";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const formSchema = z.object({
  date: z.date({ required_error: "Date is required" }),
  hours: z.number().min(0.5, "Must log at least 30 minutes").max(24, "Cannot log more than 24 hours"),
  notes: z.string().optional(),
});

interface LogVolunteerShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  volunteerId: string | null;
  volunteerName?: string;
}

export function LogVolunteerShiftDialog({
  open,
  onOpenChange,
  onSuccess,
  volunteerId,
  volunteerName,
}: LogVolunteerShiftDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      hours: 2,
      notes: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!volunteerId) {
      toast.error("No volunteer selected");
      return;
    }

    setLoading(true);
    try {
      await logVolunteerShift({
        volunteerId,
        date: values.date,
        hours: values.hours,
        notes: values.notes || undefined,
      });

      form.reset({
        date: new Date(),
        hours: 2,
        notes: "",
      });
      toast.success("Shift hours logged");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to log shift:", error);
      toast.error("Failed to log hours. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Volunteer Hours</DialogTitle>
          <DialogDescription>
            Record a shift for {volunteerName || "this volunteer"}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        max="24"
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did they work on?"
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
                Log Hours
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
