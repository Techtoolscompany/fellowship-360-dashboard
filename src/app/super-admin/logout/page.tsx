import { redirect } from "next/navigation";

export default function SuperAdminLogoutPage() {
  redirect("/sign-out");
}
