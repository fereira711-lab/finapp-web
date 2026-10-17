"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { mondayOf, progressColors, shortDate } from "@/lib/shopping";
import { daysLeftLabel, useStockAlerts } from "@/lib/useStockAlerts";

interface WeekSummary {
  budget: number;
  status: "open" | "done";
  total: number; // gasto (itens marcados com preco)
  estimated: number; // previsto (todos os itens)
  itemCount: number;
  checked: number;
}

/** Compras: dois cards proprios (Lista da semana e Acabando), separados dos cards financeiros. */
export default function ShoppingSection() {
  const stock = useStockAlerts();
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: list } = await supabase.from("shopping_lists").select("id, budget, status")
        .eq("user_id", user.id).eq("week_start", mondayOf()).maybeSingle();
      if (!list) { setWeek(null); return; }
      const { data: items } = await supabase.from("shopping_list_items")
        .select("checked, price, estimated_price").eq("list_id", list.id);
      const rows = items || [];
      setWeek({
        budget: Number(list.budget),
        status: list.status as "open" | "done",
        total: Math.round(rows.filter((i) => i.checked).reduce((s, i) => s + Number(i.price ?? 0), 0) * 100) / 100,
        estimated: Math.round(rows.reduce((s, i) => s + Number(i.estimated_price ?? 0), 0) * 100) / 100,
        itemCount: rows.length,
        checked: rows.filter((i) => i.checked).length,
      });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("finapp:data-changed", load);
    return () => window.removeEventListener("finapp:data-changed", load);
  }, [load]);

  if (!loaded) return null;

  const pct = week && week.budget > 0 ? Math.round((week.total / week.budget) * 100) : 0;
  const colors = progressColors(pct);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45 flex items-center gap-1.5">
          <ShoppingCart size={14} /> Compras
        </h2>
        <Link href="/shopping" className="text-[10px] text-[#6366F1] hover:underline">Abrir Compras</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Lista da semana</h3>
            <span className="text-[10px] text-white/30">a partir de {shortDate(mondayOf())}</span>
          </div>
          {!week ? (
            <p className="text-xs text-white/30">
              Lista desta semana ainda não gerada.{" "}
              <Link href="/shopping" className="text-[#6366F1] hover:underline">Gerar lista</Link>
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <p className={`text-lg font-bold ${colors.text}`}>{formatCurrency(week.total)}</p>
                <p className="text-[11px] text-white/45">de {formatCurrency(week.budget)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className={`h-full ${colors.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-[11px] text-white/45 mt-2">
                {week.status === "done"
                  ? "Compra finalizada"
                  : `${week.checked}/${week.itemCount} itens comprados · previsto ${formatCurrency(week.estimated)}`}
              </p>
            </>
          )}
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Acabando</h3>
            <span className="text-[10px] text-white/30">
              {stock.count > 0 ? `${stock.count} ${stock.count === 1 ? "item" : "itens"}` : "estoque ok"}
            </span>
          </div>
          {stock.count === 0 ? (
            <p className="text-xs text-white/30">Nada acabando nos próximos dias 👍</p>
          ) : (
            <div className="space-y-1.5">
              {stock.items.slice(0, 5).map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate flex items-center gap-1.5">
                    <AlertTriangle size={12} className={it.daysLeft <= 0 ? "text-red-400 shrink-0" : "text-amber-400 shrink-0"} />
                    {it.name}
                  </span>
                  <span className={`shrink-0 ${it.daysLeft <= 0 ? "text-red-400" : "text-amber-400"}`}>{daysLeftLabel(it.daysLeft)}</span>
                </div>
              ))}
              {stock.count > 5 && <p className="text-[10px] text-white/30">+ {stock.count - 5} outros</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
