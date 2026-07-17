"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  addLocalDays,
  getLiquidBalance,
  getOfficialBillTotals,
  isSameLocalDay,
  parseLocalDate,
  startOfLocalDay,
} from "@/lib/financialAgenda";
import { getCategoryConfig } from "@/lib/categories";
import type { Transaction, Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { DashboardSkeleton } from "@/components/Skeleton";
import QuickAddModal from "@/components/dashboard/QuickAddModal";
import {
  Wallet, FileText, Calculator,
  CreditCard, ArrowUpRight, ArrowDownRight, Plus, Trash2,
} from "lucide-react";
import { updateWalletBalance } from "@/lib/wallet";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

interface CategoryData { name: string; value: number; color: string; }
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

type UpcomingAgendaSection = {
  key: "today" | "tomorrow" | "next";
  title: string;
  items: Bill[];
};

/* ── Dashboard ───────────────────────────────────── */
export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [pendingBillsTotal, setPendingBillsTotal] = useState(0);
  const [receivableBillsTotal, setReceivableBillsTotal] = useState(0);
  const [projectedBalance, setProjectedBalance] = useState(0);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [receivableBills, setReceivableBills] = useState<Bill[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [generalCategoryData, setGeneralCategoryData] = useState<CategoryData[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTxRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Receitas/Despesas + variacao vs mes anterior
  const [receitas, setReceitas] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [prevReceitas, setPrevReceitas] = useState(0);
  const [prevDespesas, setPrevDespesas] = useState(0);

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

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return "Erro inesperado";
  }

  const upcomingAgendaSections = useMemo<UpcomingAgendaSection[]>(() => {
    const today = startOfLocalDay(new Date());
    const tomorrow = startOfLocalDay(addLocalDays(today, 1));
    const nextSevenDays = startOfLocalDay(addLocalDays(today, 7));

    return [
      {
        key: "today",
        title: "Hoje",
        items: upcomingBills.filter((bill) => isSameLocalDay(parseLocalDate(bill.due_date), today)),
      },
      {
        key: "tomorrow",
        title: "Amanhã",
        items: upcomingBills.filter((bill) => isSameLocalDay(parseLocalDate(bill.due_date), tomorrow)),
      },
      {
        key: "next",
        title: "Próximos 7 dias",
        items: upcomingBills.filter((bill) => {
          const dueDate = startOfLocalDay(parseLocalDate(bill.due_date));
          return dueDate.getTime() > tomorrow.getTime() && dueDate.getTime() <= nextSevenDays.getTime();
        }),
      },
    ];
  }, [upcomingBills]);

  async function loadDashboard() {
    try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

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

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nextSeven = addLocalDays(startOfLocalDay(new Date()), 7);
    const nextSevenStr = `${nextSeven.getFullYear()}-${String(nextSeven.getMonth() + 1).padStart(2, "0")}-${String(nextSeven.getDate()).padStart(2, "0")}`;

    const [
      accountsRes,
      monthTxRes,
      billsRes,
      recentTxRes,
      recentCardTxRes,
      cardTxCatRes,
      creditCardsRes,
      prevTxRes,
      prevCardTxRes,
      upcomingBillsRes,
    ] = await Promise.all([
      supabase.from("accounts").select("id, balance, name").eq("user_id", user.id),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
      supabase.from("bills").select("*").eq("user_id", user.id)
        .gte("due_date", startStr).lte("due_date", endStr),
      // recentTxRes: ultimas transactions
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      // recentCardTxRes: ultimas card_transactions
      supabase.from("card_transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      // cardTxCatRes: gastos do mes (orcamento de metas) → filtra por date (data da compra)
      supabase.from("card_transactions").select("amount, category, card_id")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr),
      supabase.from("credit_cards").select("id, name, color, status, credit_limit, closing_day, due_day").eq("user_id", user.id),
      // prev month para variacao
      supabase.from("transactions").select("amount, type, category")
        .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", prevStartStr).lte("date", prevEndStr),
      supabase.from("bills").select("*")
        .eq("user_id", user.id).neq("status", "paid")
        .gte("due_date", todayStr).lte("due_date", nextSevenStr)
        .order("due_date", { ascending: true }),
    ]);

    // Saldo — busca conta "Carteira" ou usa soma de todas
    const accounts = accountsRes.data || [];
    const currentBalance = getLiquidBalance(accounts);
    setBalance(currentBalance);

    const monthTx = (monthTxRes.data || []) as Transaction[];

    // Gastos do mes (transacoes)
    const expTx = monthTx.filter((t) => t.type === "expense" || t.amount < 0);
    const totalExpenses = expTx.reduce((s, t) => s + Math.abs(t.amount), 0);
    setExpenses(totalExpenses);

    // Cartões e transações
    const creditCards = (creditCardsRes.data || []) as Array<{ id: string; name: string; color: string; status: string; closing_day: number; due_day: number }>;
    const cardById: Record<string, { name: string; color: string }> = {};
    creditCards.forEach((c) => { cardById[c.id] = { name: c.name, color: c.color }; });
    setCardsForQuickAdd(creditCards);

    const allBills = (billsRes.data || []) as Bill[];
    const officialTotals = getOfficialBillTotals(allBills, currentBalance);
    setPendingBillsTotal(officialTotals.totalPayable);
    setReceivableBillsTotal(officialTotals.totalReceivable);
    setProjectedBalance(officialTotals.saldoPrevisto);
    setPendingBills(allBills.filter((bill) => bill.type === "payable" && bill.status !== "paid"));
    setReceivableBills(allBills.filter((bill) => bill.type === "receivable" && bill.status !== "paid"));
    setUpcomingBills((upcomingBillsRes.data || []) as Bill[]);

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
    (prevTxRes.data || []).forEach((t: { amount: number; type: string; category: string }) => {
      const a = Math.abs(t.amount);
      if (t.type === "income" || t.amount > 0) pRec += a;
      else pDes += a;
    });
    (prevCardTxRes.data || []).forEach((t: { amount: number; category: string }) => {
      const a = Math.abs(t.amount);
      pDes += a;
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

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff",
  };

  const monthlyResult = receitas - despesas;

  const next7DaysEntries = upcomingBills
    .filter((bill) => bill.type === "receivable")
    .reduce((total, bill) => total + bill.amount, 0);
  const next7DaysExpenses = upcomingBills
    .filter((bill) => bill.type === "payable")
    .reduce((total, bill) => total + bill.amount, 0);
  const next7DaysImpact = next7DaysEntries - next7DaysExpenses;

  async function handleDeleteRow() {
    if (!deleteRow) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }

    if (deleteRow.source === "transaction") {
      const realId = deleteRow.id.replace(/^tx-/, "");
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("id", realId)
        .single();
      if (transactionError || !transaction) {
        setDeleting(false);
        showDelToast("Erro ao carregar transação: " + (transactionError?.message || "Transação não encontrada"));
        return;
      }

      const delta = -transaction.amount;
      try {
        await updateWalletBalance(supabase, user.id, delta);
      } catch (error) {
        setDeleting(false);
        showDelToast("Não foi possível reverter o saldo. A transação não foi excluída: " + getErrorMessage(error));
        return;
      }

      const { error } = await supabase.from("transactions").delete().eq("id", realId);
      if (error) {
        try {
          await updateWalletBalance(supabase, user.id, transaction.amount);
        } catch (rollbackError) {
          setDeleting(false);
          await loadDashboard();
          showDelToast(
            "Saldo revertido, mas a exclusão falhou e o rollback não concluiu: " + getErrorMessage(rollbackError),
          );
          return;
        }
        setDeleting(false);
        showDelToast("A reversão do saldo foi desfeita porque a transação não pôde ser excluída: " + error.message);
        return;
      }

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
          .like("notes", `card:${cardId}%`)
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
            .like("notes", `card:${cardId}%`)
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
    <AppShell contentClassName="lg:max-w-[1400px] xl:max-w-[1500px] 2xl:max-w-[1600px]">
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card
              title="Saldo Atual"
              value={formatCurrency(balance)}
              subtitle="Saldo liquidado"
              icon={<Wallet size={16} />}
              color={balance >= 0 ? "text-green-400" : "text-red-400"}
            />
            <Card
              title="A Receber"
              value={formatCurrency(receivableBillsTotal)}
              subtitle={`${receivableBills.length} compromisso(s)`}
              icon={<ArrowUpRight size={16} />}
              color="text-green-400"
            />
            <Card
              title="A Pagar"
              value={formatCurrency(pendingBillsTotal)}
              subtitle={`${pendingBills.length} compromisso(s)`}
              icon={<FileText size={16} />}
              color="text-yellow-400"
            />
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="label-upper">Saldo Previsto</span>
                <span className="text-white/45"><Calculator size={16} /></span>
              </div>
              <p className={`value-large text-lg md:text-2xl ${projectedBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(projectedBalance)}
              </p>
              <p className="text-xs text-white/30 mt-1">Saldo atual + a receber - a pagar</p>
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-[10px] text-white/50">
                <div className="flex items-center justify-between">
                  <span>Saldo atual</span>
                  <span className="text-white/70">{formatCurrency(balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>+ A receber</span>
                  <span className="text-green-400">{formatCurrency(receivableBillsTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>- A pagar</span>
                  <span className="text-yellow-400">{formatCurrency(pendingBillsTotal)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-white/80">
                  <span>= Saldo final</span>
                  <span className={projectedBalance >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatCurrency(projectedBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
            <div className="space-y-4">
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold">Agenda da Semana</h2>
                    <p className="text-[10px] text-white/30 mt-0.5">Compromissos próximos da Agenda Financeira.</p>
                  </div>
                  <Link href="/bills" className="text-[10px] text-[#6366F1] hover:underline">
                    Ver Agenda Completa
                  </Link>
                </div>

                <div className="space-y-4">
                  {upcomingAgendaSections.map((section) => (
                    <div key={section.key}>
                      {(() => {
                        const sectionImpact = section.items.reduce((total, bill) => (
                          total + (bill.type === "receivable" ? bill.amount : -bill.amount)
                        ), 0);
                        return (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">{section.title}</h3>
                              <div className="text-right">
                                {section.items.length > 0 && (
                                  <span className="block text-[10px] text-white/30">{section.items.length} item(ns)</span>
                                )}
                                {section.items.length > 0 && (
                                  <span className={`block text-[10px] mt-0.5 ${
                                    sectionImpact > 0 ? "text-green-400" : sectionImpact < 0 ? "text-red-400" : "text-white/30"
                                  }`}>
                                    Impacto no saldo: {sectionImpact > 0 ? "+" : ""}{formatCurrency(sectionImpact)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {section.items.length === 0 ? (
                              <p className="text-xs text-white/25">Nenhum compromisso.</p>
                            ) : (
                              <div className="space-y-2">
                                {section.items.map((bill) => (
                                  <div key={bill.id} className="flex items-center justify-between py-2 glass-divider last:border-0">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {bill.notes?.startsWith("card:") && <CreditCard size={11} className="text-[#6366F1] flex-shrink-0" />}
                                        <p className="text-xs font-medium truncate">{bill.description}</p>
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                                          bill.type === "receivable"
                                            ? "bg-green-500/10 text-green-400"
                                            : "bg-yellow-500/10 text-yellow-400"
                                        }`}>
                                          {bill.type === "receivable" ? "A receber" : "A pagar"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-white/30">{formatDate(bill.due_date)}</p>
                                    </div>
                                    <span className={`text-xs font-bold flex-shrink-0 ml-3 ${
                                      bill.type === "receivable" ? "text-green-400" : "text-yellow-400"
                                    }`}>
                                      {bill.type === "receivable" ? "+" : "-"}{formatCurrency(bill.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              {generalCategoryData.length > 0 && (
                <div className="glass-card p-4">
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
            </div>

            <div className="glass-card p-4 h-full">
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

            <div className="space-y-4">
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={16} className="text-[#818CF8]" />
                  <div>
                    <h2 className="text-sm font-semibold">Próximos 7 dias</h2>
                    <p className="text-[10px] text-white/30 mt-0.5">Impacto de curto prazo com base na agenda já carregada.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="glass-card p-3">
                    <p className="label-upper mb-1">Entradas</p>
                    <p className="text-sm font-bold text-green-400">{formatCurrency(next7DaysEntries)}</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="label-upper mb-1">Saídas</p>
                    <p className="text-sm font-bold text-red-400">{formatCurrency(next7DaysExpenses)}</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="label-upper mb-1">Impacto</p>
                    <p className={`text-sm font-bold ${
                      next7DaysImpact > 0 ? "text-green-400" : next7DaysImpact < 0 ? "text-red-400" : "text-white"
                    }`}>
                      {next7DaysImpact > 0 ? "+" : ""}{formatCurrency(next7DaysImpact)}
                    </p>
                  </div>
                </div>
              </div>

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
                      <p className={`text-[11px] mt-2 font-medium ${monthlyResult >= 0 ? "text-green-400" : "text-red-400"}`}>
                        Resultado do mês: {monthlyResult >= 0 ? "+" : "-"}{formatCurrency(Math.abs(monthlyResult))}
                        <span className="text-white/30"> · {monthlyResult >= 0 ? "lucro" : "prejuízo"}</span>
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
          </div>
        </div>
      )}

      {/* ── FAB: Novo gasto rapido ── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="Novo lançamento"
        aria-label="Novo lançamento"
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
    </AppShell>
  );
}
