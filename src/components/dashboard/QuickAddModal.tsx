"use client";

import { useState } from "react";
import { X, CreditCard, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { computeBilling, addMonths } from "@/lib/cardBilling";
import { updateWalletBalance } from "@/lib/wallet";
import { applyCategoryRules } from "@/lib/categoryRules";
import { useCategories } from "@/lib/useCategories";

export type QuickAddCard = {
  id: string;
  name: string;
  color: string;
  status: string;
  closing_day: number;
  due_day: number;
};

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  cards: QuickAddCard[];
}

export default function QuickAddModal({ open, onClose, onAdded, cards }: QuickAddModalProps) {
  const { categories: catList } = useCategories();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [cardId, setCardId] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("outros");
  const [installments, setInstallments] = useState(false);
  const [numInstallments, setNumInstallments] = useState("2");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return "Erro inesperado";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const totalAmount = parseFloat(amount);
    const isCard = type === "expense" && method === "card";

    // Auto-categoria se usuario deixou em "outros"
    let resolvedCategory = category;
    if (category === "outros") {
      const auto = await applyCategoryRules(supabase, user.id, desc.trim());
      if (auto) resolvedCategory = auto;
    }

    if (isCard) {
      const card = cards.find((c) => c.id === cardId);
      if (!card) { setSaving(false); showToast("Selecione um cartão"); return; }
      const numInst = installments ? parseInt(numInstallments) : 1;
      const installmentAmount = Math.round((totalAmount / numInst) * 100) / 100;
      const firstPeriod = computeBilling(date, card.closing_day, card.due_day);

      const txs = [];
      const bills = [];
      for (let i = 0; i < numInst; i++) {
        const period = i === 0 ? firstPeriod : addMonths(firstPeriod, i, card.due_day);
        txs.push({
          user_id: user.id, card_id: card.id,
          description: desc.trim(), amount: installmentAmount,
          date, bill_date: period.billDate,
          installments: numInst, installment_current: i + 1,
          category: resolvedCategory,
        });
        const billDesc = numInst > 1
          ? `${card.name} - ${desc.trim()} ${i + 1}/${numInst}`
          : `${card.name} - ${desc.trim()}`;
        bills.push({
          user_id: user.id, description: billDesc, amount: installmentAmount,
          due_date: period.dueDate, type: "payable" as const, status: "pending" as const,
          recurrent: false, recurrence_day: null, notes: `card:${card.id}`,
        });
      }
      const { error } = await supabase.from("card_transactions").insert(txs);
      if (error) { setSaving(false); showToast("Erro: " + error.message); return; }
      await supabase.from("bills").insert(bills);
      showToast(numInst > 1 ? `Parcelado ${numInst}x no ${card.name}` : `Gasto no ${card.name} registrado`);
    } else {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        description: desc.trim(),
        amount: totalAmount,
        category: resolvedCategory,
        date,
        type,
        status: "completed",
      });
      if (error) { setSaving(false); showToast("Erro: " + error.message); return; }
      const delta = type === "income" ? totalAmount : -totalAmount;
      try {
        await updateWalletBalance(supabase, user.id, delta);
      } catch (error) {
        setSaving(false);
        onClose();
        onAdded();
        window.dispatchEvent(new Event("finapp:data-changed"));
        showToast("Movimentação salva, mas o saldo não foi atualizado: " + getErrorMessage(error));
        setType("expense"); setMethod("pix");
        setCardId(cards[0]?.id || "");
        setDesc(""); setAmount("");
        setDate(new Date().toISOString().split("T")[0]);
        setCategory("outros");
        setInstallments(false); setNumInstallments("2");
        return;
      }
      showToast(type === "income" ? "Receita registrada" : "Gasto registrado");
    }

    setSaving(false);
    onClose();
    onAdded();
    window.dispatchEvent(new Event("finapp:data-changed"));

    // Reset form
    setType("expense"); setMethod("pix");
    setCardId(cards[0]?.id || "");
    setDesc(""); setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("outros");
    setInstallments(false); setNumInstallments("2");
  }

  if (!open) return null;

  return (
    <>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] glass px-5 py-3 text-sm text-green-400">
          {toast}
        </div>
      )}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <form onSubmit={handleSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Lançamento Rápido</h2>
            <button type="button" onClick={onClose} className="text-white/45 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-white/45">
            Use aqui apenas movimentações realizadas. Compromissos futuros ficam na Agenda Financeira.
          </p>

          <div>
            <label className="label-upper block mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType("expense")}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  type === "expense" ? "bg-red-500/20 text-red-400 border border-red-500/50" : "glass-btn text-white/60"
                }`}>Gasto realizado</button>
              <button type="button" onClick={() => setType("income")}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  type === "income" ? "bg-green-500/20 text-green-400 border border-green-500/50" : "glass-btn text-white/60"
                }`}>Receita realizada</button>
            </div>
          </div>

          {type === "expense" && (
            <div>
              <label className="label-upper block mb-2">Forma de pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMethod("pix")}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    method === "pix" ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50" : "glass-btn text-white/60"
                  }`}>PIX / Débito</button>
                <button type="button" onClick={() => {
                    if (cards.length === 0) { showToast("Cadastre um cartão primeiro"); return; }
                    setMethod("card");
                    if (!cardId) setCardId(cards[0].id);
                  }}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    method === "card" ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50" : "glass-btn text-white/60"
                  }`}>
                  <CreditCard size={14} /> Cartão
                </button>
              </div>
            </div>
          )}

          {type === "expense" && method === "card" && cards.length > 0 && (
            <div>
              <label className="label-upper block mb-1">Cartão</label>
              <select required value={cardId} onChange={(e) => setCardId(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white">
                {cards.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1a1a2e]">{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label-upper block mb-1">Descrição</label>
            <input required value={desc} onChange={(e) => setDesc(e.target.value)}
              className="w-full glass-input px-3 py-3 text-base text-white"
              placeholder="Ex: Mercado, Uber, Salário..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-upper block mb-1">Valor</label>
              <input required type="number" step="0.01" min="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" placeholder="0,00" />
            </div>
            <div>
              <label className="label-upper block mb-1">Data</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" />
            </div>
          </div>

          <div>
            <label className="label-upper block mb-1">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full glass-input px-3 py-3 text-base text-white">
              {catList.map((c) => (
                <option key={c.name} value={c.name} className="bg-[#1a1a2e]">{c.label}</option>
              ))}
            </select>
          </div>

          {type === "expense" && method === "card" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={installments} onChange={(e) => setInstallments(e.target.checked)}
                  className="w-5 h-5 rounded accent-[#6366F1]" id="q-installments" />
                <label htmlFor="q-installments" className="text-sm text-white/60 flex items-center gap-1 cursor-pointer">
                  <Layers size={14} className="text-white/45" /> Parcelado
                </label>
              </div>
              {installments && (
                <div className="glass-card p-3 space-y-2">
                  <label className="label-upper block">Número de parcelas</label>
                  <input type="number" min="2" max="48" value={numInstallments}
                    onChange={(e) => setNumInstallments(e.target.value)}
                    className="w-full glass-input px-3 py-2.5 text-sm text-white" />
                  {amount && (
                    <p className="text-xs text-[#818CF8] flex items-center gap-1.5">
                      <Layers size={12} />
                      {numInstallments}x de {formatCurrency(parseFloat(amount) / parseInt(numInstallments || "1"))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : "Registrar movimentação"}
          </button>
        </form>
      </div>
    </>
  );
}
