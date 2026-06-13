import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  // If the user is already logged in, they shouldn't see the login or register pages
  if (session && session.userId) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
