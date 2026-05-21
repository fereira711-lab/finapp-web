"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import type { CreditCard } from "@/lib/types";
import AppShell from "@/components/AppShell";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight, CreditCard as CreditCardIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type ViewMode = "month" | "3months" | "6months" | "year";

interface PeriodSummary {
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

interface CardBreakdown {
  cardId: string;
  cardName: string;
  cardColor: string;
  total: number;
}

interface MonthPoint {
  label: string;
  receitas: number;
  despesas: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ReportsPage() {
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [periodSummary, setPeriodSummary] = useState<PeriodSummary>({ receitas: 0, despesas: 0, saldo: 0 });
  const [prevSummary, setPrevSummary] = useState<PeriodSummary>({ receitas: 0, despesas: 0, saldo: 0 });
  const [topCategories, setTopCategories] = useState<CategoryRank[]>([]);
  const [cardBreakdown, setCardBreakdown] = useState<CardBreakdown[]>([]);
  const [evolution, setEvolution] = useState<MonthPoint[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [loading, setLoading] = useState(true);

  // Calcula range de data baseado no viewMode
  const computeRange = useCallback((): { start: Date; end: Date; prevStart: Date; prevEnd: Date; label: string } => {
    if (viewMode === "month") {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      const prevStart = new Date(selectedYear, selectedMonth - 1, 1);
      const prevEnd = new Date(selectedYear, selectedMonth, 0);
      return { start, end, prevStart, prevEnd, label: `${MONTH_NAMES[selectedMonth]} ${selectedYear}` };
    }
    if (viewMode === "3months") {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { start, end, prevStart, prevEnd, label: "Últimos 3 meses" };
    }
    if (viewMode === "6months") {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth() - 5, 0);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { start, end, prevStart, prevEnd, label: "Últimos 6 meses" };
    }
    // year
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(now.getFullYear() - 1, 11, 31);
    return { start, end, prevStart, prevEnd, label: `${now.getFullYear()}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedYear, selectedMonth]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { start, end, prevStart, prevEnd } = computeRange();
      const startStr = dateOnly(start);
      const endStr = dateOnly(end);
      const prevStartStr = dateOnly(prevStart);
      const prevEndStr = dateOnly(prevEnd);

      // Evolucao: ultimos 6 meses (sempre)
      const evoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const evoEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const evoStartStr = dateOnly(evoStart);
      const evoEndStr = dateOnly(evoEnd);

      const [txRes, cardTxRes, prevTxRes, prevCardTxRes, evoTxRes, evoCardTxRes, cardsRes] = await Promise.all([
        supabase.from("transactions").select("amount, type, category, date")
          .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
        supabase.from("card_transactions").select("amount, category, card_id, date")
          .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
        supabase.from("transactions").select("amount, type")
          .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
        supabase.from("card_transactions").select("amount, date")
          .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
        supabase.from("transactions").select("amount, type, date")
          .eq("user_id", user.id).gte("date", evoStartStr).lte("date", evoEndStr),
        supabase.from("card_transactions").select("amount, date")
          .eq("user_id", user.id).gte("date", evoStartStr).lte("date", evoEndStr),
        supabase.from("credit_cards").select("id, name, color").eq("user_id", user.id),
      ]);

      const cards = (cardsRes.data || []) as Pick<CreditCard, "id" | "name" | "color">[];
      const cardById: Record<string, { name: string; color: string }> = {};
      cards.forEach((c) => { cardById[c.id] = { name: c.name, color: c.color }; });

      // === Periodo atual: somar transactions + card_transactions ===
      const txData = (txRes.data || []) as Array<{ amount: number; type: string; category: string }>;
      const cardTxData = (cardTxRes.data || []) as Array<{ amount: number; category: string; card_id: string }>;

      let receitas = 0;
      let despesas = 0;
      const catMap: Record<string, number> = {};

      txData.forEach((t) => {
        const a = Math.abs(t.amount);
        if (t.type === "income" || t.amount > 0) {
          receitas += a;
        } else {
          despesas += a;
          const cat = t.category || "outros";
          catMap[cat] = (catMap[cat] || 0) + a;
        }
      });

      cardTxData.forEach((t) => {
        const a = Math.abs(t.amount);
        despesas += a;
        const cat = t.category || "outros";
        catMap[cat] = (catMap[cat] || 0) + a;
      });

      setPeriodSummary({ receitas, despesas, saldo: receitas - despesas });

      // === Periodo anterior ===
      const prevTx = (prevTxRes.data || []) as Array<{ amount: number; type: string }>;
      const prevCardTx = (prevCardTxRes.data || []) as Array<{ amount: number }>;
      let pRec = 0;
      let pDes = 0;
      prevTx.forEach((t) => {
        const a = Math.abs(t.amount);
        if (t.type === "income" || t.amount > 0) pRec += a;
        else pDes += a;
      });
      prevCardTx.forEach((t) => { pDes += Math.abs(t.amount); });
      setPrevSummary({ receitas: pRec, despesas: pDes, saldo: pRec - pDes });

      // === Top categorias (todas, ordenadas) ===
      const totalCatExp = Object.values(catMap).reduce((s, v) => s + v, 0);
      const ranked = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([key, total]) => {
          const cfg = getCategoryConfig(key);
          return {
            key, label: cfg.label, color: cfg.color, total,
            percent: totalCatExp > 0 ? Math.round((total / totalCatExp) * 100) : 0,
          };
        });
      setTopCategories(ranked);

      // === Breakdown por cartao ===
      const cardTotals: Record<string, number> = {};
      cardTxData.forEach((t) => {
        cardTotals[t.card_id] = (cardTotals[t.card_id] || 0) + Math.abs(t.amount);
      });
      const breakdown: CardBreakdown[] = Object.entries(cardTotals)
        .map(([cid, total]) => ({
          cardId: cid,
          cardName: cardById[cid]?.name || "Cartão",
          cardColor: cardById[cid]?.color || "#6366F1",
          total,
        }))
        .sort((a, b) => b.total - a.total);
      setCardBreakdown(breakdown);

      // === Evolucao 6 meses ===
      const evoTx = (evoTxRes.data || []) as Array<{ amount: number; type: string; date: string }>;
      const evoCardTx = (evoCardTxRes.data || []) as Array<{ amount: number; date: string }>;
      const monthly: Record<string, { rec: number; des: number }> = {};

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        monthly[key] = { rec: 0, des: 0 };
      }

      evoTx.forEach((t) => {
        const key = t.date.substring(0, 7);
        if (!monthly[key]) return;
        const a = Math.abs(t.amount);
        if (t.type === "income" || t.amount > 0) monthly[key].rec += a;
        else monthly[key].des += a;
      });
      evoCardTx.forEach((t) => {
        const key = t.date.substring(0, 7);
        if (!monthly[key]) return;
        monthly[key].des += Math.abs(t.amount);
      });

      const evoPoints: MonthPoint[] = Object.entries(monthly).map(([key, v]) => {
        const [, m] = key.split("-");
        return {
          label: MONTH_SHORT[parseInt(m) - 1],
          receitas: Math.round(v.rec * 100) / 100,
          despesas: Math.round(v.des * 100) / 100,
        };
      });
      setEvolution(evoPoints);

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeRange]);

  function variation(current: number, previous: number, lowerIsBetter = false) {
    if (previous === 0 && current === 0) return { value: "0%", positive: true };
    if (previous === 0) {
      const isUp = current > 0;
      return {
        value: isUp ? "+100%" : "0%",
        positive: lowerIsBetter ? !isUp : isUp,
      };
    }
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const isUp = pct >= 0;
    return {
      value: `${isUp ? "+" : ""}${pct.toFixed(1)}%`,
      positive: lowerIsBetter ? !isUp : isUp,
    };
  }

  const { label: periodLabel } = computeRange();
  const receitaVar = variation(periodSummary.receitas, prevSummary.receitas);
  const despesaVar = variation(periodSummary.despesas, prevSummary.despesas, true);
  const saldoVar = variation(periodSummary.saldo, prevSummary.saldo);

  function prevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else { setSelectedMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else { setSelectedMonth((m) => m + 1); }
  }

  const visibleCategories = showAllCategories ? topCategories : topCategories.slice(0, 5);

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff",
  };

  return (
    <AppShell>
      {/* View mode tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-3">
        {([
          ["month", "Mensal"],
          ["3months", "3 meses"],
          ["6months", "6 meses"],
          ["year", "Este ano"],
        ] as Array<[ViewMode, string]>).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={`px-3 py-2 rounded-xl text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
              viewMode === v ? "glass-btn-active text-white" : "glass-btn text-white/45"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Month navigator (only in 'month' mode) */}
      {viewMode === "month" && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold tracking-wide">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white">
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {viewMode !== "month" && (
        <p className="text-center text-sm font-semibold tracking-wide mb-4">{periodLabel}</p>
      )}

      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {/* Resumo do periodo */}
          <div className="glass-divider pb-5">
            <h2 className="label-upper mb-3">Resumo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="label-upper">Receitas</span>
                </div>
                <p className="text-xl font-bold text-green-400">{formatCurrency(periodSummary.receitas)}</p>
                <div className="flex items-center gap-1 text-xs">
                  {receitaVar.positive ? (
                    <ArrowUpRight size={14} className="text-green-400" />
                  ) : (
                    <ArrowDownRight size={14} className="text-red-400" />
                  )}
                  <span className={receitaVar.positive ? "text-green-400" : "text-red-400"}>
                    {receitaVar.value}
                  </span>
                  <span className="text-white/30">vs anterior</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="label-upper">Despesas</span>
                </div>
                <p className="text-xl font-bold text-red-400">{formatCurrency(periodSummary.despesas)}</p>
                <div className="flex items-center gap-1 text-xs">
                  {despesaVar.positive ? (
                    <ArrowDownRight size={14} className="text-green-400" />
                  ) : (
                    <ArrowUpRight size={14} className="text-red-400" />
                  )}
                  <span className={despesaVar.positive ? "text-green-400" : "text-red-400"}>
                    {despesaVar.value}
                  </span>
                  <span className="text-white/30">vs anterior</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="label-upper">Saldo</span>
                <p className={`text-xl font-bold ${periodSummary.saldo >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(periodSummary.saldo)}
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
                  <span className="text-white/30">vs anterior</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-3">
              Inclui gastos de PIX/débito e de cartão de crédito (data da compra).
            </p>
          </div>

          {/* Evolucao 6 meses */}
          <div className="glass-divider pb-5">
            <h2 className="label-upper mb-3">Evolução (últimos 6 meses)</h2>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="grad-rec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="grad-des" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "receitas" ? "Receitas" : "Despesas",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}
                    formatter={(value) => value === "receitas" ? "Receitas" : "Despesas"}
                  />
                  <Area type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} fill="url(#grad-rec)" />
                  <Area type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} fill="url(#grad-des)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categorias */}
          <div className="glass-divider pb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="label-upper">Categorias de Gastos</h2>
              {topCategories.length > 5 && (
                <button
                  onClick={() => setShowAllCategories((s) => !s)}
                  className="text-[10px] text-[#6366F1] hover:underline flex items-center gap-1"
                >
                  {showAllCategories ? "Ver top 5" : `Ver todas (${topCategories.length})`}
                  {showAllCategories ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
            </div>
            {topCategories.length === 0 ? (
              <p className="text-white/30 text-sm">Sem despesas neste período.</p>
            ) : (
              <div className="space-y-4">
                {visibleCategories.map((cat) => {
                  const cfg = getCategoryConfig(cat.key);
                  const Icon = cfg.icon;
                  return (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + "20" }}>
                            <Icon size={14} style={{ color: cat.color }} />
                          </div>
                          <span className="text-sm font-medium">{cat.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white">{formatCurrency(cat.total)}</span>
                          <span className="text-xs text-white/45 ml-2">{cat.percent}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown por cartao */}
          {cardBreakdown.length > 0 && (
            <div className="glass-divider pb-5">
              <h2 className="label-upper mb-3">Por Cartão</h2>
              <div className="space-y-2">
                {cardBreakdown.map((c) => (
                  <div key={c.cardId} className="flex items-center justify-between p-3 glass-card">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: c.cardColor + "30" }}
                      >
                        <CreditCardIcon size={16} style={{ color: c.cardColor }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.cardName}</p>
                        <p className="text-[10px] text-white/40">Total gasto no período</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-white">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
