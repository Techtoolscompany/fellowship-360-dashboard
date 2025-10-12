"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import S3Uploader from "@/components/ui/s3-uploader/s3-uploader";
import useUser from "@/lib/users/useUser";
import { useEffect, useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  image: z.string().nullable().optional(),
});

export function EditUserForm() {
  const { user, isLoading, mutate } = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || "",
      image: user?.image || null,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user?.name || "",
        image: user?.image || null,
      });
      setAvatarUrl(user?.image || "");
    }
  }, [user, form]);

  const handleAvatarUpload = async (fileUrls: string[]) => {
    if (fileUrls.length > 0) {
      const uploadedUrl = fileUrls[0];
      setAvatarUrl(uploadedUrl);
      form.setValue("image", uploadedUrl);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const response = await fetch("/api/app/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      await mutate();
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  }

  if (!user || isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  const displayAvatarUrl = avatarUrl || user?.image || "";
  const userInitials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormLabel>Profile Picture</FormLabel>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={displayAvatarUrl}
                alt={user?.name || "Profile"}
              />
              <AvatarFallback className="text-lg">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <S3Uploader
                presignedRouteProvider="/api/app/me/upload-avatar"
                variant="button"
                onUpload={handleAvatarUpload}
                accept="image/*"
                maxSize={5 * 1024 * 1024} // 5MB
                buttonText="Change Avatar"
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  placeholder="John Doe"
                  disabled={form.formState.isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={user.email}
            disabled
            className="bg-muted"
          />
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Updating..." : "Update profile"}
        </Button>
      </form>
    </Form>
  );
}
