import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar user={user as any} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopHeader user={user} />
        <div className="flex-1 overflow-auto">
          <div className="p-4 pb-20 md:p-8 md:pb-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}

