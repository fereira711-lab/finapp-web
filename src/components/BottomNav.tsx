"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ArrowLeftRight, Receipt, CreditCard, MoreHorizontal, X,
  Target, Tag, BarChart3, Bot, User,
} from "lucide-react";
import { useBillAlerts } from "@/lib/useBillAlerts";

const primaryItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/bills", label: "Agenda", icon: Receipt },
  { href: "/credit-cards", label: "Cartões", icon: CreditCard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
];

const moreItems = [
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/category-rules", label: "Regras de Categoria", icon: Tag },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/ai", label: "IA Financeira", icon: Bot },
  { href: "/profile", label: "Perfil", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { totalAlerts } = useBillAlerts();
  const [showMore, setShowMore] = useState(false);

  const moreActive = moreItems.some((i) => pathname === i.href);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 safe-area-bottom md:hidden">
        <div className="flex justify-around items-center h-16 px-1">
          {primaryItems.map((item) => {
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

          {/* Botao Mais */}
          <button
            onClick={() => setShowMore(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 text-[10px] font-medium transition-colors ${
              moreActive ? "text-[#6366F1]" : "text-white/45 active:text-white/70"
            }`}
            aria-label="Mais opcoes"
          >
            <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.8} />
            <span className="uppercase tracking-wider">Mais</span>
          </button>
        </div>
      </nav>

      {/* Drawer com itens secundarios */}
      {showMore && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 glass rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-sm font-bold">Mais opções</h2>
              <button onClick={() => setShowMore(false)} className="text-white/45 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all ${
                      active
                        ? "glass-btn-active text-white"
                        : "glass-btn text-white/60 active:text-white"
                    }`}
                  >
                    <item.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="text-[11px] text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
