import { redirect } from "next/navigation";
import { assertFamilySession } from "@/lib/auth";

export default async function Home() {
  const user = await assertFamilySession();
  redirect(user.role === "parent" ? "/parent" : "/student");
}
