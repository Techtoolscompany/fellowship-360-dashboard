"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import useOrganization from "@/lib/organizations/useOrganization";
import { getGraceSettings, updateGraceSettings } from "@/app/actions/grace-settings";

const graceSettingsSchema = z.object({
  graceEnabled: z.boolean(),
  churchName: z.string().min(2, "Church name must be at least 2 characters."),
  churchDenomination: z.string().optional(),
  churchCity: z.string().optional(),
  customSystemPrompt: z.string().optional(),
});

export default function GraceSettingsPage() {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof graceSettingsSchema>>({
    resolver: zodResolver(graceSettingsSchema),
    defaultValues: {
      graceEnabled: true,
      churchName: "",
      churchDenomination: "",
      churchCity: "",
      customSystemPrompt: "",
    },
  });

  useEffect(() => {
    async function loadSettings() {
      if (!organization?.id) return;
      try {
        const settings = await getGraceSettings(organization.id);
        if (settings) {
          form.reset({
            graceEnabled: settings.graceEnabled,
            churchName: settings.churchName || organization.name || "",
            churchDenomination: settings.churchDenomination || "",
            churchCity: settings.churchCity || "",
            customSystemPrompt: settings.customSystemPrompt || "",
          });
        } else {
            form.reset({
                ...form.getValues(),
                churchName: organization.name || "",
            })
        }
      } catch (error) {
        toast.error("Failed to load Grace AI settings");
      } finally {
        setLoading(false);
      }
    }
    
    loadSettings();
  }, [organization?.id, organization?.name, form]);

  async function onSubmit(values: z.infer<typeof graceSettingsSchema>) {
    if (!organization?.id) return;
    try {
      await updateGraceSettings(organization.id, values);
      toast.success("Grace AI settings updated securely.");
    } catch (error) {
      toast.error("Failed to update settings.");
    }
  }

  if (loading) {
     return <div>Loading config...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Grace AI Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how Grace AI interacts with your members and represents your church.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>AI Core Configuration</CardTitle>
              <CardDescription>
                Basic settings to control Grace AI&apos;s availability and core identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="graceEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Grace AI</FormLabel>
                      <FormDescription>
                        When disabled, Grace AI will not respond to any queries or appear in the app.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="churchName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Church Name for AI</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Grace Community Church" {...field} />
                        </FormControl>
                        <FormDescription>How the AI refers to your church.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="churchCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City / Location</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Baltimore, MD" {...field} />
                        </FormControl>
                        <FormDescription>Helps localize the AI&apos;s context.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                   <FormField
                    control={form.control}
                    name="churchDenomination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Denomination / Affiliation</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Non-denominational" {...field} />
                        </FormControl>
                        <FormDescription>Influences the theological tone of the AI.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
              <CardTitle>Advanced Personality</CardTitle>
              <CardDescription>
                Provide custom instructions to override Grace&apos;s default personality.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <FormField
                control={form.control}
                name="customSystemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom System Prompt</FormLabel>
                    <FormControl>
                      <Textarea 
                         placeholder="You are Grace, an AI assistant for..." 
                         className="min-h-[200px]"
                         {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                        Leave blank to use the default optimized prompt. If provided, this fully replaces the base instruction.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
