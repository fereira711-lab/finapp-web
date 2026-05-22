"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { useCategories } from "@/lib/useCategories";
import type { RecurringTemplate, CreditCard } from "@/lib/types";
import { getCategoryConfig } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import { Plus, X, CreditCard as CreditCardIcon, Pencil, Trash2, RefreshCw } from "lucide-react";

export default function RecurringPage() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const { categories } = useCategories();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fType, setFType] = useState<"expense" | "income">("expense");
  const [fMethod, setFMethod] = useState<"pix" | "card">("pix");
  const [fCardId, setFCardId] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDay, setFDay] = useState("5");
  const [fCategory, setFCategory] = useState("outros");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [tplRes, cardsRes] = await Promise.all([
      supabase.from("recurring_templates").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("credit_cards").select("*").eq("user_id", user.id),
    ]);

    setTemplates((tplRes.data || []) as RecurringTemplate[]);
    setCards((cardsRes.data || []) as CreditCard[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFType("expense");
    setFMethod("pix");
    setFCardId(cards[0]?.id || "");
    setFDesc("");
    setFAmount("");
    setFDay("5");
    setFCategory("outros");
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(t: RecurringTemplate) {
    setEditingId(t.id);
    setFType(t.type);
    setFMethod((t.method as "pix" | "card") || "pix");
    setFCardId(t.card_id || cards[0]?.id || "");
    setFDesc(t.description);
    setFAmount(String(t.amount));
    setFDay(String(t.day_of_month));
    setFCategory(t.category);
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

    const tplData = {
      type: fType,
      method: fType === "expense" ? fMethod : null,
      card_id: fType === "expense" && fMethod === "card" ? fCardId : null,
      description: fDesc.trim(),
      amount: parseFloat(fAmount),
      category: fCategory,
      day_of_month: parseInt(fDay),
    };

    if (editingId) {
      await supabase.from("recurring_templates").update(tplData).eq("id", editingId);
      showToast("Atualizado");
    } else {
      await supabase.from("recurring_templates").insert({ user_id: user.id, active: true, ...tplData });
      showToast("Recorrencia criada");
    }

    closeForm();
    setSaving(false);
    await load();
  }

  async function toggleActive(t: RecurringTemplate) {
    const supabase = createClient();
    await supabase.from("recurring_templates").update({ active: !t.active }).eq("id", t.id);
    showToast(t.active ? "Pausada" : "Reativada");
    await load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    await supabase.from("recurring_templates").delete().eq("id", deleteId);
    setDeleteId(null);
    showToast("Removida");
    await load();
  }

  function methodLabel(t: RecurringTemplate): string {
    if (t.type === "income") return "Receita";
    if (t.method === "card") {
      const card = cards.find((c) => c.id === t.card_id);
      return card ? `Cartao · ${card.name}` : "Cartao";
    }
    return "PIX / Débito";
  }

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Recorrentes</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={14} /> Novo
        </button>
      </div>

      <p className="text-xs text-white/45 mb-4">
        Lancamentos automaticos. Toda vez que o dia configurado chegar, a transacao e criada no mes corrente.
      </p>

      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <RefreshCw size={40} className="mx-auto text-white/20" />
          <p className="text-white/40 text-sm">Nenhuma recorrencia configurada</p>
          <button onClick={openNew} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm px-5 py-2.5 rounded-xl transition-colors">
            Criar primeira
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const cat = getCategoryConfig(t.category);
            const Icon = cat.icon;
            const isIncome = t.type === "income";
            return (
              <div key={t.id} className={`glass-card p-3 flex items-center justify-between ${!t.active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "20" }}>
                    <Icon size={16} style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <p className="text-[11px] text-white/40 flex items-center gap-1.5 flex-wrap">
                      <span>Dia {t.day_of_month}</span>
                      <span>·</span>
                      <span>{methodLabel(t)}</span>
                      {!t.active && <span className="text-yellow-400">· Pausada</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  <span className={`text-sm font-bold ${isIncome ? "text-green-400" : "text-red-400"}`}>
                    {isIncome ? "+" : "-"}{formatCurrency(Number(t.amount))}
                  </span>
                  <button onClick={() => toggleActive(t)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-[#818CF8] hover:bg-[#6366F1]/10 transition-colors"
                    title={t.active ? "Pausar" : "Reativar"}>
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors"
                    title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteId(t.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New/Edit */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">
                {editingId ? "Editar recorrencia" : "Nova recorrencia"}
              </h2>
              <button type="button" onClick={closeForm} className="text-white/45 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="label-upper block mb-2">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFType("expense")}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    fType === "expense" ? "bg-red-500/20 text-red-400 border border-red-500/50" : "glass-btn text-white/60"
                  }`}>Despesa</button>
                <button type="button" onClick={() => setFType("income")}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    fType === "income" ? "bg-green-500/20 text-green-400 border border-green-500/50" : "glass-btn text-white/60"
                  }`}>Receita</button>
              </div>
            </div>

            {fType === "expense" && (
              <div>
                <label className="label-upper block mb-2">Forma de pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFMethod("pix")}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      fMethod === "pix" ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50" : "glass-btn text-white/60"
                    }`}>PIX / Débito</button>
                  <button type="button" onClick={() => {
                      if (cards.length === 0) { showToast("Cadastre um cartao primeiro"); return; }
                      setFMethod("card");
                      if (!fCardId) setFCardId(cards[0].id);
                    }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      fMethod === "card" ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50" : "glass-btn text-white/60"
                    }`}>
                    <CreditCardIcon size={14} /> Cartão
                  </button>
                </div>
              </div>
            )}

            {fType === "expense" && fMethod === "card" && cards.length > 0 && (
              <div>
                <label className="label-upper block mb-1">Cartão</label>
                <select required value={fCardId} onChange={(e) => setFCardId(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white">
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#1a1a2e]">{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label-upper block mb-1">Descrição</label>
              <input required value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white"
                placeholder="Ex: Netflix, Salario, Aluguel..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Valor</label>
                <input required type="number" step="0.01" min="0.01" value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" placeholder="0,00" />
              </div>
              <div>
                <label className="label-upper block mb-1">Dia do mês</label>
                <input required type="number" min="1" max="31" value={fDay}
                  onChange={(e) => setFDay(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
            </div>

            <div>
              <label className="label-upper block mb-1">Categoria</label>
              <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white">
                {categories.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#1a1a2e]">{c.label}</option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-white/40">
              A transacao sera criada todo mes no dia {fDay} (ou no ultimo dia do mes, se nao existir).
              Funciona apenas a partir de quando o dia chegar.
            </p>

            <button type="submit" disabled={saving}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Adicionar"}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Delete */}
      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative glass p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Excluir recorrencia?</h2>
            <p className="text-sm text-white/60">
              Esta acao remove apenas o template. As transacoes ja criadas continuam existindo.
            </p>
            <div className="space-y-2">
              <button onClick={handleDelete}
                className="w-full bg-red-500/20 text-red-400 text-sm font-medium py-3 rounded-xl hover:bg-red-500/30 transition-colors">
                Excluir
              </button>
              <button onClick={() => setDeleteId(null)} className="w-full text-white/40 text-sm py-2">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
