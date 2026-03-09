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
import { updateBroadcast } from "@/app/actions/communications";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Message content is required"),
  channel: z.literal("sms"),
});

interface EditBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  broadcast: any;
}

export function EditBroadcastDialog({
  open,
  onOpenChange,
  onSuccess,
  broadcast,
}: EditBroadcastDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: broadcast?.title || "",
      content: broadcast?.content || "",
      channel: "sms",
    },
  });

  useEffect(() => {
    if (broadcast) {
      form.reset({
        title: broadcast.title || "",
        content: broadcast.content || "",
        channel: "sms",
      });
    }
  }, [broadcast, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!broadcast?.id) return;
    setLoading(true);
    try {
      await updateBroadcast(broadcast.id, {
        title: values.title,
        content: values.content,
        channel: values.channel,
      });
      toast.success("Updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to update broadcast draft:", error);
      toast.error("Failed to update broadcast draft. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Broadcast</DialogTitle>
          <DialogDescription>
            Modify this draft before sending it to your community.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Title / Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Easter Sunday Service" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
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
                  <FormLabel>Message Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your message here..."
                      className="min-h-[150px] resize-none"
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
                Update Draft
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
