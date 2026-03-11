import { redirect } from "next/navigation";

export default function GraceCenterPage() {
  redirect("/app/grace?tab=center");
}
