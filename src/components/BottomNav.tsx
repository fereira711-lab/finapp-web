"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Receipt, CreditCard, Target, User } from "lucide-react";
import { useBillAlerts } from "@/lib/useBillAlerts";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/bills", label: "Contas", icon: Receipt },
  { href: "/credit-cards", label: "Cartões", icon: CreditCard },
  { href: "/goals", label: "Metas", icon: Target },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { totalAlerts } = useBillAlerts();

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 safe-area-bottom md:hidden">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const showBadge = item.href === "/bills" && totalAlerts > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 text-[10px] font-medium transition-colors ${
                active ? "text-[#6366F1]" : "text-white/45 active:text-white/70"
              }`}
            >
              <div className="relative">
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                    {totalAlerts > 9 ? "9+" : totalAlerts}
                  </span>
                )}
              </div>
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
