import { redirect } from "next/navigation";
import { FamilyTutorApp } from "@/components/family-tutor-app";
import { assertFamilySession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";

export default async function StudentHome() {
  const currentUser = await assertFamilySession();
  if (currentUser.role === "parent") {
    redirect("/parent");
  }

  const dashboard = await loadDashboardData(currentUser);
  return <FamilyTutorApp initialData={dashboard} />;
}
