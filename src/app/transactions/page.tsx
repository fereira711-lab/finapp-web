"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import AppShell from "@/components/AppShell";

const CATEGORIES = [
  "Todas",
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Salário",
  "Investimento",
  "Outros",
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState("Todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (category !== "Todas") {
        query = query.eq("category", category);
      }

      const { data } = await query;
      setTransactions(data || []);
      setLoading(false);
    }
    load();
  }, [category]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Transações</h1>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => { setCategory(c); setLoading(true); }}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              category === c
                ? "bg-primary text-white"
                : "bg-dark-800 text-gray-400 hover:text-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="bg-dark-800 rounded-xl p-4 flex items-center justify-between border border-dark-700"
            >
              <div>
                <p className="font-medium">{t.description}</p>
                <p className="text-xs text-gray-400">
                  {t.category} • {formatDate(t.date)}
                </p>
              </div>
              <span
                className={`font-bold ${
                  t.type === "income" ? "text-green-400" : "text-red-400"
                }`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatCurrency(Math.abs(t.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
