import { redirect } from "next/navigation";

export default function CalendarPage() {
  redirect("/app/grace?tab=calendar");
}
