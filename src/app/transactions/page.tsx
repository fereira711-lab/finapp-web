"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import type { Transaction, CardTransaction, CreditCard } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Plus, X, CreditCard as CreditCardIcon, Layers, Pencil, Trash2 } from "lucide-react";
import { computeBilling, addMonths } from "@/lib/cardBilling";
import { updateWalletBalance } from "@/lib/wallet";

const PERIODS = [
  { label: "Este mês", value: "current" },
  { label: "Mês anterior", value: "previous" },
  { label: "Últimos 3 meses", value: "3months" },
  { label: "Todas", value: "all" },
] as const;

type PeriodValue = (typeof PERIODS)[number]["value"];

function getDateRange(period: PeriodValue): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "current":
      return { start: new Date(y, m, 1).toISOString(), end: new Date(y, m + 1, 0).toISOString() };
    case "previous":
      return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 0).toISOString() };
    case "3months":
      return { start: new Date(y, m - 2, 1).toISOString(), end: new Date(y, m + 1, 0).toISOString() };
    case "all":
      return { start: new Date(1970, 0, 1).toISOString(), end: new Date(y + 50, 11, 31).toISOString() };
  }
}

type UnifiedRow = {
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
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [allCardTxRows, setAllCardTxRows] = useState<UnifiedRow[]>([]);
  const [category, setCategory] = useState("todas");
  const [period, setPeriod] = useState<PeriodValue>("current");
  const [loading, setLoading] = useState(true);
  const { categories, addCategory } = useCategories();
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Modal de detalhes do cartao
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null); // ID real (sem prefixo)
  const [editingOriginal, setEditingOriginal] = useState<{ amount: number; type: "income" | "expense" } | null>(null);
  const [fType, setFType] = useState<"expense" | "income">("expense");
  const [fMethod, setFMethod] = useState<"pix" | "card">("pix");
  const [fCardId, setFCardId] = useState<string>("");
  const [fInstallments, setFInstallments] = useState(false);
  const [fNumInstallments, setFNumInstallments] = useState("2");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDate, setFDate] = useState(new Date().toISOString().split("T")[0]);
  const [fCategory, setFCategory] = useState("outros");
  const [toast, setToast] = useState<string | null>(null);

  // Delete confirmation
  const [deleteRow, setDeleteRow] = useState<UnifiedRow | null>(null);
  const [deleteAllInstallments, setDeleteAllInstallments] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { start, end } = getDateRange(period);

    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [txRes, cardTxRes, cardsRes] = await Promise.all([
      supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", start).lte("date", end)
        .order("date", { ascending: false }),
      supabase.from("card_transactions").select("*")
        .eq("user_id", user.id).gte("date", startStr).lte("date", endStr)
        .order("date", { ascending: false }),
      supabase.from("credit_cards").select("*").eq("user_id", user.id),
    ]);

    const cardList = (cardsRes.data || []) as CreditCard[];
    setCards(cardList);
    const cardById: Record<string, CreditCard> = {};
    cardList.forEach((c) => { cardById[c.id] = c; });

    const txRows: UnifiedRow[] = (txRes.data || []).map((t: Transaction) => ({
      id: `tx-${t.id}`,
      source: "transaction",
      description: t.description,
      amount: Math.abs(t.amount),
      category: t.category,
      date: t.date,
      type: (t.type === "income" || t.amount > 0) ? "income" : "expense",
    }));

    const cardRows: UnifiedRow[] = (cardTxRes.data || []).map((t: CardTransaction) => {
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
      };
    });

    // Guarda lista completa de gastos de cartao do periodo (sem filtro de categoria) para o modal
    setAllCardTxRows(cardRows);

    let merged = [...txRows, ...cardRows].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (category !== "todas") {
      merged = merged.filter((r) => r.category === category);
    }

    setRows(merged);
    setLoading(false);
  }, [category, period]);

  useEffect(() => { load(); }, [load]);

  const totalExpenses = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);

  const totalIncome = rows
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);

  const categoryOptions = [
    { value: "todas", label: "Todas as categorias" },
    ...categories.map((c) => ({ value: c.name, label: c.label })),
  ];

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const cat = await addCategory(newCatName);
    if (cat) setFCategory(cat.name);
    setNewCatName("");
    setShowNewCat(false);
  }

  function resetForm() {
    setFType("expense");
    setFMethod("pix");
    setFCardId(cards[0]?.id || "");
    setFInstallments(false);
    setFNumInstallments("2");
    setFDesc("");
    setFAmount("");
    setFDate(new Date().toISOString().split("T")[0]);
    setFCategory("outros");
    setEditingTxId(null);
    setEditingOriginal(null);
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditRow(row: UnifiedRow) {
    if (row.source === "card") {
      showToast("Edite gastos de cartao no menu Cartoes");
      return;
    }
    const realId = row.id.replace(/^tx-/, "");
    setEditingTxId(realId);
    setEditingOriginal({ amount: row.amount, type: row.type });
    setFType(row.type);
    setFMethod("pix"); // edit so suporta nao-cartao
    setFDesc(row.description);
    setFAmount(String(row.amount));
    setFDate(row.date);
    setFCategory(row.category);
    setFInstallments(false);
    setFNumInstallments("2");
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

    const isCardExpense = fType === "expense" && fMethod === "card";
    const totalAmount = parseFloat(fAmount);

    if (isCardExpense) {
      if (!fCardId) { setSaving(false); showToast("Selecione um cartao"); return; }
      const card = cards.find((c) => c.id === fCardId);
      if (!card) { setSaving(false); return; }

      const numInst = fInstallments ? parseInt(fNumInstallments) : 1;
      const installmentAmount = Math.round((totalAmount / numInst) * 100) / 100;
      const firstPeriod = computeBilling(fDate, card.closing_day, card.due_day);

      const txs = [];
      const bills = [];
      for (let i = 0; i < numInst; i++) {
        const period = i === 0 ? firstPeriod : addMonths(firstPeriod, i, card.due_day);

        txs.push({
          user_id: user.id, card_id: card.id,
          description: fDesc.trim(), amount: installmentAmount,
          date: fDate, // data real da compra
          bill_date: period.billDate, // mes da fatura
          installments: numInst, installment_current: i + 1,
          category: fCategory,
        });

        const billDesc = numInst > 1
          ? `${card.name} - ${fDesc.trim()} ${i + 1}/${numInst}`
          : `${card.name} - ${fDesc.trim()}`;

        bills.push({
          user_id: user.id,
          description: billDesc,
          amount: installmentAmount,
          due_date: period.dueDate,
          type: "payable" as const,
          status: "pending" as const,
          recurrent: false,
          recurrence_day: null,
          notes: `card:${card.id}`,
        });
      }

      const { error: txErr } = await supabase.from("card_transactions").insert(txs);
      if (txErr) { setSaving(false); showToast("Erro ao salvar: " + txErr.message); return; }
      await supabase.from("bills").insert(bills);

      showToast(numInst > 1
        ? `Parcelado em ${numInst}x de ${formatCurrency(installmentAmount)} no ${card.name}`
        : `Gasto no ${card.name} registrado`);
    } else {
      if (editingTxId && editingOriginal) {
        // EDIT MODE: ajusta saldo pelo delta entre original e novo
        const { error } = await supabase.from("transactions").update({
          description: fDesc.trim(),
          amount: totalAmount,
          category: fCategory,
          date: fDate,
          type: fType,
        }).eq("id", editingTxId);
        if (error) { setSaving(false); showToast("Erro ao salvar: " + error.message); return; }

        // Reverte efeito original e aplica novo
        const oldDelta = editingOriginal.type === "income" ? editingOriginal.amount : -editingOriginal.amount;
        const newDelta = fType === "income" ? totalAmount : -totalAmount;
        await updateWalletBalance(supabase, user.id, newDelta - oldDelta);
        showToast("Atualizado");
      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          description: fDesc.trim(),
          amount: totalAmount,
          category: fCategory,
          date: fDate,
          type: fType,
          status: "completed",
        });
        if (error) { setSaving(false); showToast("Erro ao salvar: " + error.message); return; }
        const delta = fType === "income" ? totalAmount : -totalAmount;
        await updateWalletBalance(supabase, user.id, delta);
        showToast(fType === "income" ? "Receita registrada" : "Gasto registrado");
      }
    }

    closeForm();
    setSaving(false);
    await load();
    window.dispatchEvent(new Event("finapp:data-changed"));
  }

  async function handleDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }

    if (deleteRow.source === "transaction") {
      const realId = deleteRow.id.replace(/^tx-/, "");
      const { error } = await supabase.from("transactions").delete().eq("id", realId);
      if (error) { setDeleting(false); showToast("Erro ao excluir: " + error.message); return; }
      // Reverte saldo
      const delta = deleteRow.type === "income" ? -deleteRow.amount : deleteRow.amount;
      await updateWalletBalance(supabase, user.id, delta);
      showToast("Excluido");
    } else {
      // card_transaction: deleta e remove bill vinculada
      const realId = deleteRow.id.replace(/^card-/, "");
      const card = cards.find((c) => c.id === deleteRow.cardId);

      // Carrega tx pra saber description, installments etc
      const { data: tx } = await supabase
        .from("card_transactions")
        .select("*")
        .eq("id", realId)
        .single();

      if (!tx) { setDeleting(false); showToast("Lancamento nao encontrado"); return; }

      if (deleteAllInstallments && tx.installments > 1 && card) {
        // Deletar todas as parcelas
        const { data: siblings } = await supabase
          .from("card_transactions")
          .select("id")
          .eq("card_id", tx.card_id)
          .eq("description", tx.description)
          .eq("installments", tx.installments)
          .eq("user_id", user.id);
        if (siblings && siblings.length > 0) {
          await supabase.from("card_transactions").delete().in("id", siblings.map((s) => s.id));
        }
        await supabase.from("bills").delete()
          .eq("user_id", user.id)
          .eq("notes", `card:${tx.card_id}`)
          .like("description", `${card.name} - ${tx.description}%`);
        showToast("Parcelas removidas");
      } else {
        await supabase.from("card_transactions").delete().eq("id", realId);
        if (card) {
          const billDescPattern = tx.installments > 1
            ? `${card.name} - ${tx.description} ${tx.installment_current}/${tx.installments}`
            : `${card.name} - ${tx.description}`;
          await supabase.from("bills").delete()
            .eq("user_id", user.id)
            .eq("notes", `card:${tx.card_id}`)
            .eq("description", billDescPattern);
        }
        showToast("Lancamento removido");
      }
    }

    setDeleteRow(null);
    setDeleteAllInstallments(false);
    setDeleting(false);
    await load();
    window.dispatchEvent(new Event("finapp:data-changed"));
  }

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400 flex items-center gap-2 animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Gastos</h2>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={14} /> Novo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <select
            value={category}
            onChange={(e) => {
              if (e.target.value === "__add__") { setShowNewCat(true); return; }
              setCategory(e.target.value);
            }}
            className="glass-input px-4 py-3 text-base md:text-sm text-white w-full"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
                {opt.label}
              </option>
            ))}
            <option value="__add__" className="bg-[#1a1a2e]">+ Adicionar categoria</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 rounded-xl text-xs uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                period === p.value
                  ? "glass-btn-active text-white"
                  : "glass-btn text-white/45"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4 glass-divider pb-4">
        <div className="glass-card p-3">
          <p className="label-upper mb-1">Receitas</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="label-upper mb-1">Gastos</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-white/30">Nenhum gasto encontrado.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const cat = getCategoryConfig(r.category);
            const Icon = cat.icon;
            const isIncome = r.type === "income";

            return (
              <div key={r.id} className="flex items-center justify-between py-3 glass-divider">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "20" }}
                  >
                    <Icon size={18} style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {r.description}
                      {r.installmentLabel && (
                        <span className="text-white/40 ml-1 text-xs">{r.installmentLabel}</span>
                      )}
                    </p>
                    <p className="text-xs text-white/30 flex items-center gap-1.5 flex-wrap">
                      <span>{cat.label}</span>
                      <span>·</span>
                      <span>{formatDate(r.date)}</span>
                      {r.source === "card" && r.cardName && r.cardId && (
                        <>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDetailCardId(r.cardId!); }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium hover:brightness-125 transition"
                            style={{
                              backgroundColor: (r.cardColor || "#6366F1") + "30",
                              color: r.cardColor || "#6366F1",
                            }}
                            title="Ver detalhes do cartao"
                          >
                            <CreditCardIcon size={10} /> {r.cardName}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  <span className={`font-bold text-sm ${isIncome ? "text-green-400" : "text-red-400"}`}>
                    {isIncome ? "+" : "-"}{formatCurrency(r.amount)}
                  </span>
                  {r.source === "transaction" && (
                    <button
                      onClick={() => openEditRow(r)}
                      className="p-1.5 rounded-lg text-white/20 hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteRow(r); setDeleteAllInstallments(false); }}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Gasto/Receita */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">
                {editingTxId
                  ? (fType === "income" ? "Editar receita" : "Editar gasto")
                  : (fType === "income" ? "Nova receita" : "Novo gasto")}
              </h2>
              <button type="button" onClick={closeForm} className="text-white/45 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Tipo */}
            <div>
              <label className="label-upper block mb-2">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFType("expense")}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    fType === "expense"
                      ? "bg-red-500/20 text-red-400 border border-red-500/50"
                      : "glass-btn text-white/60"
                  }`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setFType("income")}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    fType === "income"
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : "glass-btn text-white/60"
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>

            {/* Metodo (so para despesa, escondido em edit) */}
            {fType === "expense" && !editingTxId && (
              <div>
                <label className="label-upper block mb-2">Forma de pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFMethod("pix")}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      fMethod === "pix"
                        ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50"
                        : "glass-btn text-white/60"
                    }`}
                  >
                    PIX / Débito
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cards.length === 0) {
                        showToast("Cadastre um cartao primeiro em Cartoes");
                        return;
                      }
                      setFMethod("card");
                      if (!fCardId) setFCardId(cards[0].id);
                    }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      fMethod === "card"
                        ? "bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/50"
                        : "glass-btn text-white/60"
                    }`}
                  >
                    <CreditCardIcon size={14} /> Cartão
                  </button>
                </div>
              </div>
            )}

            {/* Cartao selector */}
            {fType === "expense" && fMethod === "card" && cards.length > 0 && !editingTxId && (
              <div>
                <label className="label-upper block mb-1">Cartão</label>
                <select
                  required
                  value={fCardId}
                  onChange={(e) => setFCardId(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#1a1a2e]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label-upper block mb-1">Descrição</label>
              <input
                required
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white"
                placeholder="Ex: Mercado, Uber, Salário..."
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
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="label-upper block mb-1">Data</label>
                <input
                  required
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white"
                />
              </div>
            </div>

            <div>
              <label className="label-upper block mb-1">Categoria</label>
              <select
                value={fCategory}
                onChange={(e) => {
                  if (e.target.value === "__add__") { setShowNewCat(true); return; }
                  setFCategory(e.target.value);
                }}
                className="w-full glass-input px-3 py-3 text-base text-white"
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#1a1a2e]">
                    {c.label}
                  </option>
                ))}
                <option value="__add__" className="bg-[#1a1a2e]">+ Adicionar categoria</option>
              </select>
            </div>

            {/* Parcelamento (so para cartao + despesa, nao em edit) */}
            {fType === "expense" && fMethod === "card" && !editingTxId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fInstallments}
                    onChange={(e) => setFInstallments(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#6366F1]"
                    id="form-installments"
                  />
                  <label htmlFor="form-installments" className="text-sm text-white/60 flex items-center gap-1 cursor-pointer">
                    <Layers size={14} className="text-white/45" /> Parcelado
                  </label>
                </div>
                {fInstallments && (
                  <div className="glass-card p-3 space-y-2">
                    <label className="label-upper block">Número de parcelas</label>
                    <input
                      type="number"
                      min="2"
                      max="48"
                      value={fNumInstallments}
                      onChange={(e) => setFNumInstallments(e.target.value)}
                      className="w-full glass-input px-3 py-2.5 text-sm text-white"
                    />
                    {fAmount && (
                      <p className="text-xs text-[#818CF8] flex items-center gap-1.5">
                        <Layers size={12} />
                        {fNumInstallments}x de {formatCurrency(parseFloat(fAmount) / parseInt(fNumInstallments || "1"))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Detalhes do cartao */}
      {detailCardId && (() => {
        const card = cards.find((c) => c.id === detailCardId);
        const txs = allCardTxRows
          .filter((r) => r.cardId === detailCardId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const total = txs.reduce((s, r) => s + r.amount, 0);
        if (!card) return null;

        const periodLabel = PERIODS.find((p) => p.value === period)?.label || "";

        return (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
            onClick={() => setDetailCardId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative glass w-full max-w-md md:mx-4 rounded-t-2xl md:rounded-2xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div
                className="p-5 rounded-t-2xl"
                style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}88)` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 text-white">
                    <CreditCardIcon size={20} />
                    <div>
                      <p className="font-bold text-base">{card.name}</p>
                      <p className="text-[11px] text-white/70">
                        Fecha dia {card.closing_day} · Vence dia {card.due_day}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailCardId(null)}
                    className="text-white/70 hover:text-white p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-white/70 text-[10px] uppercase tracking-wider mb-0.5">
                  Total {periodLabel.toLowerCase()}
                </p>
                <p className="text-white text-2xl font-bold">{formatCurrency(total)}</p>
                <p className="text-white/70 text-[11px] mt-0.5">
                  {txs.length} {txs.length === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>

              {/* Lista de transacoes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {txs.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-8">
                    Nenhum lançamento neste período
                  </p>
                ) : (
                  txs.map((tx) => {
                    const cat = getCategoryConfig(tx.category);
                    const Icon = cat.icon;
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2.5 glass-divider">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: cat.color + "20" }}
                          >
                            <Icon size={14} style={{ color: cat.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {tx.description}
                              {tx.installmentLabel && (
                                <span className="text-white/40 ml-1 text-xs">
                                  {tx.installmentLabel}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-white/30">
                              {cat.label} · {formatDate(tx.date)}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-red-400 flex-shrink-0 ml-3">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Confirmar exclusao */}
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

            {deleteRow.source === "card" && deleteRow.installmentLabel && (
              <div className="flex items-center gap-2 p-3 glass-card">
                <input
                  type="checkbox"
                  id="del-all-inst"
                  checked={deleteAllInstallments}
                  onChange={(e) => setDeleteAllInstallments(e.target.checked)}
                  className="w-5 h-5 rounded accent-[#6366F1]"
                />
                <label htmlFor="del-all-inst" className="text-xs text-white/70 cursor-pointer">
                  Excluir <span className="font-bold">todas as parcelas</span> e contas vinculadas
                </label>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleDelete}
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

      {/* Modal: Nova Categoria */}
      {showNewCat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setShowNewCat(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova Categoria</h2>
              <button onClick={() => setShowNewCat(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="label-upper mb-1 block">Nome</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Assinaturas, Pet..."
                className="glass-input w-full px-3 py-2 text-sm text-white"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                autoFocus
              />
            </div>
            <button onClick={handleAddCategory} className="glass-btn-active w-full py-2.5 text-sm font-medium">
              Adicionar
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
