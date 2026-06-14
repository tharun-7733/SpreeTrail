import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Users, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Import CSV — Spreetail",
  description: "Import expenses from a CSV file into one of your groups",
};

export default async function ImportPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  const memberships = await prisma.groupMember.findMany({
    where: { userId, leftAt: null, role: "ADMIN" },
    include: { group: { select: { id: true, name: true, description: true } } },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import CSV</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Import expenses from a Splitwise export or custom CSV into one of your groups.
          You must be an admin to import into a group.
        </p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No admin groups</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              You need to be an admin of a group to import expenses. Create a group or ask a group admin to grant you admin rights.
            </p>
            <Link href="/groups/new">
              <Button>Create a group</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select a group to import into:</p>
          <div className="grid grid-cols-1 gap-3">
            {memberships.map(({ group }) => (
              <Link key={group.id} href={`/group/${group.id}/import`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{group.name}</p>
                        {group.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Format reference */}
      <Card className="border-gray-100 bg-gray-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Supported CSV Formats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-0.5">Splitwise</span>
            <p className="text-sm text-gray-600">Directly export from Splitwise and upload — we auto-detect the columns.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">Custom</span>
            <p className="text-sm text-gray-600">CSV with Date, Description, Amount, Currency, and Who paid columns.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
