"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig, CATEGORY_CONFIG } from "@/lib/categories";
import type { Transaction } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { Wallet, TrendingUp, TrendingDown, Clock } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface MonthlyData {
  name: string;
  receitas: number;
  despesas: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
    pendingBills: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      // 6 months ago for bar chart
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const [accountsRes, monthTxRes, billsRes, allTxRes, recentRes] = await Promise.all([
        supabase.from("accounts").select("balance").eq("user_id", user.id),
        supabase
          .from("transactions")
          .select("amount, type, category")
          .eq("user_id", user.id)
          .gte("date", startOfMonth)
          .lte("date", endOfMonth),
        supabase
          .from("bills")
          .select("amount")
          .eq("user_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("transactions")
          .select("amount, type, category, date")
          .eq("user_id", user.id)
          .gte("date", sixMonthsAgo)
          .order("date", { ascending: true }),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5),
      ]);

      // Summary cards
      const balance = (accountsRes.data || []).reduce((s, a) => s + a.balance, 0);
      const income = (monthTxRes.data || [])
        .filter((t) => t.type === "income" || t.amount > 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = (monthTxRes.data || [])
        .filter((t) => t.type === "expense" || t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const pendingBills = (billsRes.data || []).reduce((s, b) => s + b.amount, 0);
      setSummary({ balance, income, expenses, pendingBills });

      // Category pie chart (current month expenses)
      const catMap: Record<string, number> = {};
      (monthTxRes.data || [])
        .filter((t) => t.type === "expense" || t.amount < 0)
        .forEach((t) => {
          const cat = t.category || "outros";
          catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
        });

      // Also check allTxRes for current month if monthTxRes has no category
      const pieData = Object.entries(catMap)
        .map(([key, value]) => ({
          name: getCategoryConfig(key).label,
          value,
          color: getCategoryConfig(key).color,
        }))
        .sort((a, b) => b.value - a.value);
      setCategoryData(pieData);

      // Monthly bar chart
      const monthMap: Record<string, { receitas: number; despesas: number }> = {};
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      // Initialize last 6 months
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

  return (
    <AppShell>
      <h1 className="hidden md:block text-2xl font-bold mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut Chart */}
            <div className="bg-dark-800 rounded-2xl p-4 md:p-5 border border-dark-700">
              <h2 className="text-sm text-gray-400 mb-4">Gastos por Categoria</h2>
              {categoryData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Sem despesas este mês
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{
                          background: "#1E293B",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full sm:flex-1 space-y-2">
                    {categoryData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-300 text-xs sm:text-sm">{item.name}</span>
                        </div>
                        <span className="text-gray-400 text-xs sm:text-sm">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div className="bg-dark-800 rounded-2xl p-4 md:p-5 border border-dark-700">
              <h2 className="text-sm text-gray-400 mb-4">Receitas vs Despesas (6 meses)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ left: -10, right: 5 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: "#94A3B8", fontSize: 11 }}
                  />
                  <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
            <h2 className="text-sm text-gray-400 mb-4">Últimas Transações</h2>
            {recentTx.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma transação encontrada.</p>
            ) : (
              <div className="space-y-3">
                {recentTx.map((t) => {
                  const cat = getCategoryConfig(t.category);
                  const Icon = cat.icon;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}
                        >
                          <Icon size={16} style={{ color: cat.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          t.type === "income" || t.amount > 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {t.type === "income" || t.amount > 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(t.amount))}
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
