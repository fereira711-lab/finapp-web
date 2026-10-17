"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { useBillAlerts } from "@/lib/useBillAlerts";
import { useStockAlerts } from "@/lib/useStockAlerts";
import { useChoreAlerts } from "@/lib/useChoreAlerts";
import { applyNavOrder, useNavOrder } from "@/lib/useNavOrder";
import { MOBILE_BAR_SIZE, MOBILE_DEFAULT_ORDER, NAV_ITEMS } from "@/lib/navItems";

const RED = "bg-red-500";
const AMBER = "bg-amber-500";

export default function BottomNav() {
  const pathname = usePathname();
  const { totalAlerts } = useBillAlerts();
  const stock = useStockAlerts();
  const chores = useChoreAlerts();
  const { order } = useNavOrder();
  const [showMore, setShowMore] = useState(false);

  // mesma ordem do menu lateral; sem ordem personalizada vale a ordem padrão do celular
  const ordered = applyNavOrder(NAV_ITEMS, order ?? MOBILE_DEFAULT_ORDER);
  const primaryItems = ordered.slice(0, MOBILE_BAR_SIZE);
  const moreItems = ordered.slice(MOBILE_BAR_SIZE);

  const badgeFor = (href: string): { count: number; color: string } => {
    if (href === "/bills") return { count: totalAlerts, color: RED };
    if (href === "/shopping") return { count: stock.count, color: AMBER };
    if (href === "/chores") return { count: chores.count, color: RED };
    return { count: 0, color: RED };
  };

  const moreActive = moreItems.some((i) => pathname === i.href);
  const moreBadges = moreItems.map((i) => badgeFor(i.href)).filter((b) => b.count > 0);
  const moreDot = moreBadges.length > 0 ? (moreBadges.some((b) => b.color === RED) ? RED : AMBER) : null;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 safe-area-bottom md:hidden">
        <div className="flex justify-around items-center h-16 px-1">
          {primaryItems.map((item) => {
            const active = pathname === item.href;
            const badge = badgeFor(item.href);
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
                  {badge.count > 0 && (
                    <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center ${badge.color} text-white text-[9px] font-bold rounded-full px-1`}>
                      {badge.count > 9 ? "9+" : badge.count}
                    </span>
                  )}
                </div>
                <span className="uppercase tracking-wider">{item.short}</span>
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
            <div className="relative">
              <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.8} />
              {moreDot && <span className={`absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full ${moreDot}`} />}
            </div>
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
                const badge = badgeFor(item.href);
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
                    <div className="relative">
                      <item.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                      {badge.count > 0 && (
                        <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center ${badge.color} text-white text-[9px] font-bold rounded-full px-1`}>
                          {badge.count > 9 ? "9+" : badge.count}
                        </span>
                      )}
                    </div>
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
