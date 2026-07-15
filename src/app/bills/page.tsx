"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getLiquidBalance,
  getMonthAgendaWeeks,
  getOfficialBillTotals,
  isDateWithinRange,
  parseLocalDate,
  startOfLocalDay,
} from "@/lib/financialAgenda";
import { updateWalletBalance } from "@/lib/wallet";
import type { Bill, CardTransaction } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import {
  Plus,
  Check,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

type StatusFilter = "all" | "pending" | "paid" | "overdue";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagas" },
  { key: "overdue", label: "Atrasadas" },
];

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

function getDueDateLabel(dueDate: string, status: string): { text: string; color: string } {
  if (status === "paid") return { text: `Paga em ${formatDate(dueDate)}`, color: "text-green-400" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T12:00:00"); due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) { const abs = Math.abs(diffDays); return { text: `${abs} dia${abs > 1 ? "s" : ""} atrasada`, color: "text-red-400" }; }
  if (diffDays === 0) return { text: "Vence hoje!", color: "text-yellow-400" };
  if (diffDays === 1) return { text: "Vence amanhã!", color: "text-orange-400" };
  if (diffDays <= 3) return { text: `Vence em ${diffDays} dias`, color: "text-orange-300" };
  return { text: `Vence em ${formatDate(dueDate)}`, color: "text-white/30" };
}

function getBillBorderClass(dueDate: string, status: string): string {
  if (status === "paid") return "";
  if (status === "overdue") return "border-l-2 border-l-red-500 pl-3";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T12:00:00"); due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "border-l-2 border-l-red-500 pl-3";
  if (diffDays === 0) return "border-l-2 border-l-yellow-400 pl-3";
  if (diffDays === 1) return "border-l-2 border-l-orange-400 pl-3";
  return "";
}

function isCardBill(b: Bill): boolean {
  return !!(b.notes && b.notes.startsWith("card:"));
}

function getCardIdFromBill(b: Bill): string {
  return (b.notes || "").replace("card:", "");
}

function getCardNameFromBill(b: Bill): string {
  // Description format: "CardName - Description X/Y" or "CardName - Description"
  const idx = b.description.indexOf(" - ");
  return idx > 0 ? b.description.substring(0, idx) : b.description;
}

interface CardBillGroup {
  cardId: string;
  cardName: string;
  bills: Bill[];
  totalAmount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  count: number;
}

type BillListItem = { type: "bill"; data: Bill } | { type: "card"; data: CardBillGroup };

interface WeekBucket {
  index: number;
  start: Date;
  end: Date;
  items: BillListItem[];
  totalPayable: number;
  hasUrgent: boolean;
  isPast: boolean;
  isCurrent: boolean;
}

type BillSettlementRow = Bill & {
  account_id?: string | null;
  category?: string | null;
};

type BillSettlementResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      transactionCreated: boolean;
      transactionId?: string;
      balanceUpdated: boolean;
    };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Erro inesperado";
}

function getSettlementFailureDetails(result: Exclude<BillSettlementResult, { ok: true }>): string {
  if (!result.transactionCreated) return "";
  if (!result.balanceUpdated) {
    return ` Transaction criada${result.transactionId ? ` (${result.transactionId})` : ""} sem concluir a Bill.`;
  }
  return ` Bill permaneceu pendente após criar a Transaction${result.transactionId ? ` (${result.transactionId})` : ""}.`;
}

export default function BillsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [currentBalance, setCurrentBalance] = useState(0);

  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creditCards, setCreditCards] = useState<Record<string, { status: "pending" | "paid" | "overdue" }>>({});
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set());

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<"payable" | "receivable">("payable");
  const [status, setStatus] = useState<"pending" | "paid" | "overdue">("pending");
  const [notes, setNotes] = useState("");

  // Card detail modal
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailTxs, setCardDetailTxs] = useState<CardTransaction[]>([]);
  const [cardDetailName, setCardDetailName] = useState("");
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const calendarWeeks = getMonthAgendaWeeks(selectedYear, selectedMonth);
    const displayStart = calendarWeeks[0]?.start;
    const displayEnd = calendarWeeks[calendarWeeks.length - 1]?.end;
    const startOfRange = displayStart
      ? `${displayStart.getFullYear()}-${String(displayStart.getMonth() + 1).padStart(2, "0")}-${String(displayStart.getDate()).padStart(2, "0")}`
      : `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endOfRange = displayEnd
      ? `${displayEnd.getFullYear()}-${String(displayEnd.getMonth() + 1).padStart(2, "0")}-${String(displayEnd.getDate()).padStart(2, "0")}`
      : `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-31`;

    const [billsRes, cardsRes, accountsRes] = await Promise.all([
      supabase
        .from("bills")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", startOfRange)
        .lte("due_date", endOfRange)
        .order("due_date", { ascending: true }),
      supabase
        .from("credit_cards")
        .select("id, status")
        .eq("user_id", user.id),
      supabase
        .from("accounts")
        .select("id, name, balance")
        .eq("user_id", user.id),
    ]);

    let result = billsRes.data || [];

    const today = new Date().toISOString().split("T")[0];
    const toUpdate = result.filter((b) => b.status === "pending" && b.due_date < today);
    if (toUpdate.length > 0) {
      await supabase.from("bills").update({ status: "overdue" }).in("id", toUpdate.map((b) => b.id));
      result = result.map((b) =>
        toUpdate.find((u) => u.id === b.id) ? { ...b, status: "overdue" as const } : b
      );
    }

    const cardsData = cardsRes.data;

    const cardsMap: Record<string, { status: "pending" | "paid" | "overdue" }> = {};
    (cardsData || []).forEach((card: { id: string; status: "pending" | "paid" | "overdue" }) => {
      cardsMap[card.id] = { status: card.status };
    });
    setCreditCards(cardsMap);

    setBills(result);
    setCurrentBalance(getLiquidBalance(accountsRes.data || []));
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const monthBills = useMemo(
    () => bills.filter((bill) => {
      const dueDate = parseLocalDate(bill.due_date);
      return dueDate.getFullYear() === selectedYear && dueDate.getMonth() === selectedMonth;
    }),
    [bills, selectedYear, selectedMonth],
  );

  // Separate regular bills from card bills, then group card bills by cardId
  const { regularBills, cardGroups, allItems } = useMemo(() => {
    const regular: Bill[] = [];
    const cardMap: Record<string, CardBillGroup> = {};

    for (const b of bills) {
      if (isCardBill(b)) {
        const cardId = getCardIdFromBill(b);
        const cardName = getCardNameFromBill(b);
        if (!cardMap[cardId]) {
          // Usar status do cartão de crédito se disponível, caso contrário "paid"
          const cardStatus = creditCards[cardId]?.status || "paid";
          cardMap[cardId] = {
            cardId, cardName, bills: [], totalAmount: 0,
            dueDate: b.due_date, status: cardStatus, count: 0,
          };
        }
        cardMap[cardId].bills.push(b);
        cardMap[cardId].totalAmount += b.amount;
        cardMap[cardId].count++;
      } else {
        regular.push(b);
      }
    }

    // Ordenação: 1) atrasadas (data cresc), 2) pendentes (data cresc), 3) pagas (data decresc)
    const statusOrder: Record<string, number> = { overdue: 0, pending: 1, paid: 2 };

    // Comparador comum para ordenação
    const compareItems = (aStatus: string, aDate: string, bStatus: string, bDate: string) => {
      const sa = statusOrder[aStatus] ?? 1;
      const sb = statusOrder[bStatus] ?? 1;
      if (sa !== sb) return sa - sb;
      if (aStatus === "paid") return bDate.localeCompare(aDate);
      return aDate.localeCompare(bDate);
    };

    regular.sort((a, b) => compareItems(a.status, a.due_date, b.status, b.due_date));

    const cardGroupList = Object.values(cardMap);
    cardGroupList.sort((a, b) => compareItems(a.status, a.dueDate, b.status, b.dueDate));

    // Mesclar em uma única lista ordenada
    const merged: BillListItem[] = [];

    let regIdx = 0, cardIdx = 0;
    while (regIdx < regular.length || cardIdx < cardGroupList.length) {
      if (regIdx >= regular.length) {
        merged.push({ type: "card", data: cardGroupList[cardIdx++] });
      } else if (cardIdx >= cardGroupList.length) {
        merged.push({ type: "bill", data: regular[regIdx++] });
      } else {
        const reg = regular[regIdx];
        const card = cardGroupList[cardIdx];
        if (compareItems(reg.status, reg.due_date, card.status, card.dueDate) <= 0) {
          merged.push({ type: "bill", data: regular[regIdx++] });
        } else {
          merged.push({ type: "card", data: cardGroupList[cardIdx++] });
        }
      }
    }

    return { regularBills: regular, cardGroups: cardGroupList, allItems: merged };
  }, [bills, creditCards]);

  // Divide o mês em semanas (1-7, 8-14, 15-21, 22-fim) e distribui as contas
  const weeks = useMemo<WeekBucket[]>(() => {
    const today = startOfLocalDay(new Date());

    const buckets: WeekBucket[] = getMonthAgendaWeeks(selectedYear, selectedMonth).map((week) => ({
      index: week.index,
      start: week.start,
      end: week.end,
      items: [],
      totalPayable: 0,
      hasUrgent: false,
      isPast: false,
      isCurrent: false,
    }));

    for (const item of allItems) {
      const dueStr = item.type === "card" ? item.data.dueDate : item.data.due_date;
      const d = parseLocalDate(dueStr);
      const idx = buckets.findIndex((bucket) => isDateWithinRange(d, bucket.start, bucket.end));
      if (idx < 0) continue;
      const bucket = buckets[idx];
      bucket.items.push(item);

      const status = item.data.status;
      const isPayable = item.type === "card" || item.data.type === "payable";
      const amount = item.type === "card" ? item.data.totalAmount : item.data.amount;
      if (isPayable && status !== "paid") bucket.totalPayable += amount;

      if (status !== "paid") {
        const diffDays = Math.round((startOfLocalDay(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 2) bucket.hasUrgent = true;
      }
    }

    for (const b of buckets) {
      b.isPast = b.end < today;
      b.isCurrent = today >= b.start && today <= b.end;
    }
    return buckets;
  }, [allItems, selectedYear, selectedMonth]);

  // Semana atual expandida por padrão (ou semana 1 ao navegar para outro mês)
  useEffect(() => {
    const today = new Date();
    let def = 1;
    const currentWeek = getMonthAgendaWeeks(selectedYear, selectedMonth)
      .find((week) => isDateWithinRange(today, week.start, week.end));
    if (currentWeek) def = currentWeek.index;
    setOpenWeeks(new Set([def]));
  }, [selectedYear, selectedMonth]);

  function toggleWeek(i: number) {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  // Apply filter
  const filteredItems = allItems.filter((item) => {
    if (filter === "all") return true;
    return item.type === "bill" ? item.data.status === filter : item.data.status === filter;
  });

  // Totals — use regular bills + card group totals (avoids double counting)
  const { totalPayable, totalReceivable, saldoPrevisto } = useMemo(
    () => getOfficialBillTotals(monthBills, currentBalance),
    [monthBills, currentBalance],
  );

  const paidCount = monthBills.filter((bill) => bill.status === "paid").length;
  const pendingCount = monthBills.filter((bill) => bill.status === "pending").length;
  const overdueCount = monthBills.filter((bill) => bill.status === "overdue").length;

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  function prevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else { setSelectedMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else { setSelectedMonth((m) => m + 1); }
  }

  function resetForm() {
    setDesc(""); setAmount(""); setDueDate(""); setType("payable");
    setStatus("pending");
    setNotes(""); setEditingId(null);
  }
  function openNew() { resetForm(); setShowForm(true); }
  function openEdit(b: Bill) {
    setEditingId(b.id); setDesc(b.description); setAmount(String(b.amount));
    setDueDate(b.due_date); setType(b.type); setStatus(b.status);
    setNotes(b.notes || ""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); resetForm(); }

  async function settleBill(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    bill: BillSettlementRow,
    liquidationDate: string,
  ): Promise<BillSettlementResult> {
    const amount = Math.abs(bill.amount);
    const txType = bill.type === "payable" ? "expense" : "income";
    const signedAmount = txType === "income" ? amount : -amount;
    const { data: createdTx, error: txError } = await supabase.from("transactions").insert({
      user_id: userId,
      account_id: bill.account_id ?? null,
      description: bill.description,
      amount: signedAmount,
      category: bill.category || "outros",
      date: liquidationDate,
      type: txType,
      status: "completed",
    }).select("id").single();

    if (txError) {
      return {
        ok: false,
        error: txError.message,
        transactionCreated: false,
        balanceUpdated: false,
      };
    }

    const delta = txType === "income" ? amount : -amount;
    try {
      await updateWalletBalance(supabase, userId, delta);
    } catch (error) {
      return {
        ok: false,
        error: getErrorMessage(error),
        transactionCreated: true,
        transactionId: createdTx?.id,
        balanceUpdated: false,
      };
    }

    const { error: billError } = await supabase
      .from("bills")
      .update({ status: "paid" })
      .eq("id", bill.id);

    if (billError) {
      return {
        ok: false,
        error: billError.message,
        transactionCreated: true,
        transactionId: createdTx?.id,
        balanceUpdated: true,
      };
    }

    return { ok: true };
  }

  async function openCardDetail(group: CardBillGroup) {
    setCardDetailName(group.cardName);
    setCardDetailLoading(true);
    setShowCardDetail(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCardDetailLoading(false); return; }

    const startOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Filtra pelo mes da fatura (bill_date), nao pela data da compra
    const { data: txs } = await supabase
      .from("card_transactions")
      .select("*")
      .eq("card_id", group.cardId)
      .eq("user_id", user.id)
      .gte("bill_date", startOfMonth)
      .lte("bill_date", endOfMonth)
      .order("date", { ascending: false });

    setCardDetailTxs(txs || []);
    setCardDetailLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const parsedAmount = parseFloat(amount);
    let billData = {
      description: desc.trim(), amount: parsedAmount, due_date: dueDate,
      type, status, recurrent: false, recurrence_day: null, notes: notes.trim() || null,
    };

    if (editingId) {
      const today = new Date().toISOString().split("T")[0];
      if (status === "overdue" && dueDate >= today) {
        billData.status = "pending";
      }
      if (status === "pending" && dueDate < today) {
        billData.status = "overdue";
      }

      await supabase.from("bills").update(billData).eq("id", editingId);
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (status === "pending" && dueDate < today) { billData.status = "overdue"; }
      await supabase.from("bills").insert({ user_id: user.id, ...billData });
    }
    closeForm(); setSaving(false); setLoading(true); load();
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("bills").delete().eq("id", editingId);

    closeForm(); setSaving(false); setLoading(true); load();
  }

  async function markAsPaid(id: string) {
    setMarkingId(id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingId(null); return; }
    const bill = bills.find((b) => b.id === id) as BillSettlementRow | undefined;
    if (!bill || bill.status === "paid") { setMarkingId(null); return; }

    const liquidationDate = new Date().toISOString().split("T")[0];
    const result = await settleBill(supabase, user.id, bill, liquidationDate);
    if (!result.ok) {
      showToast("Erro ao liquidar conta: " + result.error + getSettlementFailureDetails(result));
      setMarkingId(null);
      return;
    }

    setLoading(true);
    await load();
    setMarkingId(null);
  }

  async function markCardGroupAsPaid(group: CardBillGroup) {
    setMarkingId(group.cardId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingId(null); return; }

    const liquidationDate = new Date().toISOString().split("T")[0];
    const pendingBills = group.bills.filter((b) => b.status !== "paid") as BillSettlementRow[];

    for (const bill of pendingBills) {
      const result = await settleBill(supabase, user.id, bill, liquidationDate);
      if (!result.ok) {
        showToast("Erro ao liquidar fatura: " + result.error + getSettlementFailureDetails(result));
        setMarkingId(null);
        return;
      }
    }

    const { error: cardStatusError } = await supabase
      .from("credit_cards")
      .update({ status: "paid" })
      .eq("id", group.cardId);
    if (cardStatusError) {
      showToast("Fatura liquidada, mas o status do cartão não foi atualizado: " + cardStatusError.message);
      setMarkingId(null);
      return;
    }

    setLoading(true);
    await load();
    setMarkingId(null);
  }

  const hasItems = filteredItems.length > 0;

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400 flex items-center gap-2 animate-fade-in">
          <RefreshCw size={14} /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Agenda Financeira</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Nova
        </button>
      </div>

      {/* Carrossel de mês */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white"><ChevronLeft size={20} /></button>
        <span className="text-sm font-semibold tracking-wide">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
        <button onClick={nextMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white"><ChevronRight size={20} /></button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Wallet size={12} className="text-white" /><p className="label-upper">Saldo Atual</p></div>
          <p className={`text-lg font-bold ${currentBalance >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(currentBalance)}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingDown size={12} className="text-red-400" /><p className="label-upper">A Pagar</p></div>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalPayable)}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={12} className="text-green-400" /><p className="label-upper">A Receber</p></div>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalReceivable)}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Wallet size={12} className="text-[#6366F1]" /><p className="label-upper">Saldo Previsto</p></div>
          <p className={`text-lg font-bold ${saldoPrevisto >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(saldoPrevisto)}</p>
        </div>
      </div>
      <p className="text-[11px] text-white/30 mb-4 glass-divider pb-4">
        {paidCount} pagas · {pendingCount} pendentes · {overdueCount} atrasadas
      </p>

      {/* Visualização por semana */}
      {!loading && (
        <div className="mb-5">
          <h3 className="label-upper mb-2">Por Semana</h3>
          <div className="space-y-2">
            {weeks.map((w) => {
              const isOpen = openWeeks.has(w.index);
              const fmt = (d: Date) =>
                `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
              return (
                <div key={w.index}
                  className={`glass-card overflow-hidden transition-opacity ${w.isPast && !isOpen ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleWeek(w.index)}
                    className="w-full flex items-center justify-between p-3 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown size={16}
                        className={`text-white/40 transition-transform flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">Semana {w.index}</span>
                          {w.isCurrent && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#6366F1]/15 text-[#818CF8] text-[10px] uppercase tracking-wider">
                              Atual
                            </span>
                          )}
                          {w.hasUrgent && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[10px] uppercase tracking-wider">
                              <AlertTriangle size={10} /> Vence
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {fmt(w.start)} - {fmt(w.end)} · {w.items.length} conta{w.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-400 flex-shrink-0 ml-2">
                      {formatCurrency(w.totalPayable)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-1">
                      {w.items.length === 0 ? (
                        <p className="text-[11px] text-white/25 py-1">Nenhuma conta nesta semana</p>
                      ) : (
                        w.items.map((item) => {
                          const isCard = item.type === "card";
                          const name = item.type === "card" ? item.data.cardName : item.data.description;
                          const amount = item.type === "card" ? item.data.totalAmount : item.data.amount;
                          const dd = item.type === "card" ? item.data.dueDate : item.data.due_date;
                          const st = item.data.status;
                          const isReceivable = item.type === "bill" && item.data.type === "receivable";
                          const dl = getDueDateLabel(dd, st);
                          const key = item.type === "card" ? `wk-card-${item.data.cardId}` : `wk-bill-${item.data.id}`;
                          return (
                            <div key={key}
                              className="flex items-center justify-between py-1.5 glass-divider last:border-0">
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                {isCard && <CreditCard size={11} className="text-[#6366F1] flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{name}</p>
                                  <p className={`text-[10px] ${dl.color}`}>{dl.text}</p>
                                </div>
                              </div>
                              <span className={`text-xs font-bold flex-shrink-0 ml-2 ${
                                isReceivable ? "text-green-400" : st === "paid" ? "text-white/40" : "text-white"
                              }`}>
                                {isReceivable ? "+" : "-"}{formatCurrency(amount)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">{editingId ? "Editar conta" : "Nova conta"}</h2>
              <button type="button" onClick={closeForm} className="text-white/45 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div>
              <label className="label-upper block mb-1">Descricao</label>
              <input required value={desc} onChange={(e) => setDesc(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" placeholder="Ex: Aluguel, Internet..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Valor</label>
                <input required type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" placeholder="0,00" />
              </div>
              <div>
                <label className="label-upper block mb-1">Vencimento</label>
                <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as "payable" | "receivable")}
                  className="w-full glass-input px-3 py-3 text-base text-white">
                  <option value="payable" className="bg-[#1a1a2e]">A pagar</option>
                  <option value="receivable" className="bg-[#1a1a2e]">A receber</option>
                </select>
              </div>
              <div>
                <label className="label-upper block mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "pending" | "paid" | "overdue")}
                  className="w-full glass-input px-3 py-3 text-base text-white">
                  <option value="pending" className="bg-[#1a1a2e]">Pendente</option>
                  <option value="paid" className="bg-[#1a1a2e]">Paga</option>
                  <option value="overdue" className="bg-[#1a1a2e]">Atrasada</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label-upper block mb-1">Observacoes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full glass-input px-3 py-3 text-base text-white resize-none" placeholder="Opcional..." />
            </div>
            <div className="flex gap-3">
              {editingId && (
                <button type="button" onClick={handleDelete} disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  <Trash2 size={16} />
                </button>
              )}
              <button type="submit" disabled={saving}
                className="flex-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar conta"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Card Detail */}
      {showCardDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCardDetail(false)} />
          <div className="relative glass p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#6366F1]" />
                <h2 className="text-lg font-bold">{cardDetailName}</h2>
              </div>
              <button onClick={() => setShowCardDetail(false)} className="text-white/45 hover:text-white p-1"><X size={20} /></button>
            </div>
            <p className="text-xs text-white/40 mb-4">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>

            {cardDetailLoading ? (
              <ListSkeleton rows={4} />
            ) : cardDetailTxs.length === 0 ? (
              <p className="text-white/30 py-4">Nenhum lancamento neste mes</p>
            ) : (
              <>
                <div className="space-y-1 mb-4">
                  {cardDetailTxs.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 glass-divider">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {tx.description}
                          {tx.installments > 1 && (
                            <span className="text-white/40 ml-1">{tx.installment_current}/{tx.installments}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-white/30">
                          {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-white flex-shrink-0 ml-3">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="glass-card p-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Total da fatura</span>
                    <span className="font-bold text-white">
                      {formatCurrency(cardDetailTxs.reduce((s, t) => s + t.amount, 0))}
                    </span>
                  </div>
                </div>
              </>
            )}
            <Link href="/credit-cards"
              className="flex items-center justify-center gap-2 w-full glass-btn text-[#6366F1] text-sm py-3 rounded-xl hover:bg-[#6366F1]/10 transition-colors">
              <ExternalLink size={14} /> Ver cartao completo
            </Link>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
              filter === f.key ? "glass-btn-active text-white" : "glass-btn text-white/45"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : !hasItems ? (
        <p className="text-white/30">Nenhuma conta encontrada.</p>
      ) : (
        <div className="space-y-1">
          {filteredItems.map((item) => {
            if (item.type === "card") {
              const group = item.data;
              const dateLabel = getDueDateLabel(group.dueDate, group.status);
              const borderClass = getBillBorderClass(group.dueDate, group.status);
              return (
                <div key={group.cardId}
                  className={`flex items-center justify-between py-3 glass-divider ${borderClass}`}>
                  <button onClick={() => openCardDetail(group)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CreditCard size={14} className="text-[#6366F1] flex-shrink-0" />
                      <p className="font-medium text-sm truncate">{group.cardName}</p>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6366F1]/10 text-[#818CF8] text-[10px] uppercase tracking-wider flex-shrink-0">
                        Cartao
                      </span>
                      <ChevronDown size={12} className="text-white/20 flex-shrink-0" />
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {group.count} lancamento{group.count > 1 ? "s" : ""} · <span className={dateLabel.color}>{dateLabel.text}</span>
                    </p>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                      <span className="font-bold text-sm text-white">-{formatCurrency(group.totalAmount)}</span>
                      <span className={`block text-xs px-2 py-0.5 rounded-full mt-1 text-center ${statusColor[group.status]}`}>
                        {statusLabel[group.status]}
                      </span>
                    </div>
                    {(group.status === "pending" || group.status === "overdue") && (
                      <button onClick={() => markCardGroupAsPaid(group)} disabled={markingId === group.cardId}
                        title="Marcar fatura como paga"
                        className="p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            } else {
              const b = item.data;
              const dateLabel = getDueDateLabel(b.due_date, b.status);
              const borderClass = getBillBorderClass(b.due_date, b.status);
              return (
                <div key={b.id}
                  className={`flex items-center justify-between py-3 glass-divider ${borderClass}`}>
                  <button onClick={() => openEdit(b)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{b.description}</p>
                      <Pencil size={12} className="text-white/20 flex-shrink-0" />
                    </div>
                    <p className={`text-xs mt-0.5 ${dateLabel.color}`}>
                      {dateLabel.text} · {b.type === "payable" ? "A pagar" : "A receber"}
                    </p>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                      <span className={`font-bold text-sm ${b.type === "receivable" ? "text-green-400" : "text-white"}`}>
                        {b.type === "receivable" ? "+" : "-"}{formatCurrency(b.amount)}
                      </span>
                      <span className={`block text-xs px-2 py-0.5 rounded-full mt-1 text-center ${statusColor[b.status]}`}>
                        {statusLabel[b.status]}
                      </span>
                    </div>
                    {(b.status === "pending" || b.status === "overdue") && (
                      <button onClick={() => markAsPaid(b.id)} disabled={markingId === b.id}
                        title="Marcar como pago"
                        className="p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </AppShell>
  );
}
