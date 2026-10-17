"use client";

import { formatCurrency } from "@/lib/format";
import { progressColors, shopCat, shortDate, type ShoppingList } from "@/lib/shopping";

interface Props {
  history: ShoppingList[];
  monthCats: Record<string, number>;
}

export default function HistoryTab({ history, monthCats }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/30 text-sm">Nenhuma compra finalizada ainda</p>
        <p className="text-white/20 text-xs mt-1">Ao finalizar a compra da semana, ela aparece aqui.</p>
      </div>
    );
  }

  const chart = [...history].reverse().slice(-6);
  const budget = chart[chart.length - 1].budget;
  const max = Math.max(budget, ...chart.map((l) => l.total ?? 0)) * 1.1;
  const cats = Object.entries(monthCats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="label-upper">Últimas semanas</p>
          <p className="text-[11px] text-white/40">orçamento {formatCurrency(budget)}</p>
        </div>
        <div className="relative flex items-end gap-3 h-40 pt-5">
          {chart.map((l) => {
            const total = l.total ?? 0;
            const pct = l.budget > 0 ? Math.round((total / l.budget) * 100) : 0;
            const c = progressColors(pct);
            return (
              <div key={l.id} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                <span className={`text-[10px] font-semibold ${c.text}`}>{formatCurrency(total).replace(/,00$/, "")}</span>
                <div className={`w-full rounded-t-lg ${c.bar}`} style={{ height: `${(total / max) * 100}%`, minHeight: 4 }} />
                <span className="text-[10px] text-white/40">{shortDate(l.week_start)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-white/30 mt-2">Cor: verde até 70% do orçamento, amarelo até 100%, vermelho acima.</p>
      </div>

      <div className="glass-card p-4">
        <p className="label-upper mb-3">Gasto por categoria ({monthName})</p>
        {cats.length === 0 ? (
          <p className="text-xs text-white/30">Sem compras finalizadas neste mês.</p>
        ) : (
          <div className="space-y-3">
            {cats.map(([k, v]) => {
              const c = shopCat(k);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.label}
                    </span>
                    <b>{formatCurrency(v)}</b>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${(v / maxCat) * 100}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="label-upper mb-2 px-1">Compras anteriores</p>
        <div className="space-y-2">
          {history.map((l) => {
            const total = l.total ?? 0;
            const pct = l.budget > 0 ? Math.round((total / l.budget) * 100) : 0;
            return (
              <div key={l.id} className="glass-card px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-bold">Seg {shortDate(l.week_start)}</p>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatCurrency(total)}</p>
                  <p className={`text-[11px] ${progressColors(pct).text}`}>{pct}% do orçamento</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
