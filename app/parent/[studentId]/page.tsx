import { notFound, redirect } from "next/navigation";
import { ParentChildDetail } from "@/components/parent-child-detail";
import { assertFamilySession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";

type ParentChildPageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function ParentChildPage({ params }: ParentChildPageProps) {
  const { studentId } = await params;
  const currentUser = await assertFamilySession();
  if (currentUser.role !== "parent") {
    redirect("/student");
  }

  const dashboard = await loadDashboardData(currentUser);
  const student = dashboard.students.find((entry) => entry.student.id === studentId);
  if (!student) {
    notFound();
  }

  return <ParentChildDetail dashboard={dashboard} student={student} />;
}
