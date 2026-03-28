"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import { useBillAlerts } from "@/lib/useBillAlerts";
import type { Transaction } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { Wallet, TrendingUp, TrendingDown, Clock, AlertTriangle, CreditCard } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

interface MonthlyData { name: string; receitas: number; despesas: number; }
interface CategoryData { name: string; value: number; color: string; }

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    balance: 0, income: 0, expenses: 0, pendingBills: 0, cardTotal: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const alerts = useBillAlerts();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const [accountsRes, monthTxRes, billsRes, allTxRes, recentRes, cardTxRes] = await Promise.all([
        supabase.from("accounts").select("balance").eq("user_id", user.id),
        supabase.from("transactions").select("amount, type, category")
          .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
        supabase.from("bills").select("amount").eq("user_id", user.id).eq("status", "pending"),
        supabase.from("transactions").select("amount, type, category, date")
          .eq("user_id", user.id).gte("date", sixMonthsAgo).order("date", { ascending: true }),
        supabase.from("transactions").select("*")
          .eq("user_id", user.id).order("date", { ascending: false }).limit(5),
        supabase.from("card_transactions").select("amount")
          .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      ]);

      const balance = (accountsRes.data || []).reduce((s, a) => s + a.balance, 0);
      const income = (monthTxRes.data || [])
        .filter((t) => t.type === "income" || t.amount > 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = (monthTxRes.data || [])
        .filter((t) => t.type === "expense" || t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const pendingBills = (billsRes.data || []).reduce((s, b) => s + b.amount, 0);
      const cardTotal = (cardTxRes.data || []).reduce((s, t) => s + t.amount, 0);
      setSummary({ balance, income, expenses, pendingBills, cardTotal });

      const catMap: Record<string, number> = {};
      (monthTxRes.data || [])
        .filter((t) => t.type === "expense" || t.amount < 0)
        .forEach((t) => {
          const cat = t.category || "outros";
          catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
        });

      const pieData = Object.entries(catMap)
        .map(([key, value]) => ({
          name: getCategoryConfig(key).label, value,
          color: getCategoryConfig(key).color,
        }))
        .sort((a, b) => b.value - a.value);
      setCategoryData(pieData);

      const monthMap: Record<string, { receitas: number; despesas: number }> = {};
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { receitas: 0, despesas: 0 };
      }

      (allTxRes.data || []).forEach((t) => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[key]) {
          if (t.type === "income" || t.amount > 0) {
            monthMap[key].receitas += Math.abs(t.amount);
          } else {
            monthMap[key].despesas += Math.abs(t.amount);
          }
        }
      });

      const barData = Object.entries(monthMap).map(([key, val]) => {
        const [, m] = key.split("-");
        return {
          name: monthNames[parseInt(m) - 1],
          receitas: Math.round(val.receitas * 100) / 100,
          despesas: Math.round(val.despesas * 100) / 100,
        };
      });
      setMonthlyData(barData);

      setRecentTx((recentRes.data as Transaction[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff",
  };

  const totalGastos = summary.expenses + summary.cardTotal;

  return (
    <AppShell>
      {loading ? (
        <div className="text-white/45">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card title="Saldo Total" value={formatCurrency(summary.balance)}
              icon={<Wallet size={16} />} color="text-white" />
            <Card title="Receitas" value={formatCurrency(summary.income)}
              icon={<TrendingUp size={16} />} color="text-green-400" />
            <Card title="Gastos do Mes" value={formatCurrency(totalGastos)}
              subtitle={summary.cardTotal > 0 ? `Debito/PIX ${formatCurrency(summary.expenses)} · Cartoes ${formatCurrency(summary.cardTotal)}` : undefined}
              icon={<TrendingDown size={16} />} color="text-red-400" />
            <Card title="Pendentes" value={formatCurrency(summary.pendingBills)}
              icon={<Clock size={16} />} color="text-yellow-400" />
          </div>

          {/* Card total highlight */}
          {summary.cardTotal > 0 && (
            <Link href="/credit-cards" className="block">
              <div className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-[#6366F1]" />
                  <div>
                    <p className="text-sm font-medium">Faturas de cartao</p>
                    <p className="text-[11px] text-white/40">Total do mes nos cartoes</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-[#6366F1]">{formatCurrency(summary.cardTotal)}</span>
              </div>
            </Link>
          )}

          {/* Alertas */}
          {!alerts.loading && (alerts.overdue.length > 0 || alerts.today.length > 0 || alerts.tomorrow.length > 0) && (
            <Link href="/bills" className="block">
              <div className="glass-card p-4 space-y-2" style={{ borderColor: alerts.overdue.length > 0 ? "rgba(239,68,68,0.5)" : "rgba(234,179,8,0.5)" }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className={alerts.overdue.length > 0 ? "text-red-400" : "text-yellow-400"} />
                  <span className="text-sm font-semibold">
                    {alerts.overdue.length + alerts.today.length + alerts.tomorrow.length} conta(s) precisam de atenção
                  </span>
                </div>
                <div className="space-y-1">
                  {alerts.overdue.map((b) => (
                    <p key={b.id} className="text-xs text-red-400">Atrasada: {b.description} — {formatCurrency(b.amount)}</p>
                  ))}
                  {alerts.today.map((b) => (
                    <p key={b.id} className="text-xs text-yellow-400">Vence hoje: {b.description} — {formatCurrency(b.amount)}</p>
                  ))}
                  {alerts.tomorrow.map((b) => (
                    <p key={b.id} className="text-xs text-orange-400">Vence amanhã: {b.description} — {formatCurrency(b.amount)}</p>
                  ))}
                </div>
              </div>
            </Link>
          )}

          {/* Charts */}
          <div className="space-y-4">
            <div className="glass-divider pb-5">
              <h2 className="label-upper mb-3">Gastos por Categoria</h2>
              {categoryData.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Sem despesas este mês</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        dataKey="value" stroke="none">
                        {categoryData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full sm:flex-1 space-y-2">
                    {categoryData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-white/60 text-xs">{item.name}</span>
                        </div>
                        <span className="text-white/45 text-xs">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="label-upper mb-3">Receitas vs Despesas</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ left: -10, right: 5 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                  <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="glass-divider pt-4">
            <h2 className="label-upper mb-3">Últimas Transações</h2>
            {recentTx.length === 0 ? (
              <p className="text-white/30 text-sm">Nenhuma transação encontrada.</p>
            ) : (
              <div className="space-y-3">
                {recentTx.map((t) => {
                  const cat = getCategoryConfig(t.category);
                  const Icon = cat.icon;
                  return (
                    <div key={t.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}>
                          <Icon size={16} style={{ color: cat.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.description}</p>
                          <p className="text-xs text-white/30">{formatDate(t.date)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${t.type === "income" || t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {t.type === "income" || t.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(t.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
