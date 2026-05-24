import { redirect } from "next/navigation";
import { ParentChildrenList } from "@/components/parent-children-list";
import { assertFamilySession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";

export default async function ParentHome() {
  const currentUser = await assertFamilySession();
  if (currentUser.role !== "parent") {
    redirect("/student");
  }

  const dashboard = await loadDashboardData(currentUser);
  return <ParentChildrenList initialData={dashboard} />;
}
