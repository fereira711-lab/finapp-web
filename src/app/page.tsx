"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import { useBillAlerts } from "@/lib/useBillAlerts";
import type { Transaction, Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { DashboardSkeleton } from "@/components/Skeleton";
import BalanceModal from "@/components/dashboard/BalanceModal";
import QuickAddModal from "@/components/dashboard/QuickAddModal";
import {
  Wallet, FileText, Calculator,
  AlertTriangle, CreditCard, Target, X,
  ArrowUpRight, ArrowDownRight, Lightbulb, Plus, Trash2,
} from "lucide-react";
import { updateWalletBalance } from "@/lib/wallet";
import { materializeRecurringTemplates } from "@/lib/recurring";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

interface CategoryData { name: string; value: number; color: string; }
interface GoalProgress { category: string; label: string; color: string; spent: number; limit: number; pct: number; }
type RecentTxRow = {
  id: string;
  source: "transaction" | "card";
  description: string;
  amount: number;
  category: string;
  date: string;
  type: "income" | "expense";
  cardId?: string;
  cardName?: string;
  cardColor?: string;
  installmentLabel?: string;
  installments?: number;
  installmentCurrent?: number;
};

/* ── Dashboard ───────────────────────────────────── */
export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState(0);
  const [cardTotal, setCardTotal] = useState(0);
  const [cardCategoryData, setCardCategoryData] = useState<CategoryData[]>([]);
  const [pendingBillsTotal, setPendingBillsTotal] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState<Transaction[]>([]);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [pendingCardItems, setPendingCardItems] = useState<Array<{ name: string; amount: number; dueDay: number }>>([]);
  const [generalCategoryData, setGeneralCategoryData] = useState<CategoryData[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTxRow[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiveDates, setReceiveDates] = useState<Array<{ date: string; amount: number }>>([]);
  const alerts = useBillAlerts();

  // Receitas/Despesas + variacao vs mes anterior
  const [receitas, setReceitas] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [prevReceitas, setPrevReceitas] = useState(0);
  const [prevDespesas, setPrevDespesas] = useState(0);

  // Insights e projecao
  const [insights, setInsights] = useState<string[]>([]);
  const [projection, setProjection] = useState<number | null>(null);

  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Quick Add (FAB)
  const [cardsForQuickAdd, setCardsForQuickAdd] = useState<Array<{
    id: string; name: string; color: string; status: string; closing_day: number; due_day: number;
  }>>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Delete confirmation (linha de Ultimas Transacoes)
  const [deleteRow, setDeleteRow] = useState<RecentTxRow | null>(null);
  const [deleteAllInst, setDeleteAllInst] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delToast, setDelToast] = useState<string | null>(null);

  function showDelToast(msg: string) {
    setDelToast(msg);
    setTimeout(() => setDelToast(null), 3000);
  }

  // Valor Final = Saldo Atual (com recebimentos) - Contas a Pagar Pendentes
  const totalToReceive = receiveDates.reduce((s, d) => s + d.amount, 0);
  const balanceWithReceive = balance + totalToReceive;
  const valorFinal = balanceWithReceive - pendingBillsTotal;

  async function loadDashboard() {
    try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Materializa templates recorrentes do mes (se houver pendentes)
    try { await materializeRecurringTemplates(supabase, user.id); } catch (e) { console.warn("recurring materialize failed", e); }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Mes anterior (para variacao)
    const prevStartStr = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}-01`;
    const prevEndDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const prevEndStr = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}-${String(prevEndDay).padStart(2, "0")}`;

    const [accountsRes, monthTxRes, billsRes, recentTxRes, recentCardTxRes, cardTxRes, goalsRes, cardTxCatRes, pendingBillsRes, creditCardsRes, prevTxRes, prevCardTxRes, profileRes] = await Promise.all([
      supabase.from("accounts").select("id, balance, name").eq("user_id", user.id),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
      supabase.from("bills").select("amount, type, status").eq("user_id", user.id)
        .gte("due_date", startStr).lte("due_date", endStr),
      // recentTxRes: ultimas transactions
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      // recentCardTxRes: ultimas card_transactions
      supabase.from("card_transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      // cardTxRes: total da fatura → filtra por bill_date
      supabase.from("card_transactions").select("amount, category, card_id")
        .eq("user_id", user.id).gte("bill_date", startStr).lte("bill_date", endStr),
      supabase.from("goals").select("*").eq("user_id", user.id),
      // cardTxCatRes: gastos do mes (orcamento de metas) → filtra por date (data da compra)
      supabase.from("card_transactions").select("amount, category, card_id")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("bills").select("*")
        .eq("user_id", user.id).eq("type", "payable").neq("status", "paid")
        .gte("due_date", startStr).lte("due_date", endStr)
        .order("due_date", { ascending: true }),
      supabase.from("credit_cards").select("id, name, color, status, credit_limit, closing_day, due_day").eq("user_id", user.id),
      // prev month para variacao
      supabase.from("transactions").select("amount, type, category")
        .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
      supabase.from("profiles").select("receive_dates").eq("id", user.id).maybeSingle(),
    ]);

    const rawReceive = (profileRes.data?.receive_dates ?? []) as Array<{ date: string; amount: number }>;
    setReceiveDates(Array.isArray(rawReceive) ? rawReceive : []);

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

    // Cartões e transações
    const creditCards = (creditCardsRes.data || []) as Array<{ id: string; name: string; color: string; status: string; closing_day: number; due_day: number }>;
    const cardById: Record<string, { name: string; color: string }> = {};
    creditCards.forEach((c) => { cardById[c.id] = { name: c.name, color: c.color }; });
    setCardsForQuickAdd(creditCards);
    const cardTxData = (cardTxRes.data || []) as Array<{ amount: number; card_id: string }>;

    // Gastos cartao (apenas cartões não pagos)
    const unpaidCardIds = creditCards.filter((c) => c.status !== "paid").map((c) => c.id);
    const cardTxTotal = cardTxData
      .filter((t) => unpaidCardIds.includes(t.card_id))
      .reduce((s, t) => s + t.amount, 0);
    setCardTotal(cardTxTotal);

    // Contas a pagar pendentes (apenas payable e status !== paid)
    const allBills = (billsRes.data || []);
    const payableBills = allBills.filter((b) => b.type === "payable" && b.status !== "paid");

    // Cartões a pagar (apenas os com status "pending" ou "overdue")
    const unpaidCards = creditCards.filter((c) => c.status === "pending" || c.status === "overdue");
    const unpaidCardIds2 = unpaidCards.map((c) => c.id);

    // Agrupar transações por cartão para exibir no modal
    const cardAmounts: Record<string, number> = {};
    cardTxData.forEach((t) => {
      if (unpaidCardIds2.includes(t.card_id)) {
        cardAmounts[t.card_id] = (cardAmounts[t.card_id] || 0) + t.amount;
      }
    });

    // Buscar nomes dos cartões
    const { data: cardNamesData } = await supabase
      .from("credit_cards")
      .select("id, name, due_day")
      .in("id", unpaidCardIds2);

    const cardItems = (cardNamesData || []).map((c: { id: string; name: string; due_day: number }) => ({
      name: c.name,
      amount: cardAmounts[c.id] || 0,
      dueDay: c.due_day,
    })).filter((c) => c.amount > 0);

    const cartaoPayable = Object.values(cardAmounts).reduce((s, v) => s + v, 0);

    const totalPending = payableBills.reduce((s, b) => s + b.amount, 0) + cartaoPayable;
    setPendingBillsTotal(totalPending);
    setPendingBills(((pendingBillsRes.data || []) as Bill[]).filter((b) => b.type === "payable" && b.status !== "paid"));
    setPendingCardItems(cardItems);

    // Gráfico APENAS cartão (apenas cartões não pagos)
    const cardCatMap: Record<string, number> = {};
    (cardTxCatRes.data || []).forEach((t: { amount: number; category: string; card_id: string }) => {
      if (unpaidCardIds.includes(t.card_id)) {
        const cat = t.category || "outros";
        cardCatMap[cat] = (cardCatMap[cat] || 0) + Math.abs(t.amount);
      }
    });
    const cardPieData = Object.entries(cardCatMap)
      .map(([key, value]) => ({
        name: getCategoryConfig(key).label, value,
        color: getCategoryConfig(key).color,
      }))
      .sort((a, b) => b.value - a.value);
    setCardCategoryData(cardPieData);

    // === Receitas/Despesas do mes (transactions + card_transactions) ===
    let rec = 0;
    let des = 0;
    const generalCatMap: Record<string, number> = {};
    monthTx.forEach((t) => {
      const a = Math.abs(t.amount);
      if (t.type === "income" || t.amount > 0) {
        rec += a;
      } else {
        des += a;
        const cat = t.category || "outros";
        generalCatMap[cat] = (generalCatMap[cat] || 0) + a;
      }
    });
    (cardTxCatRes.data || []).forEach((t: { amount: number; category: string }) => {
      const a = Math.abs(t.amount);
      des += a;
      const cat = t.category || "outros";
      generalCatMap[cat] = (generalCatMap[cat] || 0) + a;
    });
    setReceitas(rec);
    setDespesas(des);

    const generalPie = Object.entries(generalCatMap)
      .map(([key, value]) => ({
        name: getCategoryConfig(key).label, value,
        color: getCategoryConfig(key).color,
      }))
      .sort((a, b) => b.value - a.value);
    setGeneralCategoryData(generalPie);

    // === Mes anterior ===
    let pRec = 0;
    let pDes = 0;
    const prevCatMap: Record<string, number> = {};
    (prevTxRes.data || []).forEach((t: { amount: number; type: string; category: string }) => {
      const a = Math.abs(t.amount);
      if (t.type === "income" || t.amount > 0) pRec += a;
      else {
        pDes += a;
        const cat = t.category || "outros";
        prevCatMap[cat] = (prevCatMap[cat] || 0) + a;
      }
    });
    (prevCardTxRes.data || []).forEach((t: { amount: number; category: string }) => {
      const a = Math.abs(t.amount);
      pDes += a;
      const cat = t.category || "outros";
      prevCatMap[cat] = (prevCatMap[cat] || 0) + a;
    });
    setPrevReceitas(pRec);
    setPrevDespesas(pDes);

    // === Ultimas transacoes (merge transactions + card_transactions) ===
    const txRows: RecentTxRow[] = ((recentTxRes.data || []) as Transaction[]).map((t) => ({
      id: `tx-${t.id}`,
      source: "transaction",
      description: t.description,
      amount: Math.abs(t.amount),
      category: t.category,
      date: t.date,
      type: (t.type === "income" || t.amount > 0) ? "income" : "expense",
    }));
    const cardTxRows: RecentTxRow[] = ((recentCardTxRes.data || []) as Array<{
      id: string; description: string; amount: number; category: string; date: string;
      card_id: string; installments: number; installment_current: number;
    }>).map((t) => {
      const c = cardById[t.card_id];
      return {
        id: `card-${t.id}`,
        source: "card",
        description: t.description,
        amount: t.amount,
        category: t.category,
        date: t.date,
        type: "expense",
        cardId: t.card_id,
        cardName: c?.name,
        cardColor: c?.color,
        installmentLabel: t.installments > 1 ? `${t.installment_current}/${t.installments}` : undefined,
        installments: t.installments,
        installmentCurrent: t.installment_current,
      };
    });
    const merged = [...txRows, ...cardTxRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    setRecentTx(merged);

    // === Insights ===
    const insightList: string[] = [];
    // 1) Categoria que mais cresceu vs mes anterior (com base absoluta minima)
    const growth: Array<{ cat: string; delta: number; pct: number; cur: number }> = [];
    for (const [cat, cur] of Object.entries(generalCatMap)) {
      const prev = prevCatMap[cat] || 0;
      if (cur >= 50 && prev > 0) {
        const pct = ((cur - prev) / prev) * 100;
        if (pct >= 25) growth.push({ cat, delta: cur - prev, pct, cur });
      }
    }
    growth.sort((a, b) => b.pct - a.pct);
    if (growth.length > 0) {
      const top = growth[0];
      insightList.push(
        `Gastos em ${getCategoryConfig(top.cat).label} subiram ${top.pct.toFixed(0)}% vs mês passado (${formatCurrency(top.cur)})`
      );
    }
    // 2) Maior categoria do mes
    if (generalPie.length > 0) {
      const topCat = generalPie[0];
      const pct = des > 0 ? Math.round((topCat.value / des) * 100) : 0;
      insightList.push(`Sua maior categoria este mês é ${topCat.name} (${pct}% das despesas)`);
    }
    setInsights(insightList);

    // === Projecao de fim de mes ===
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (dayOfMonth >= 3 && des > 0) {
      const avgPerDay = des / dayOfMonth;
      const proj = avgPerDay * daysInMonth;
      setProjection(proj);
    } else {
      setProjection(null);
    }

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
    } catch (err) {
      console.error("loadDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const onChange = () => loadDashboard();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadDashboard();
    };
    window.addEventListener("finapp:data-changed", onChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("finapp:data-changed", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Debounce do save de receiveDates pro Supabase
  const receiveDatesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleReceiveDatesChange(dates: Array<{ date: string; amount: number }>) {
    setReceiveDates(dates);
    if (receiveDatesSaveTimer.current) clearTimeout(receiveDatesSaveTimer.current);
    receiveDatesSaveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ receive_dates: dates }).eq("id", user.id);
    }, 400);
  }

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff",
  };

  async function handleDeleteRow() {
    if (!deleteRow) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }

    if (deleteRow.source === "transaction") {
      const realId = deleteRow.id.replace(/^tx-/, "");
      const { error } = await supabase.from("transactions").delete().eq("id", realId);
      if (error) { setDeleting(false); showDelToast("Erro: " + error.message); return; }
      const delta = deleteRow.type === "income" ? -deleteRow.amount : deleteRow.amount;
      await updateWalletBalance(supabase, user.id, delta);
      showDelToast("Excluido");
    } else {
      const realId = deleteRow.id.replace(/^card-/, "");
      const cardName = deleteRow.cardName || "";
      const cardId = deleteRow.cardId;

      const { data: tx } = await supabase.from("card_transactions").select("*").eq("id", realId).single();
      if (!tx) { setDeleting(false); showDelToast("Lancamento nao encontrado"); return; }

      if (deleteAllInst && tx.installments > 1 && cardId) {
        const { data: siblings } = await supabase
          .from("card_transactions").select("id")
          .eq("card_id", cardId)
          .eq("description", tx.description)
          .eq("installments", tx.installments)
          .eq("user_id", user.id);
        if (siblings && siblings.length > 0) {
          await supabase.from("card_transactions").delete().in("id", siblings.map((s) => s.id));
        }
        await supabase.from("bills").delete()
          .eq("user_id", user.id)
          .eq("notes", `card:${cardId}`)
          .like("description", `${cardName} - ${tx.description}%`);
        showDelToast("Parcelas removidas");
      } else {
        await supabase.from("card_transactions").delete().eq("id", realId);
        if (cardId) {
          const billDescPattern = tx.installments > 1
            ? `${cardName} - ${tx.description} ${tx.installment_current}/${tx.installments}`
            : `${cardName} - ${tx.description}`;
          await supabase.from("bills").delete()
            .eq("user_id", user.id)
            .eq("notes", `card:${cardId}`)
            .eq("description", billDescPattern);
        }
        showDelToast("Lancamento removido");
      }
    }

    setDeleteRow(null);
    setDeleteAllInst(false);
    setDeleting(false);
    await loadDashboard();
  }

  return (
    <AppShell>
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-5">
          {/* ── 3 Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card title="Saldo Atual" value={formatCurrency(balanceWithReceive)}
              subtitle={totalToReceive > 0 ? `+${formatCurrency(totalToReceive)} a receber` : "Toque para editar"}
              icon={<Wallet size={16} />} color="text-white"
              onClick={() => setShowBalanceModal(true)} />
            <Card title="Contas a Pagar" value={formatCurrency(pendingBillsTotal)}
              subtitle={`${pendingBills.length} contas pendentes`}
              icon={<FileText size={16} />} color="text-yellow-400"
              onClick={() => setShowPendingModal(true)} />
            <Card title="Valor Final" value={formatCurrency(valorFinal)}
              subtitle="Saldo − Contas a Pagar"
              icon={<Calculator size={16} />}
              color={valorFinal >= 0 ? "text-green-400" : "text-red-400"} />
          </div>

          {/* ── Receitas + Despesas com variacao ── */}
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const recVar = prevReceitas === 0
                ? (receitas > 0 ? { value: "+100%", positive: true } : { value: "—", positive: true })
                : (() => {
                    const pct = ((receitas - prevReceitas) / Math.abs(prevReceitas)) * 100;
                    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, positive: pct >= 0 };
                  })();
              const desVar = prevDespesas === 0
                ? (despesas > 0 ? { value: "+100%", positive: false } : { value: "—", positive: true })
                : (() => {
                    const pct = ((despesas - prevDespesas) / Math.abs(prevDespesas)) * 100;
                    // Lower is better for despesas
                    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, positive: pct < 0 };
                  })();
              return (
                <>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight size={12} className="text-green-400" />
                      <p className="label-upper">Receitas</p>
                    </div>
                    <p className="text-lg font-bold text-green-400">{formatCurrency(receitas)}</p>
                    <p className={`text-[10px] mt-1 ${recVar.positive ? "text-green-400" : "text-red-400"}`}>
                      {recVar.value} <span className="text-white/30">vs mês anterior</span>
                    </p>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownRight size={12} className="text-red-400" />
                      <p className="label-upper">Despesas</p>
                    </div>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(despesas)}</p>
                    <p className={`text-[10px] mt-1 ${desVar.positive ? "text-green-400" : "text-red-400"}`}>
                      {desVar.value} <span className="text-white/30">vs mês anterior</span>
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── Insights + Projecao ── */}
          {(insights.length > 0 || projection !== null) && (
            <div className="glass-card p-4 space-y-2" style={{ borderColor: "rgba(99,102,241,0.4)" }}>
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-[#818CF8]" />
                <span className="text-sm font-semibold">Insights</span>
              </div>
              <div className="space-y-1">
                {insights.map((s, i) => (
                  <p key={i} className="text-xs text-white/70">{s}</p>
                ))}
                {projection !== null && (
                  <p className="text-xs text-white/70">
                    Projeção de fim de mês:{" "}
                    <span className="font-bold text-white">{formatCurrency(projection)}</span>
                    <span className="text-white/40"> (no ritmo atual)</span>
                  </p>
                )}
              </div>
            </div>
          )}

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

          {/* Gráfico: Categorias do Cartão */}
          {generalCategoryData.length > 0 && (
            <div className="glass-divider pb-5">
              <h2 className="label-upper mb-3">Categorias do Mês</h2>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
                  <PieChart>
                    <Pie data={generalCategoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                      dataKey="value" stroke="none">
                      {generalCategoryData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full sm:flex-1 space-y-2">
                  {generalCategoryData.map((item, i) => (
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
            </div>
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
                  const isIncome = t.type === "income";
                  return (
                    <div key={t.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: cat.color + "20" }}>
                          <Icon size={16} style={{ color: cat.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {t.description}
                            {t.installmentLabel && (
                              <span className="text-white/40 ml-1 text-xs">{t.installmentLabel}</span>
                            )}
                          </p>
                          <p className="text-xs text-white/30 flex items-center gap-1.5 flex-wrap">
                            <span>{formatDate(t.date)}</span>
                            {t.source === "card" && t.cardName && (
                              <>
                                <span>·</span>
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                                  style={{
                                    backgroundColor: (t.cardColor || "#6366F1") + "30",
                                    color: t.cardColor || "#6366F1",
                                  }}
                                >
                                  <CreditCard size={10} /> {t.cardName}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <span className={`text-sm font-bold ${isIncome ? "text-green-400" : "text-red-400"}`}>
                          {isIncome ? "+" : "-"}{formatCurrency(t.amount)}
                        </span>
                        <button
                          onClick={() => { setDeleteRow(t); setDeleteAllInst(false); }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Excluir"
                          aria-label="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB: Novo gasto rapido ── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="Novo gasto"
        aria-label="Novo gasto"
      >
        <Plus size={26} />
      </button>

      {/* ── Toast delete ── */}
      {delToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] glass px-5 py-3 text-sm text-green-400">
          {delToast}
        </div>
      )}

      {/* ── Modal: Confirmar exclusao ── */}
      {deleteRow && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteRow(null)} />
          <div className="relative glass p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Excluir lançamento?</h2>
            <div className="text-sm text-white/60 space-y-1">
              <p className="font-medium text-white">{deleteRow.description}</p>
              <p className="text-xs text-white/40">
                {formatDate(deleteRow.date)} · {formatCurrency(deleteRow.amount)}
                {deleteRow.installmentLabel && ` · ${deleteRow.installmentLabel}`}
                {deleteRow.cardName && ` · ${deleteRow.cardName}`}
              </p>
            </div>

            {deleteRow.source === "transaction" && (
              <p className="text-xs text-white/45">
                {deleteRow.type === "income"
                  ? "O valor será removido do Saldo Atual."
                  : "O valor será devolvido ao Saldo Atual."}
              </p>
            )}

            {deleteRow.source === "card" && deleteRow.installments && deleteRow.installments > 1 && (
              <div className="flex items-center gap-2 p-3 glass-card">
                <input
                  type="checkbox"
                  id="dash-del-all-inst"
                  checked={deleteAllInst}
                  onChange={(e) => setDeleteAllInst(e.target.checked)}
                  className="w-5 h-5 rounded accent-[#6366F1]"
                />
                <label htmlFor="dash-del-all-inst" className="text-xs text-white/70 cursor-pointer">
                  Excluir <span className="font-bold">todas as parcelas</span> e contas vinculadas
                </label>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleDeleteRow}
                disabled={deleting}
                className="w-full bg-red-500/20 text-red-400 text-sm font-medium py-3 rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
              <button
                onClick={() => setDeleteRow(null)}
                disabled={deleting}
                className="w-full text-white/40 text-sm py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickAddModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onAdded={loadDashboard}
        cards={cardsForQuickAdd}
      />

      {/* ── Modal: Saldo Atual ── */}
      <BalanceModal
        open={showBalanceModal}
        currentBalance={balance}
        onClose={() => setShowBalanceModal(false)}
        onSave={handleSaveBalance}
        receiveDates={receiveDates}
        onReceiveDatesChange={handleReceiveDatesChange}
      />

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
              {pendingBills.length === 0 && pendingCardItems.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">Nenhuma conta pendente este mes</p>
              ) : (
                <>
                  {/* Cartões pendentes */}
                  {pendingCardItems.map((c, i) => (
                    <div key={`card-${i}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={12} className="text-[#6366F1] flex-shrink-0" />
                          <p className="text-xs font-medium truncate">{c.name}</p>
                        </div>
                        <p className="text-[10px] text-white/30">Fatura · Vence dia {c.dueDay}</p>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0 ml-2 text-[#6366F1]">
                        {formatCurrency(c.amount)}
                      </span>
                    </div>
                  ))}
                  {/* Contas normais */}
                  {pendingBills.map((b) => {
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
                  })}
                </>
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
