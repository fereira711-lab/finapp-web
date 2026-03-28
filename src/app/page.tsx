"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig, CATEGORY_CONFIG } from "@/lib/categories";
import { useBillAlerts } from "@/lib/useBillAlerts";
import type { Transaction, Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { Wallet, TrendingUp, TrendingDown, Clock, AlertTriangle, CreditCard, Target, X } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

interface MonthlyData { name: string; receitas: number; despesas: number; }
interface CategoryData { name: string; value: number; color: string; }
interface GoalProgress { category: string; label: string; color: string; spent: number; limit: number; pct: number; }

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    balance: 0, income: 0, expenses: 0, pendingBills: 0, cardTotal: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const alerts = useBillAlerts();

  // Modal states
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Income form
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Expenses list & pending bills for modals
  const [monthExpenses, setMonthExpenses] = useState<Transaction[]>([]);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);

  async function loadDashboard() {
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

    const [monthTxRes, billsRes, allTxRes, recentRes, cardTxRes, goalsRes, cardTxCatRes, pendingBillsRes] = await Promise.all([
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
      supabase.from("bills").select("amount").eq("user_id", user.id).eq("status", "pending")
        .gte("due_date", startStr).lte("due_date", endStr),
      supabase.from("transactions").select("amount, type, category, date")
        .eq("user_id", user.id).gte("date", sixMonthsAgo).order("date", { ascending: true }),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(5),
      supabase.from("card_transactions").select("amount")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("bills").select("*")
        .eq("user_id", user.id).eq("status", "pending")
        .gte("due_date", startStr).lte("due_date", endStr)
        .order("due_date", { ascending: true }),
    ]);

    const monthTx = (monthTxRes.data || []) as Transaction[];

    const income = monthTx
      .filter((t) => t.type === "income" || t.amount > 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenses = monthTx
      .filter((t) => t.type === "expense" || t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const pendingTotal = (billsRes.data || []).reduce((s, b) => s + b.amount, 0);
    const cardTotal = (cardTxRes.data || []).reduce((s, t) => s + t.amount, 0);

    // Saldo = receitas - despesas do mês
    const balance = income - expenses - cardTotal;

    setSummary({ balance, income, expenses, pendingBills: pendingTotal, cardTotal });

    // Expenses for modal
    const expensesList = monthTx
      .filter((t) => t.type === "expense" || t.amount < 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setMonthExpenses(expensesList);

    // Pending bills for modal
    setPendingBills((pendingBillsRes.data || []) as Bill[]);

    // Category pie chart
    const catMap: Record<string, number> = {};
    monthTx
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

    // Bar chart
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

    // Goals progress
    const goalSpentMap: Record<string, number> = {};
    monthTx
      .filter((t) => t.type === "expense" || t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "outros";
        goalSpentMap[cat] = (goalSpentMap[cat] || 0) + Math.abs(t.amount);
      });
    (cardTxCatRes.data || []).forEach((t) => {
      const cat = t.category || "outros";
      goalSpentMap[cat] = (goalSpentMap[cat] || 0) + Math.abs(t.amount);
    });

    const gProgress: GoalProgress[] = (goalsRes.data || []).map((g) => {
      const catCfg = getCategoryConfig(g.category);
      const spent = goalSpentMap[g.category] || 0;
      const limit = Number(g.monthly_limit);
      return {
        category: g.category, label: catCfg.label, color: catCfg.color,
        spent, limit, pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      };
    });
    gProgress.sort((a, b) => b.pct - a.pct);
    setGoalProgress(gProgress);

    setLoading(false);
  }

  useEffect(() => { loadDashboard(); }, []);

  async function handleSaveIncome() {
    if (!incomeDesc.trim() || !incomeAmount || !incomeDate) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const amount = parseFloat(incomeAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    await supabase.from("transactions").insert({
      user_id: user.id,
      description: incomeDesc.trim(),
      amount,
      date: incomeDate,
      type: "income",
      category: "salario",
      status: "completed",
    });

    setShowIncomeForm(false);
    setIncomeDesc("");
    setIncomeAmount("");
    setIncomeDate(new Date().toISOString().split("T")[0]);
    loadDashboard();
  }

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
            <Card title="Saldo do Mes" value={formatCurrency(summary.balance)}
              icon={<Wallet size={16} />} color={summary.balance >= 0 ? "text-white" : "text-red-400"} />
            <Card title="Receitas" value={formatCurrency(summary.income)}
              icon={<TrendingUp size={16} />} color="text-green-400"
              onClick={() => setShowIncomeForm(true)} />
            <Card title="Gastos do Mes" value={formatCurrency(totalGastos)}
              subtitle={summary.cardTotal > 0 ? `Debito/PIX ${formatCurrency(summary.expenses)} · Cartoes ${formatCurrency(summary.cardTotal)}` : undefined}
              icon={<TrendingDown size={16} />} color="text-red-400"
              onClick={() => setShowExpensesModal(true)} />
            <Card title="Pendentes" value={formatCurrency(summary.pendingBills)}
              icon={<Clock size={16} />} color="text-yellow-400"
              onClick={() => setShowPendingModal(true)} />
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

          {/* Goal Alerts */}
          {goalProgress.filter((g) => g.pct >= 80).length > 0 && (
            <Link href="/goals" className="block">
              <div className="glass-card p-4 space-y-2" style={{ borderColor: "rgba(234,179,8,0.5)" }}>
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-yellow-400" />
                  <span className="text-sm font-semibold">Metas em alerta</span>
                </div>
                <div className="space-y-1">
                  {goalProgress.filter((g) => g.pct >= 80).map((g) => (
                    <p key={g.category} className={`text-xs ${g.pct >= 100 ? "text-red-400" : "text-yellow-400"}`}>
                      {g.label}: {g.pct}% do limite atingido ({formatCurrency(g.spent)} / {formatCurrency(g.limit)})
                    </p>
                  ))}
                </div>
              </div>
            </Link>
          )}

          {/* Goals Widget - Top 3 */}
          {goalProgress.length > 0 && (
            <div className="glass-divider pb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="label-upper">Metas do Mes</h2>
                <Link href="/goals" className="text-[10px] text-[#6366F1] hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-3">
                {goalProgress.slice(0, 3).map((g) => {
                  const barWidth = Math.min(g.pct, 100);
                  const barColor = g.pct > 100 ? "bg-red-500" : g.pct >= 70 ? "bg-yellow-500" : "bg-green-500";
                  const textColor = g.pct > 100 ? "text-red-400" : g.pct >= 70 ? "text-yellow-400" : "text-green-400";
                  return (
                    <div key={g.category} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{g.label}</span>
                        <span className={`text-xs font-bold ${textColor}`}>{g.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
                      </div>
                      <p className="text-[10px] text-white/30">{formatCurrency(g.spent)} / {formatCurrency(g.limit)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="space-y-4">
            <div className="glass-divider pb-5">
              <h2 className="label-upper mb-3">Gastos por Categoria</h2>
              {categoryData.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Sem despesas este mes</p>
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
            <h2 className="label-upper mb-3">Ultimas Transacoes</h2>
            {recentTx.length === 0 ? (
              <p className="text-white/30 text-sm">Nenhuma transacao encontrada.</p>
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

      {/* === MODAL: Nova Receita === */}
      {showIncomeForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowIncomeForm(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova Receita</h2>
              <button onClick={() => setShowIncomeForm(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label-upper mb-1 block">Descricao</label>
                <input type="text" value={incomeDesc} onChange={(e) => setIncomeDesc(e.target.value)}
                  placeholder="Ex: Salario, Freelance" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="label-upper mb-1 block">Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder="3000.00" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="label-upper mb-1 block">Data</label>
                <input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleSaveIncome} className="glass-btn-active w-full py-2.5 text-sm font-medium">
              Salvar Receita
            </button>
          </div>
        </div>
      )}

      {/* === MODAL: Gastos do Mes === */}
      {showExpensesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowExpensesModal(false)}>
          <div className="glass w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Gastos do Mes</h2>
              <button onClick={() => setShowExpensesModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {monthExpenses.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Nenhum gasto este mes</p>
              ) : (
                monthExpenses.map((t) => {
                  const cat = getCategoryConfig(t.category);
                  const Icon = cat.icon;
                  return (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}>
                          <Icon size={14} style={{ color: cat.color }} />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{t.description}</p>
                          <p className="text-[10px] text-white/30">{formatDate(t.date)} · {cat.label}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-red-400">-{formatCurrency(Math.abs(t.amount))}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Total</span>
                <span className="font-bold text-red-400">{formatCurrency(totalGastos)}</span>
              </div>
              <Link href="/transactions" onClick={() => setShowExpensesModal(false)}
                className="block text-center glass-btn py-2 text-xs">
                Ver todas as transacoes
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Contas Pendentes === */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPendingModal(false)}>
          <div className="glass w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Contas Pendentes</h2>
              <button onClick={() => setShowPendingModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {pendingBills.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Nenhuma conta pendente este mes</p>
              ) : (
                pendingBills.map((b) => {
                  const isOverdue = new Date(b.due_date + "T23:59:59") < new Date();
                  return (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-xs font-medium">{b.description}</p>
                        <p className={`text-[10px] ${isOverdue ? "text-red-400" : "text-white/30"}`}>
                          {isOverdue ? "Vencida em " : "Vence em "}{formatDate(b.due_date)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${isOverdue ? "text-red-400" : "text-yellow-400"}`}>
                        {formatCurrency(b.amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Total pendente</span>
                <span className="font-bold text-yellow-400">{formatCurrency(summary.pendingBills)}</span>
              </div>
              <Link href="/bills" onClick={() => setShowPendingModal(false)}
                className="block text-center glass-btn py-2 text-xs">
                Ver todas as contas
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
