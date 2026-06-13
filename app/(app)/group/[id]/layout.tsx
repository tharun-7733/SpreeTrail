"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: "" }, // Not implemented, we'll route to expenses
  { label: "Expenses", href: "/expenses" },
  { label: "Members", href: "/members" },
  { label: "Balances", href: "/balances" },
  { label: "Settlements", href: "/settlements" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

export default function GroupLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const pathname = usePathname();
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id);
      api.groups.get(id).then((res: any) => {
        if (res?.group?.name) setGroupName(res.group.name);
      });
    });
  }, [params]);

  if (!groupId) return <div className="animate-pulse h-10 w-48 bg-gray-200 rounded"></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/groups" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Groups
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{groupName || "Loading..."}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/group/${groupId}/expense/new`}>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Expense
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const tabHref = `/group/${groupId}${tab.href}`;
            // Handle root group path resolving to Overview (or we just use exact matching)
            const isActive = tab.href === "" 
              ? pathname === `/group/${groupId}` 
              : pathname.startsWith(tabHref);
            
            return (
              <Link
                key={tab.label}
                href={tabHref || `/group/${groupId}/expenses`} // Default to expenses if empty
                className={cn(
                  "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="py-2">
        {children}
      </div>
    </div>
  );
}
