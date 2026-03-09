import { redirect } from "next/navigation";

export default function GraceCenterPage() {
  redirect("/app?tab=center");
}
