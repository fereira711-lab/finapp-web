"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import type { Transaction } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Plus, X } from "lucide-react";

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
      return { start: new Date(y, m, 1).toISOString(), end: new Date(y, m + 1, 0).toISOString() };
    case "previous":
      return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 0).toISOString() };
    case "3months":
      return { start: new Date(y, m - 2, 1).toISOString(), end: new Date(y, m + 1, 0).toISOString() };
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState("todas");
  const [period, setPeriod] = useState<PeriodValue>("current");
  const [loading, setLoading] = useState(true);
  const { categories, addCategory } = useCategories();
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
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
    ...categories.map((c) => ({ value: c.name, label: c.label })),
  ];

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    await addCategory(newCatName);
    setNewCatName("");
    setShowNewCat(false);
  }

  return (
    <AppShell>
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <select
            value={category}
            onChange={(e) => {
              if (e.target.value === "__add__") { setShowNewCat(true); return; }
              setCategory(e.target.value);
            }}
            className="glass-input px-4 py-3 text-base md:text-sm text-white w-full"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
                {opt.label}
              </option>
            ))}
            <option value="__add__" className="bg-[#1a1a2e]">+ Adicionar categoria</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 rounded-xl text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                period === p.value
                  ? "glass-btn-active text-white"
                  : "glass-btn text-white/45"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4 glass-divider pb-4">
        <div className="glass-card p-3">
          <p className="label-upper mb-1">Receitas</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="label-upper mb-1">Gastos</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-white/30">Nenhum gasto encontrado.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => {
            const cat = getCategoryConfig(t.category);
            const Icon = cat.icon;
            const isIncome = t.type === "income" || t.amount > 0;

            return (
              <div key={t.id} className="flex items-center justify-between py-3 glass-divider">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "20" }}
                  >
                    <Icon size={18} style={{ color: cat.color }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.description}</p>
                    <p className="text-xs text-white/30">
                      {cat.label} &middot; {formatDate(t.date)}
                    </p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${isIncome ? "text-green-400" : "text-red-400"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(Math.abs(t.amount))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Categoria */}
      {showNewCat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewCat(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova Categoria</h2>
              <button onClick={() => setShowNewCat(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="label-upper mb-1 block">Nome</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Assinaturas, Pet..."
                className="glass-input w-full px-3 py-2 text-sm text-white"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                autoFocus
              />
            </div>
            <button onClick={handleAddCategory} className="glass-btn-active w-full py-2.5 text-sm font-medium">
              Adicionar
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
