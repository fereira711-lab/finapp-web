"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MonthSummary {
  receitas: number;
  despesas: number;
  saldo: number;
}

interface CategoryRank {
  key: string;
  label: string;
  color: string;
  total: number;
  percent: number;
}

export default function ReportsPage() {
  const [currentMonth, setCurrentMonth] = useState<MonthSummary>({
    receitas: 0,
    despesas: 0,
    saldo: 0,
  });
  const [prevMonth, setPrevMonth] = useState<MonthSummary>({
    receitas: 0,
    despesas: 0,
    saldo: 0,
  });
  const [topCategories, setTopCategories] = useState<CategoryRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();

      const curStart = new Date(y, m, 1).toISOString();
      const curEnd = new Date(y, m + 1, 0).toISOString();
      const prevStart = new Date(y, m - 1, 1).toISOString();
      const prevEnd = new Date(y, m, 0).toISOString();

      const [curRes, prevRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, type, category")
          .eq("user_id", user.id)
          .gte("date", curStart)
          .lte("date", curEnd),
        supabase
          .from("transactions")
          .select("amount, type, category")
          .eq("user_id", user.id)
          .gte("date", prevStart)
          .lte("date", prevEnd),
      ]);

      function summarize(data: { amount: number; type: string }[]): MonthSummary {
        const receitas = data
          .filter((t) => t.type === "income" || t.amount > 0)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        const despesas = data
          .filter((t) => t.type === "expense" || t.amount < 0)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { receitas, despesas, saldo: receitas - despesas };
      }

      const cur = summarize(curRes.data || []);
      const prev = summarize(prevRes.data || []);
      setCurrentMonth(cur);
      setPrevMonth(prev);

      const catMap: Record<string, number> = {};
      (curRes.data || [])
        .filter((t) => t.type === "expense" || t.amount < 0)
        .forEach((t) => {
          const cat = t.category || "outros";
          catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
        });

      const totalExp = Object.values(catMap).reduce((s, v) => s + v, 0);
      const ranked = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, total]) => {
          const cfg = getCategoryConfig(key);
          return {
            key,
            label: cfg.label,
            color: cfg.color,
            total,
            percent: totalExp > 0 ? Math.round((total / totalExp) * 100) : 0,
          };
        });
      setTopCategories(ranked);
      setLoading(false);
    }
    load();
  }, []);

  function variation(current: number, previous: number): { value: string; positive: boolean } {
    if (previous === 0) return { value: current > 0 ? "+100%" : "0%", positive: current >= 0 };
    const pct = ((current - previous) / previous) * 100;
    return {
      value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      positive: pct >= 0,
    };
  }

  const receitaVar = variation(currentMonth.receitas, prevMonth.receitas);
  const despesaVar = variation(currentMonth.despesas, prevMonth.despesas);
  const saldoVar = variation(currentMonth.saldo, prevMonth.saldo);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const now = new Date();
  const currentMonthName = monthNames[now.getMonth()];
  const prevMonthName = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  return (
    <AppShell>
      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : (
        <div className="space-y-5">
          {/* Monthly Summary */}
          <div className="glass-divider pb-5">
            <h2 className="label-upper mb-4">Resumo de {currentMonthName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="label-upper">Receitas</span>
                </div>
                <p className="text-xl font-bold text-green-400">
                  {formatCurrency(currentMonth.receitas)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  {receitaVar.positive ? (
                    <ArrowUpRight size={14} className="text-green-400" />
                  ) : (
                    <ArrowDownRight size={14} className="text-red-400" />
                  )}
                  <span className={receitaVar.positive ? "text-green-400" : "text-red-400"}>
                    {receitaVar.value}
                  </span>
                  <span className="text-white/30">vs {prevMonthName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="label-upper">Despesas</span>
                </div>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(currentMonth.despesas)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  {!despesaVar.positive ? (
                    <ArrowDownRight size={14} className="text-green-400" />
                  ) : (
                    <ArrowUpRight size={14} className="text-red-400" />
                  )}
                  <span className={!despesaVar.positive ? "text-green-400" : "text-red-400"}>
                    {despesaVar.value}
                  </span>
                  <span className="text-white/30">vs {prevMonthName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="label-upper">Saldo do Mês</span>
                </div>
                <p
                  className={`text-xl font-bold ${
                    currentMonth.saldo >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(currentMonth.saldo)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  {saldoVar.positive ? (
                    <ArrowUpRight size={14} className="text-green-400" />
                  ) : (
                    <ArrowDownRight size={14} className="text-red-400" />
                  )}
                  <span className={saldoVar.positive ? "text-green-400" : "text-red-400"}>
                    {saldoVar.value}
                  </span>
                  <span className="text-white/30">vs {prevMonthName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="glass-divider pb-5">
            <h2 className="label-upper mb-4">Top 5 Categorias de Gastos</h2>
            {topCategories.length === 0 ? (
              <p className="text-white/30 text-sm">Sem despesas neste mês.</p>
            ) : (
              <div className="space-y-4">
                {topCategories.map((cat) => {
                  const cfg = getCategoryConfig(cat.key);
                  const Icon = cfg.icon;
                  return (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: cat.color + "20" }}
                          >
                            <Icon size={14} style={{ color: cat.color }} />
                          </div>
                          <span className="text-sm font-medium">{cat.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white">
                            {formatCurrency(cat.total)}
                          </span>
                          <span className="text-xs text-white/45 ml-2">{cat.percent}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${cat.percent}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Previous Month Comparison */}
          <div>
            <h2 className="label-upper mb-4">
              {currentMonthName} vs {prevMonthName}
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="label-upper mb-1">Receitas</p>
                <p className="text-sm text-white/30">{formatCurrency(prevMonth.receitas)}</p>
                <p className="text-sm font-bold text-green-400">
                  {formatCurrency(currentMonth.receitas)}
                </p>
              </div>
              <div>
                <p className="label-upper mb-1">Despesas</p>
                <p className="text-sm text-white/30">{formatCurrency(prevMonth.despesas)}</p>
                <p className="text-sm font-bold text-red-400">
                  {formatCurrency(currentMonth.despesas)}
                </p>
              </div>
              <div>
                <p className="label-upper mb-1">Saldo</p>
                <p className="text-sm text-white/30">{formatCurrency(prevMonth.saldo)}</p>
                <p
                  className={`text-sm font-bold ${
                    currentMonth.saldo >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(currentMonth.saldo)}
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-3 text-xs text-white/30">
              <span className="text-white/45">{prevMonthName}</span>
              <span>→</span>
              <span className="text-white font-medium">{currentMonthName}</span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
