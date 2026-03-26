"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/transactions": "Transações",
  "/reports": "Relatórios",
  "/bills": "Contas",
  "/ai": "IA Financeira",
  "/profile": "Perfil",
  "/connect-bank": "Conectar Banco",
};

export default function MobileHeader() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "";

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark-900/95 backdrop-blur-sm border-b border-dark-700/50 z-50 md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <span className="text-lg font-bold text-[#6366F1]">FinApp</span>
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <div className="w-12" />
      </div>
    </header>
  );
}
