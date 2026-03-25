"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";

const FILTERS = ["Todas", "pending", "paid", "overdue"] as const;
const FILTER_LABELS: Record<string, string> = {
  Todas: "Todas",
  pending: "Pendentes",
  paid: "Pagas",
  overdue: "Atrasadas",
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<string>("Todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("bills")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });

      if (filter !== "Todas") {
        query = query.eq("status", filter);
      }

      const { data } = await query;
      setBills(data || []);
      setLoading(false);
    }
    load();
  }, [filter]);

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-400/10",
    paid: "text-green-400 bg-green-400/10",
    overdue: "text-red-400 bg-red-400/10",
  };

  const statusLabel: Record<string, string> = {
    pending: "Pendente",
    paid: "Paga",
    overdue: "Atrasada",
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Contas</h1>

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              filter === f
                ? "bg-primary text-white"
                : "bg-dark-800 text-gray-400 hover:text-white"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : bills.length === 0 ? (
        <p className="text-gray-500">Nenhuma conta encontrada.</p>
      ) : (
        <div className="space-y-3">
          {bills.map((b) => (
            <div
              key={b.id}
              className="bg-dark-800 rounded-xl p-4 flex items-center justify-between border border-dark-700"
            >
              <div>
                <p className="font-medium">{b.description}</p>
                <p className="text-xs text-gray-400">
                  Vence em {formatDate(b.due_date)} •{" "}
                  {b.type === "payable" ? "A pagar" : "A receber"}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold">{formatCurrency(b.amount)}</span>
                <span
                  className={`block text-xs px-2 py-0.5 rounded-full mt-1 ${
                    statusColor[b.status]
                  }`}
                >
                  {statusLabel[b.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
