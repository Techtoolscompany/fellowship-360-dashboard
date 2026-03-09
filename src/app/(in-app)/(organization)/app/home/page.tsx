import { redirect } from "next/navigation";

export default function MinistryDashboardPage() {
  redirect("/app?tab=command");
}
