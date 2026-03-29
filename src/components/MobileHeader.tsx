"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/transactions": "Gastos",
  "/reports": "Relatórios",
  "/bills": "Contas",
  "/credit-cards": "Cartões",
  "/ai": "IA Financeira",
  "/profile": "Perfil",
  "/connect-bank": "Conectar Banco",
  "/settings/appearance": "Aparência",
  "/goals": "Metas",
};

export default function MobileHeader() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "";

  return (
    <header className="fixed top-0 left-0 right-0 glass-header z-50 md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <span className="text-lg font-bold text-[#6366F1]">FinApp</span>
        <span className="text-xs font-medium uppercase tracking-widest text-white/45">{title}</span>
        <div className="w-12" />
      </div>
    </header>
  );
}
