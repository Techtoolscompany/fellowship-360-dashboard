import useSWR from "swr";
import { UserOrganizationWithPlan } from "./getUserOrganizations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const useOrganization = () => {
  const { data, isLoading, error, mutate } = useSWR<UserOrganizationWithPlan>(
    "/api/app/organizations/current"
  );
  const router = useRouter();

  const switchOrganization = async (organizationId: string) => {
    toast.promise(
      async () => {
        const response = await fetch("/api/app/organizations/current", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ organizationId }),
        });

        if (!response.ok) {
          throw new Error("Failed to switch organization");
        }
        await mutate();
        router.push("/app");
      },
      {
        loading: "Switching organization...",
        success: "Organization switched successfully",
        error: "Failed to switch organization",
      }
    );
  };

  return {
    organization: data,
    isLoading,
    error,
    mutate,
    switchOrganization,
  };
};

export default useOrganization;
