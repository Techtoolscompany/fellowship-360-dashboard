import { redirect } from "next/navigation";

export default function WebsiteHomepage() {
  // Bypass landing page and go directly to dashboard
  redirect("/app/home");
}
