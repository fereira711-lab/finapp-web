"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transações",
  "/bills": "Agenda Financeira",
  "/credit-cards": "Cartões",
  "/ai": "IA Financeira",
  "/profile": "Perfil",
  "/reports": "Relatórios",
  "/goals": "Metas",
};

export default function AppShell({
  children,
  contentClassName = "",
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] || "";

  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="md:ml-64 pt-16 pb-20 md:py-8 min-h-screen px-4 md:px-10 md:flex md:items-center md:justify-center">
        <div className={`glass w-full max-w-3xl p-4 md:p-6 mx-auto ${contentClassName}`}>
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
