"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Bill, CardTransaction } from "@/lib/types";
import AppShell from "@/components/AppShell";
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
  CalendarClock,
  CreditCard,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

type StatusFilter = "all" | "pending" | "paid" | "overdue";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PROJECTION_OPTIONS = [
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
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

function getDueDateForMonth(baseDate: string, monthsAhead: number): string {
  const d = new Date(baseDate + "T12:00:00");
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + monthsAhead, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.toISOString().split("T")[0];
}

function getProjectionEndDate(baseDate: string, months: number): string {
  return getDueDateForMonth(baseDate, months);
}

function isProjectedBill(b: Bill): boolean {
  if (!b.recurrent || b.status !== "pending") return false;
  const today = new Date();
  const currentYM = today.getFullYear() * 12 + today.getMonth();
  const d = new Date(b.due_date + "T12:00:00");
  const billYM = d.getFullYear() * 12 + d.getMonth();
  return billYM > currentYM;
}

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

export default function BillsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<"payable" | "receivable">("payable");
  const [status, setStatus] = useState<"pending" | "paid" | "overdue">("pending");
  const [recurrent, setRecurrent] = useState(false);
  const [projectionMonths, setProjectionMonths] = useState(3);
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

    const startOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .gte("due_date", startOfMonth)
      .lte("due_date", endOfMonth)
      .order("due_date", { ascending: true });

    let result = data || [];

    const today = new Date().toISOString().split("T")[0];
    const toUpdate = result.filter((b) => b.status === "pending" && b.due_date < today);
    if (toUpdate.length > 0) {
      await supabase.from("bills").update({ status: "overdue" }).in("id", toUpdate.map((b) => b.id));
      result = result.map((b) =>
        toUpdate.find((u) => u.id === b.id) ? { ...b, status: "overdue" as const } : b
      );
    }

    setBills(result);
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Separate regular bills from card bills, then group card bills by cardId
  const { regularBills, cardGroups, allItems } = useMemo(() => {
    const regular: Bill[] = [];
    const cardMap: Record<string, CardBillGroup> = {};

    for (const b of bills) {
      if (isCardBill(b)) {
        const cardId = getCardIdFromBill(b);
        const cardName = getCardNameFromBill(b);
        if (!cardMap[cardId]) {
          cardMap[cardId] = {
            cardId, cardName, bills: [], totalAmount: 0,
            dueDate: b.due_date, status: "paid", count: 0,
          };
        }
        cardMap[cardId].bills.push(b);
        cardMap[cardId].totalAmount += b.amount;
        cardMap[cardId].count++;
        // Group status: overdue if any overdue, pending if any pending, paid if all paid
        if (b.status === "overdue") cardMap[cardId].status = "overdue";
        else if (b.status === "pending" && cardMap[cardId].status !== "overdue") cardMap[cardId].status = "pending";
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
    type ListItem = { type: "bill"; data: Bill } | { type: "card"; data: CardBillGroup };
    const merged: ListItem[] = [];

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
  }, [bills]);

  // Apply filter
  const filteredItems = allItems.filter((item) => {
    if (filter === "all") return true;
    return item.type === "bill" ? item.data.status === filter : item.data.status === filter;
  });

  // Totals — use regular bills + card group totals (avoids double counting)
  // BUG FIX #2: Excluir contas pagas do total "A PAGAR"
  const totalPayable = regularBills.filter((b) => b.type === "payable" && b.status !== "paid").reduce((s, b) => s + b.amount, 0)
    + cardGroups.filter((g) => g.status !== "paid").reduce((s, g) => s + g.totalAmount, 0);
  const totalReceivable = regularBills.filter((b) => b.type === "receivable" && b.status !== "paid").reduce((s, b) => s + b.amount, 0);
  const balance = totalReceivable - totalPayable;

  const allBillStatuses = [...regularBills.map((b) => b.status), ...cardGroups.map((g) => g.status)];
  const paidCount = allBillStatuses.filter((s) => s === "paid").length;
  const pendingCount = allBillStatuses.filter((s) => s === "pending").length;
  const overdueCount = allBillStatuses.filter((s) => s === "overdue").length;

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
    setStatus("pending"); setRecurrent(false); setProjectionMonths(3);
    setNotes(""); setEditingId(null);
  }
  function openNew() { resetForm(); setShowForm(true); }
  function openEdit(b: Bill) {
    setEditingId(b.id); setDesc(b.description); setAmount(String(b.amount));
    setDueDate(b.due_date); setType(b.type); setStatus(b.status);
    setRecurrent(b.recurrent); setNotes(b.notes || ""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); resetForm(); }

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

    const { data: txs } = await supabase
      .from("card_transactions")
      .select("*")
      .eq("card_id", group.cardId)
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
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
    const recurrenceDay = recurrent ? new Date(dueDate + "T12:00:00").getDate() : null;

    let billData = {
      description: desc.trim(), amount: parsedAmount, due_date: dueDate,
      type, status, recurrent, recurrence_day: recurrenceDay, notes: notes.trim() || null,
    };

    // BUG FIX #1: Recalcular status ao editar due_date
    if (editingId) {
      const today = new Date().toISOString().split("T")[0];
      // Se a nova due_date é futura e status é 'overdue', mudar para 'pending'
      if (status === "overdue" && dueDate >= today) {
        billData.status = "pending";
      }
      // Se a nova due_date é passada e status é 'pending', mudar para 'overdue'
      if (status === "pending" && dueDate < today) {
        billData.status = "overdue";
      }
      await supabase.from("bills").update(billData).eq("id", editingId);
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (status === "pending" && dueDate < today) { billData.status = "overdue"; }
      await supabase.from("bills").insert({ user_id: user.id, ...billData });

      if (recurrent && projectionMonths > 0) {
        const futureBills = [];
        for (let i = 1; i <= projectionMonths; i++) {
          const futureDue = getDueDateForMonth(dueDate, i);
          futureBills.push({
            user_id: user.id, description: desc.trim(), amount: parsedAmount,
            due_date: futureDue, type, status: "pending" as const,
            recurrent: true, recurrence_day: recurrenceDay, notes: notes.trim() || null,
          });
        }
        if (futureBills.length > 0) { await supabase.from("bills").insert(futureBills); }
        showToast(`Conta criada com projeção de ${projectionMonths} meses até ${formatDate(getProjectionEndDate(dueDate, projectionMonths))}`);
      }
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
    await supabase.from("bills").update({ status: "paid" }).eq("id", id);
    // BUG FIX #3: Recarregar dados para aplicar ordenação corretamente
    setLoading(true);
    load();
    setMarkingId(null);
  }

  async function markCardGroupAsPaid(group: CardBillGroup) {
    setMarkingId(group.cardId);
    const supabase = createClient();
    const ids = group.bills.map((b) => b.id);
    // Atualizar status das bills
    await supabase.from("bills").update({ status: "paid" }).in("id", ids);
    // Atualizar status do cartão de crédito também
    await supabase.from("credit_cards").update({ status: "paid" }).eq("id", group.cardId);
    // BUG FIX #3: Recarregar dados para aplicar ordenação corretamente
    setLoading(true);
    load();
    setMarkingId(null);
  }

  const projectionPreview = recurrent && dueDate && !editingId
    ? `Serão criadas ${projectionMonths + 1} contas até ${formatDate(getProjectionEndDate(dueDate, projectionMonths))}`
    : null;

  const hasItems = filteredItems.length > 0;

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400 flex items-center gap-2 animate-fade-in">
          <RefreshCw size={14} /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Gerenciar Contas</h2>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
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
          <p className={`text-lg font-bold ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(balance)}</p>
        </div>
      </div>
      <p className="text-[11px] text-white/30 mb-4 glass-divider pb-4">
        {paidCount} pagas · {pendingCount} pendentes · {overdueCount} atrasadas
      </p>

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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={recurrent} onChange={(e) => setRecurrent(e.target.checked)}
                  className="w-5 h-5 rounded accent-[#6366F1]" id="recurrent" />
                <label htmlFor="recurrent" className="text-sm text-white/60 flex items-center gap-1 cursor-pointer">
                  <RefreshCw size={14} className="text-white/45" /> Recorrente
                </label>
              </div>
              {recurrent && !editingId && (
                <div className="glass-card p-3 space-y-2">
                  <label className="label-upper block">Projetar para quantos meses?</label>
                  <select value={projectionMonths} onChange={(e) => setProjectionMonths(Number(e.target.value))}
                    className="w-full glass-input px-3 py-2.5 text-sm text-white">
                    {PROJECTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
                    ))}
                  </select>
                  {projectionPreview && (
                    <p className="text-xs text-[#818CF8] flex items-center gap-1.5"><CalendarClock size={12} /> {projectionPreview}</p>
                  )}
                </div>
              )}
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
              <p className="text-white/45 py-4">Carregando...</p>
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
        <p className="text-white/45">Carregando...</p>
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
              const projected = isProjectedBill(b);
              const dateLabel = getDueDateLabel(b.due_date, b.status);
              const borderClass = getBillBorderClass(b.due_date, b.status);
              return (
                <div key={b.id}
                  className={`flex items-center justify-between py-3 glass-divider ${projected ? "opacity-55" : ""} ${borderClass}`}>
                  <button onClick={() => openEdit(b)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{b.description}</p>
                      {b.recurrent && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6366F1]/15 text-[#818CF8] text-[10px] uppercase tracking-wider flex-shrink-0">
                          <RefreshCw size={10} /> Recorrente
                        </span>
                      )}
                      {projected && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 text-white/40 text-[10px] uppercase tracking-wider flex-shrink-0">
                          <CalendarClock size={10} /> Projetado
                        </span>
                      )}
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
