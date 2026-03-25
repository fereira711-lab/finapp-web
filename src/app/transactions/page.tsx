"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig, CATEGORY_CONFIG } from "@/lib/categories";
import type { Transaction } from "@/lib/types";
import AppShell from "@/components/AppShell";

const PERIODS = [
  { label: "Este mês", value: "current" },
  { label: "Mês anterior", value: "previous" },
  { label: "Últimos 3 meses", value: "3months" },
] as const;

type PeriodValue = (typeof PERIODS)[number]["value"];

function getDateRange(period: PeriodValue): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "current":
      return {
        start: new Date(y, m, 1).toISOString(),
        end: new Date(y, m + 1, 0).toISOString(),
      };
    case "previous":
      return {
        start: new Date(y, m - 1, 1).toISOString(),
        end: new Date(y, m, 0).toISOString(),
      };
    case "3months":
      return {
        start: new Date(y, m - 2, 1).toISOString(),
        end: new Date(y, m + 1, 0).toISOString(),
      };
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState("todas");
  const [period, setPeriod] = useState<PeriodValue>("current");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = getDateRange(period);

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (category !== "todas") {
        query = query.eq("category", category);
      }

      const { data } = await query;
      setTransactions(data || []);
      setLoading(false);
    }
    load();
  }, [category, period]);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense" || t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const totalIncome = transactions
    .filter((t) => t.type === "income" || t.amount > 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const categoryOptions = [
    { value: "todas", label: "Todas as categorias" },
    ...Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
  ];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Transações</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
        >
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                period === p.value
                  ? "bg-primary text-white"
                  : "bg-dark-800 text-gray-400 hover:text-white border border-dark-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-xs text-gray-400">Receitas no período</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-xs text-gray-400">Gastos no período</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => {
            const cat = getCategoryConfig(t.category);
            const Icon = cat.icon;
            const isIncome = t.type === "income" || t.amount > 0;

            return (
              <div
                key={t.id}
                className="bg-dark-800 rounded-xl p-4 flex items-center justify-between border border-dark-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "20" }}
                  >
                    <Icon size={18} style={{ color: cat.color }} />
                  </div>
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-xs text-gray-400">
                      {cat.label} &middot; {formatDate(t.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-bold ${isIncome ? "text-green-400" : "text-red-400"}`}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
