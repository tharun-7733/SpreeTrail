"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  ReceiptText,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/balances", label: "Balances", icon: ArrowLeftRight },
  { href: "/settlements", label: "Settle", icon: Banknote },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors",
                active ? "text-indigo-600" : "text-gray-500"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("w-5 h-5", active ? "text-indigo-600" : "text-gray-400")} />
              <span className="text-[10px] leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
