"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Bill } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Plus, Check, RefreshCw, X } from "lucide-react";

type FilterKey = "Todas" | "payable" | "receivable" | "pending" | "paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "Todas", label: "Todas" },
  { key: "payable", label: "A pagar" },
  { key: "receivable", label: "A receber" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagas" },
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

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<FilterKey>("Todas");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<"payable" | "receivable">("payable");
  const [recurrent, setRecurrent] = useState(false);
  const [notes, setNotes] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });

    let result = data || [];

    // Marca automaticamente atrasadas
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
  }

  useEffect(() => { load(); }, []);

  const filtered = bills.filter((b) => {
    if (filter === "Todas") return true;
    if (filter === "payable" || filter === "receivable") return b.type === filter;
    return b.status === filter;
  });

  const pendingBills = bills.filter((b) => b.status === "pending" || b.status === "overdue");
  const totalPayable = pendingBills
    .filter((b) => b.type === "payable")
    .reduce((s, b) => s + b.amount, 0);
  const totalReceivable = pendingBills
    .filter((b) => b.type === "receivable")
    .reduce((s, b) => s + b.amount, 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const status = dueDate < today ? "overdue" : "pending";

    await supabase.from("bills").insert({
      user_id: user.id,
      description: desc.trim(),
      amount: parseFloat(amount),
      due_date: dueDate,
      type,
      status,
      recurrent,
      recurrence_day: recurrent ? new Date(dueDate).getDate() : null,
      notes: notes.trim() || null,
    });

    setDesc("");
    setAmount("");
    setDueDate("");
    setType("payable");
    setRecurrent(false);
    setNotes("");
    setShowForm(false);
    setSaving(false);
    setLoading(true);
    load();
  }

  async function markAsPaid(id: string) {
    setMarkingId(id);
    const supabase = createClient();
    await supabase.from("bills").update({ status: "paid" }).eq("id", id);
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "paid" as const } : b))
    );
    setMarkingId(null);
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="hidden md:block text-2xl font-bold">Contas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nova Conta
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 mb-4 md:mb-6">
        <div className="bg-dark-800 rounded-xl p-3 md:p-4 border border-dark-700">
          <p className="text-xs text-gray-400 mb-1">Pendente a pagar</p>
          <p className="text-lg md:text-xl font-bold text-red-400">{formatCurrency(totalPayable)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 md:p-4 border border-dark-700">
          <p className="text-xs text-gray-400 mb-1">Pendente a receber</p>
          <p className="text-lg md:text-xl font-bold text-green-400">{formatCurrency(totalReceivable)}</p>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <form
            onSubmit={handleAdd}
            className="relative bg-dark-800 rounded-t-2xl md:rounded-2xl p-5 md:p-6 border border-dark-700 w-full max-w-md space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Nova conta</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Descricao</label>
              <input
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-3 text-base md:text-sm text-white focus:outline-none focus:border-primary"
                placeholder="Ex: Aluguel, Internet..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-3 text-base md:text-sm text-white focus:outline-none focus:border-primary"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Vencimento</label>
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-3 text-base md:text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "payable" | "receivable")}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-3 text-base md:text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="payable">A pagar</option>
                  <option value="receivable">A receber</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recurrent}
                    onChange={(e) => setRecurrent(e.target.checked)}
                    className="w-5 h-5 rounded border-dark-700 bg-dark-900 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <RefreshCw size={14} className="text-gray-400" />
                    Recorrente
                  </span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Observacoes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-3 text-base md:text-sm text-white focus:outline-none focus:border-primary resize-none"
                placeholder="Opcional..."
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar conta"}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-dark-800 text-gray-400 active:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Nenhuma conta encontrada.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-dark-800 rounded-xl p-4 flex items-center justify-between border border-dark-700"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{b.description}</p>
                  {b.recurrent && (
                    <RefreshCw size={12} className="text-gray-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Vence em {formatDate(b.due_date)} ·{" "}
                  {b.type === "payable" ? "A pagar" : "A receber"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <div className="text-right">
                  <span className={`font-bold ${b.type === "receivable" ? "text-green-400" : "text-white"}`}>
                    {b.type === "receivable" ? "+" : "-"}{formatCurrency(b.amount)}
                  </span>
                  <span
                    className={`block text-xs px-2 py-0.5 rounded-full mt-1 text-center ${statusColor[b.status]}`}
                  >
                    {statusLabel[b.status]}
                  </span>
                </div>
                {(b.status === "pending" || b.status === "overdue") && (
                  <button
                    onClick={() => markAsPaid(b.id)}
                    disabled={markingId === b.id}
                    title="Marcar como pago"
                    className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
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
