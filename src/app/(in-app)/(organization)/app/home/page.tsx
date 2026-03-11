import { redirect } from "next/navigation";

export default function MinistryDashboardPage() {
  redirect("/app/grace?tab=command");
}
