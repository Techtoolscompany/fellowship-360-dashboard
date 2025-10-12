"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import S3Uploader from "@/components/ui/s3-uploader/s3-uploader";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import updateOrganizationSchema from "@/app/api/app/organizations/current/update/schema";
import { Copy } from "lucide-react";
import { useState, useEffect } from "react";

export default function OrganizationSettingsPage() {
  const { organization, mutate } = useOrganization();
  const [copied, setCopied] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");

  const form = useForm<z.infer<typeof updateOrganizationSchema>>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: organization?.name || "",
      image: organization?.image || null,
    },
  });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization?.name || "",
        image: organization?.image || null,
      });
      setLogoUrl(organization?.image || "");
    }
  }, [organization, form]);

  const handleLogoUpload = async (fileUrls: string[]) => {
    if (fileUrls.length > 0) {
      const uploadedUrl = fileUrls[0];
      setLogoUrl(uploadedUrl);
      form.setValue("image", uploadedUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Organization ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  async function onSubmit(values: z.infer<typeof updateOrganizationSchema>) {
    await toast.promise(
      async () => {
        const response = await fetch("/api/app/organizations/current/update", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          throw new Error("Failed to update organization");
        }
        await mutate();
      },
      {
        loading: "Updating organization...",
        success: "Organization updated",
        error: "Failed to update organization",
      }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Organization Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your organization profile and settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Update your organization&apos;s basic information.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <FormLabel>Organization Logo</FormLabel>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={logoUrl || organization?.image || ""}
                      alt={organization?.name || "Organization"}
                    />
                    <AvatarFallback className="text-lg">
                      {organization?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "ORG"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <S3Uploader
                      presignedRouteProvider="/api/app/organizations/current/update/upload-logo"
                      variant="button"
                      onUpload={handleLogoUpload}
                      accept="image/*"
                      maxSize={5 * 1024 * 1024} // 5MB
                      buttonText="Change Logo"
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-fit"
                    />
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max size 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-sm font-medium">
                  Organization ID
                </FormLabel>
                <div className="flex items-center mt-2">
                  <code className="bg-muted px-3 py-2 rounded text-xs flex-1 font-mono">
                    {organization?.id || "Loading..."}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="ml-2"
                    onClick={() =>
                      organization?.id && copyToClipboard(organization.id)
                    }
                    disabled={!organization?.id || copied}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this ID when contacting support about your organization.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
