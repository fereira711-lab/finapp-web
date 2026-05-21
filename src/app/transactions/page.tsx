"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryConfig } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import type { Transaction, CardTransaction, CreditCard } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Plus, X, CreditCard as CreditCardIcon, Layers } from "lucide-react";
import { computeBilling, addMonths } from "@/lib/cardBilling";

const PERIODS = [
  { label: "Este mês", value: "current" },
  { label: "Mês anterior", value: "previous" },
  { label: "Últimos 3 meses", value: "3months" },
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
  cardName?: string;
  cardColor?: string;
  installmentLabel?: string;
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [category, setCategory] = useState("todas");
  const [period, setPeriod] = useState<PeriodValue>("current");
  const [loading, setLoading] = useState(true);
  const { categories, addCategory } = useCategories();
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
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
        cardName: c?.name,
        cardColor: c?.color,
        installmentLabel: t.installments > 1 ? `${t.installment_current}/${t.installments}` : undefined,
      };
    });

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
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
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
      showToast(fType === "income" ? "Receita registrada" : "Gasto registrado");
    }

    closeForm();
    setSaving(false);
    await load();
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
                      {r.source === "card" && r.cardName && (
                        <>
                          <span>·</span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                            style={{
                              backgroundColor: (r.cardColor || "#6366F1") + "30",
                              color: r.cardColor || "#6366F1",
                            }}
                          >
                            <CreditCardIcon size={10} /> {r.cardName}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 ml-3 ${isIncome ? "text-green-400" : "text-red-400"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(r.amount)}
                </span>
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
                {fType === "income" ? "Nova receita" : "Novo gasto"}
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

            {/* Metodo (so para despesa) */}
            {fType === "expense" && (
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
            {fType === "expense" && fMethod === "card" && cards.length > 0 && (
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

            {/* Parcelamento (so para cartao + despesa) */}
            {fType === "expense" && fMethod === "card" && (
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
