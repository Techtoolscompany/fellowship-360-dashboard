import { redirect } from "next/navigation";

export default function SuperAdminLogoutPage() {
  redirect("/sign-out?callbackUrl=%2Fsign-in%3FcallbackUrl%3D%252Fsuper-admin");
}
