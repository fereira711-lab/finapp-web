"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Bill } from "@/lib/types";
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
  Clock,
} from "lucide-react";

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

function getNextDueDate(currentDue: string): string {
  const d = new Date(currentDue + "T12:00:00");
  const day = d.getDate();
  const nextMonth = d.getMonth() + 1;
  const year = d.getFullYear();
  // Handle month overflow and day clamping (e.g. Jan 31 -> Feb 28)
  const next = new Date(year, nextMonth, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next.toISOString().split("T")[0];
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
  const [notes, setNotes] = useState("");

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
    const toUpdate = result.filter(
      (b) => b.status === "pending" && b.due_date < today
    );
    if (toUpdate.length > 0) {
      await supabase
        .from("bills")
        .update({ status: "overdue" })
        .in("id", toUpdate.map((b) => b.id));
      result = result.map((b) =>
        toUpdate.find((u) => u.id === b.id) ? { ...b, status: "overdue" as const } : b
      );
    }

    setBills(result);
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function prevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  // --- Month filtering ---
  const monthBills = bills;

  const filtered = monthBills.filter((b) => {
    if (filter === "all") return true;
    return b.status === filter;
  });

  const totalPayable = monthBills
    .filter((b) => b.type === "payable" && b.status !== "paid")
    .reduce((s, b) => s + b.amount, 0);
  const totalReceivable = monthBills
    .filter((b) => b.type === "receivable" && b.status !== "paid")
    .reduce((s, b) => s + b.amount, 0);
  const balance = totalReceivable - totalPayable;
  const pendingCount = monthBills.filter(
    (b) => b.status === "pending" || b.status === "overdue"
  ).length;

  function resetForm() {
    setDesc("");
    setAmount("");
    setDueDate("");
    setType("payable");
    setStatus("pending");
    setRecurrent(false);
    setNotes("");
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(b: Bill) {
    setEditingId(b.id);
    setDesc(b.description);
    setAmount(String(b.amount));
    setDueDate(b.due_date);
    setType(b.type);
    setStatus(b.status);
    setRecurrent(b.recurrent);
    setNotes(b.notes || "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const billData = {
      description: desc.trim(),
      amount: parseFloat(amount),
      due_date: dueDate,
      type,
      status,
      recurrent,
      recurrence_day: recurrent ? new Date(dueDate).getDate() : null,
      notes: notes.trim() || null,
    };

    if (editingId) {
      await supabase.from("bills").update(billData).eq("id", editingId);
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (status === "pending" && dueDate < today) {
        billData.status = "overdue";
      }
      await supabase.from("bills").insert({ user_id: user.id, ...billData });
    }

    closeForm();
    setSaving(false);
    setLoading(true);
    load();
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("bills").delete().eq("id", editingId);
    closeForm();
    setSaving(false);
    setLoading(true);
    load();
  }

  async function markAsPaid(id: string) {
    setMarkingId(id);
    const supabase = createClient();
    const bill = bills.find((b) => b.id === id);
    if (!bill) { setMarkingId(null); return; }

    await supabase.from("bills").update({ status: "paid" }).eq("id", id);

    // Recurrence: create next month's bill
    if (bill.recurrent) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const nextDue = getNextDueDate(bill.due_date);
        await supabase.from("bills").insert({
          user_id: user.id,
          description: bill.description,
          amount: bill.amount,
          due_date: nextDue,
          type: bill.type,
          status: "pending",
          recurrent: true,
          recurrence_day: bill.recurrence_day,
          notes: bill.notes,
        });
        showToast(`Próxima parcela criada para ${formatDate(nextDue)}`);
      }
    }

    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "paid" as const } : b))
    );
    setMarkingId(null);
  }

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400 flex items-center gap-2 animate-fade-in">
          <RefreshCw size={14} />
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Gerenciar Contas</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Nova
        </button>
      </div>

      {/* Carrossel de mês */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold tracking-wide">
          {MONTH_NAMES[selectedMonth]} {selectedYear}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-3 mb-4 glass-divider pb-4">
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={12} className="text-red-400" />
            <p className="label-upper">A Pagar</p>
          </div>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalPayable)}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-green-400" />
            <p className="label-upper">A Receber</p>
          </div>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalReceivable)}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={12} className="text-[#6366F1]" />
            <p className="label-upper">Saldo</p>
          </div>
          <p className={`text-lg font-bold ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrency(balance)}
          </p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-yellow-400" />
            <p className="label-upper">Pendentes</p>
          </div>
          <p className="text-lg font-bold text-yellow-400">{pendingCount}</p>
        </div>
      </div>

      {/* Modal Criar/Editar */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <form
            onSubmit={handleSubmit}
            className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">{editingId ? "Editar conta" : "Nova conta"}</h2>
              <button type="button" onClick={closeForm} className="text-white/45 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="label-upper block mb-1">Descricao</label>
              <input
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white"
                placeholder="Ex: Aluguel, Internet..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Valor</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="label-upper block mb-1">Vencimento</label>
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "payable" | "receivable")}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                >
                  <option value="payable" className="bg-[#1a1a2e]">A pagar</option>
                  <option value="receivable" className="bg-[#1a1a2e]">A receber</option>
                </select>
              </div>
              <div>
                <label className="label-upper block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "pending" | "paid" | "overdue")}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                >
                  <option value="pending" className="bg-[#1a1a2e]">Pendente</option>
                  <option value="paid" className="bg-[#1a1a2e]">Paga</option>
                  <option value="overdue" className="bg-[#1a1a2e]">Atrasada</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={recurrent}
                onChange={(e) => setRecurrent(e.target.checked)}
                className="w-5 h-5 rounded accent-[#6366F1]"
                id="recurrent"
              />
              <label htmlFor="recurrent" className="text-sm text-white/60 flex items-center gap-1 cursor-pointer">
                <RefreshCw size={14} className="text-white/45" />
                Recorrente
              </label>
            </div>
            <div>
              <label className="label-upper block mb-1">Observacoes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full glass-input px-3 py-3 text-base text-white resize-none"
                placeholder="Opcional..."
              />
            </div>

            <div className="flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar conta"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs uppercase tracking-wider whitespace-nowrap transition-all ${
              filter === f.key
                ? "glass-btn-active text-white"
                : "glass-btn text-white/45"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/30">Nenhuma conta encontrada.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between py-3 glass-divider"
            >
              <button
                onClick={() => openEdit(b)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{b.description}</p>
                  {b.recurrent && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6366F1]/15 text-[#818CF8] text-[10px] uppercase tracking-wider flex-shrink-0">
                      <RefreshCw size={10} />
                      Recorrente
                    </span>
                  )}
                  <Pencil size={12} className="text-white/20 flex-shrink-0" />
                </div>
                <p className="text-xs text-white/30 mt-0.5">
                  Vence em {formatDate(b.due_date)} · {b.type === "payable" ? "A pagar" : "A receber"}
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
                  <button
                    onClick={() => markAsPaid(b.id)}
                    disabled={markingId === b.id}
                    title="Marcar como pago"
                    className="p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
