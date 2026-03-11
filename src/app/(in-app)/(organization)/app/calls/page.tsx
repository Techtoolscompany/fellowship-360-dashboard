import { redirect } from "next/navigation";

export default function CallsPage() {
  redirect("/app/grace?tab=inbox");
}
