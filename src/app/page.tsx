"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig, CATEGORY_CONFIG } from "@/lib/categories";
import { useBillAlerts } from "@/lib/useBillAlerts";
import type { Transaction, Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import {
  Wallet, TrendingDown, FileText, Calculator,
  AlertTriangle, CreditCard, Target, X,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

interface CategoryData { name: string; value: number; color: string; }
interface GoalProgress { category: string; label: string; color: string; spent: number; limit: number; pct: number; }

/* ── Modal: Editar Saldo ─────────────────────────── */
function BalanceModal({
  open, currentBalance, onClose, onSave,
}: {
  open: boolean; currentBalance: number; onClose: () => void; onSave: (value: number) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentBalance.toFixed(2).replace(".", ","));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, currentBalance]);

  if (!open) return null;

  function handleSave() {
    const parsed = parseFloat(value.replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed)) onSave(parsed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass w-full max-w-sm p-5 relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Atualizar Saldo</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="label-upper block mb-1">Saldo atual (R$)</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="glass-input w-full px-3 py-2 text-sm text-white"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <button
          onClick={handleSave}
          className="glass-btn-active w-full py-2.5 text-sm font-medium"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────── */
export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState(0);
  const [cardTotal, setCardTotal] = useState(0);
  const [pendingBillsTotal, setPendingBillsTotal] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState<Transaction[]>([]);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const alerts = useBillAlerts();

  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const totalGastos = expenses + cardTotal;
  const valorFinal = balance - totalGastos - pendingBillsTotal;

  async function loadDashboard() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [accountsRes, monthTxRes, billsRes, recentRes, cardTxRes, goalsRes, cardTxCatRes, pendingBillsRes] = await Promise.all([
      supabase.from("accounts").select("id, balance, name").eq("user_id", user.id),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
      supabase.from("bills").select("amount, type").eq("user_id", user.id).eq("status", "pending")
        .gte("due_date", startStr).lte("due_date", endStr),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(5),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("bills").select("*")
        .eq("user_id", user.id).eq("status", "pending")
        .gte("due_date", startStr).lte("due_date", endStr)
        .order("due_date", { ascending: true }),
    ]);

    // Saldo — busca conta "Carteira" ou usa soma de todas
    const accounts = accountsRes.data || [];
    const wallet = accounts.find((a) => a.name?.toLowerCase() === "carteira");
    if (wallet) {
      setBalance(wallet.balance);
      setWalletAccountId(wallet.id);
    } else {
      setBalance(accounts.reduce((s, a) => s + a.balance, 0));
      setWalletAccountId(null);
    }

    const monthTx = (monthTxRes.data || []) as Transaction[];

    // Gastos do mes (transacoes)
    const expTx = monthTx.filter((t) => t.type === "expense" || t.amount < 0);
    const totalExpenses = expTx.reduce((s, t) => s + Math.abs(t.amount), 0);
    setExpenses(totalExpenses);
    setMonthExpenses(expTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Gastos cartao
    const cardTxTotal = (cardTxRes.data || []).reduce((s, t) => s + t.amount, 0);
    setCardTotal(cardTxTotal);

    // Contas a pagar pendentes (apenas payable)
    const allBills = (billsRes.data || []);
    const payableBills = allBills.filter((b) => b.type === "payable");
    const totalPending = payableBills.reduce((s, b) => s + b.amount, 0);
    setPendingBillsTotal(totalPending);
    setPendingBills(((pendingBillsRes.data || []) as Bill[]).filter((b) => b.type === "payable"));

    // Grafico por categoria (transacoes + cartao)
    const catMap: Record<string, number> = {};
    expTx.forEach((t) => {
      const cat = t.category || "outros";
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
    });
    (cardTxCatRes.data || []).forEach((t) => {
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

    setRecentTx((recentRes.data as Transaction[]) || []);

    // Goals progress
    const goalSpentMap: Record<string, number> = {};
    expTx.forEach((t) => {
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

  async function handleSaveBalance(newBalance: number) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (walletAccountId) {
      await supabase.from("accounts").update({ balance: newBalance }).eq("id", walletAccountId);
    } else {
      const { data } = await supabase.from("accounts").insert({
        user_id: user.id, name: "Carteira", bank_name: "Manual",
        account_type: "checking", balance: newBalance,
      }).select("id").single();
      if (data) setWalletAccountId(data.id);
    }

    setBalance(newBalance);
    setShowBalanceModal(false);
  }

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff",
  };

  return (
    <AppShell>
      {loading ? (
        <div className="text-white/45">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {/* ── 4 Summary Cards (4 cols desktop, 2x2 mobile) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card title="Saldo Atual" value={formatCurrency(balance)}
              subtitle="Toque para editar"
              icon={<Wallet size={16} />} color="text-white"
              onClick={() => setShowBalanceModal(true)} />
            <Card title="Gastos do Mes" value={formatCurrency(totalGastos)}
              subtitle={cardTotal > 0 ? `Debito ${formatCurrency(expenses)} · Cartao ${formatCurrency(cardTotal)}` : `${monthExpenses.length} transacao(oes)`}
              icon={<TrendingDown size={16} />} color="text-red-400"
              onClick={() => setShowExpensesModal(true)} />
            <Card title="Contas a Pagar" value={formatCurrency(pendingBillsTotal)}
              subtitle={`${pendingBills.length} pendente(s)`}
              icon={<FileText size={16} />} color="text-yellow-400"
              onClick={() => setShowPendingModal(true)} />
            <Card title="Valor Final" value={formatCurrency(valorFinal)}
              subtitle="Saldo − Gastos − Contas"
              icon={<Calculator size={16} />}
              color={valorFinal >= 0 ? "text-green-400" : "text-red-400"} />
          </div>

          {/* Card total highlight */}
          {cardTotal > 0 && (
            <Link href="/credit-cards" className="block">
              <div className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-[#6366F1]" />
                  <div>
                    <p className="text-sm font-medium">Faturas de cartao</p>
                    <p className="text-[11px] text-white/40">Total do mes nos cartoes</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-[#6366F1]">{formatCurrency(cardTotal)}</span>
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
                    {alerts.overdue.length + alerts.today.length + alerts.tomorrow.length} conta(s) precisam de atencao
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
                    <p key={b.id} className="text-xs text-orange-400">Vence amanha: {b.description} — {formatCurrency(b.amount)}</p>
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

          {/* Gastos por Categoria */}
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

          {/* Ultimas Transacoes */}
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

      {/* ── Modal: Saldo Atual ── */}
      <BalanceModal
        open={showBalanceModal}
        currentBalance={balance}
        onClose={() => setShowBalanceModal(false)}
        onSave={handleSaveBalance}
      />

      {/* ── Modal: Gastos do Mes ── */}
      {showExpensesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
          onClick={() => setShowExpensesModal(false)}>
          <div className="glass w-full max-w-md max-h-[80vh] flex flex-col md:mx-4 md:rounded-2xl rounded-t-2xl rounded-b-none md:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-sm font-bold">Gastos do Mes</h2>
              <button onClick={() => setShowExpensesModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {monthExpenses.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Nenhum gasto este mes</p>
              ) : (
                monthExpenses.map((t) => {
                  const cat = getCategoryConfig(t.category);
                  const Icon = cat.icon;
                  return (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: cat.color + "20" }}>
                          <Icon size={14} style={{ color: cat.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{t.description}</p>
                          <p className="text-[10px] text-white/30">{formatDate(t.date)} · {cat.label}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-red-400 flex-shrink-0 ml-2">
                        -{formatCurrency(Math.abs(t.amount))}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t border-white/10 space-y-3">
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

      {/* ── Modal: Contas Pendentes ── */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
          onClick={() => setShowPendingModal(false)}>
          <div className="glass w-full max-w-md max-h-[80vh] flex flex-col md:mx-4 md:rounded-2xl rounded-t-2xl rounded-b-none md:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-sm font-bold">Contas a Pagar</h2>
              <button onClick={() => setShowPendingModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {pendingBills.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Nenhuma conta pendente este mes</p>
              ) : (
                pendingBills.map((b) => {
                  const dueDate = new Date(b.due_date + "T12:00:00");
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isOverdue = dueDate < today;
                  const isToday = dueDate.toDateString() === today.toDateString();
                  return (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{b.description}</p>
                        <p className={`text-[10px] ${isOverdue ? "text-red-400" : "text-white/30"}`}>
                          {isOverdue ? "Vencida em " : isToday ? "Vence hoje" : "Vence em "}{!isToday && formatDate(b.due_date)}
                          {isOverdue && <span> · Atrasada</span>}
                        </p>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ml-2 ${isOverdue ? "text-red-400" : "text-yellow-400"}`}>
                        {formatCurrency(b.amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Total pendente</span>
                <span className="font-bold text-yellow-400">{formatCurrency(pendingBillsTotal)}</span>
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
