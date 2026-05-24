import { clearUserSession, createUserSession, resolveUserByEmail } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("quickEmail") || formData.get("email") || "");
  const user = await resolveUserByEmail(email);

  if (!user) {
    redirect("/login?error=1");
  }

  await createUserSession(user);
  redirect("/");
}

export async function DELETE() {
  await clearUserSession();
  return Response.json({ ok: true });
}
