"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Receipt, Bot, User } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/bills", label: "Contas", icon: Receipt },
  { href: "/ai", label: "IA", icon: Bot },
  { href: "/profile", label: "Perfil", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 safe-area-bottom md:hidden">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 text-[10px] font-medium transition-colors ${
                active ? "text-[#6366F1]" : "text-white/45 active:text-white/70"
              }`}
            >
              <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
