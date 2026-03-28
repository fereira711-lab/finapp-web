"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Receipt, CreditCard, Bot, User, BarChart3, Landmark } from "lucide-react";
import { useBillAlerts } from "@/lib/useBillAlerts";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/bills", label: "Contas", icon: Receipt },
  { href: "/credit-cards", label: "Cartões", icon: CreditCard },
  { href: "/ai", label: "IA Financeira", icon: Bot },
  { href: "/connect-bank", label: "Conectar Banco", icon: Landmark },
  { href: "/profile", label: "Perfil", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { totalAlerts } = useBillAlerts();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 glass-nav h-screen fixed left-0 top-0 z-40"
      style={{ borderTop: "none", borderRight: "1px solid var(--glass-border)", borderRadius: 0 }}
    >
      <div className="p-6">
        <h1 className="text-xl font-bold text-[#6366F1]">FinApp</h1>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const showBadge = item.href === "/bills" && totalAlerts > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                active
                  ? "glass-btn-active text-white font-medium"
                  : "text-white/45 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                  {totalAlerts > 9 ? "9+" : totalAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
