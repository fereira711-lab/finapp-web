"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { Wallet, TrendingUp, TrendingDown, Clock } from "lucide-react";

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
    pendingBills: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const [accountsRes, transactionsRes, billsRes] = await Promise.all([
        supabase.from("accounts").select("balance").eq("user_id", user.id),
        supabase
          .from("transactions")
          .select("amount, type")
          .eq("user_id", user.id)
          .gte("date", startOfMonth)
          .lte("date", endOfMonth),
        supabase
          .from("bills")
          .select("amount")
          .eq("user_id", user.id)
          .eq("status", "pending"),
      ]);

      const balance = (accountsRes.data || []).reduce((s, a) => s + a.balance, 0);
      const income = (transactionsRes.data || [])
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const expenses = (transactionsRes.data || [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const pendingBills = (billsRes.data || []).reduce((s, b) => s + b.amount, 0);

      setSummary({ balance, income, expenses, pendingBills });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            title="Saldo Total"
            value={formatCurrency(summary.balance)}
            icon={<Wallet size={18} />}
            color="text-white"
          />
          <Card
            title="Receitas do Mês"
            value={formatCurrency(summary.income)}
            icon={<TrendingUp size={18} />}
            color="text-green-400"
          />
          <Card
            title="Gastos do Mês"
            value={formatCurrency(summary.expenses)}
            icon={<TrendingDown size={18} />}
            color="text-red-400"
          />
          <Card
            title="Contas Pendentes"
            value={formatCurrency(summary.pendingBills)}
            icon={<Clock size={18} />}
            color="text-yellow-400"
          />
        </div>
      )}
    </AppShell>
  );
}
