import { redirect } from "next/navigation";

export default function AppointmentsPage() {
  redirect("/app/grace?tab=calendar");
}
