"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Receipt, Bot, User, Landmark } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/bills", label: "Contas", icon: Receipt },
  { href: "/ai", label: "IA Financeira", icon: Bot },
  { href: "/connect-bank", label: "Conectar Banco", icon: Landmark },
  { href: "/profile", label: "Perfil", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-dark-800 border-r border-dark-700 h-screen fixed">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary">FinApp</h1>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-gray-400 hover:text-white hover:bg-dark-700"
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
