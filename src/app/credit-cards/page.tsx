"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { CreditCard, CardTransaction } from "@/lib/types";
import { getCategoryConfig } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import AppShell from "@/components/AppShell";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CreditCard as CreditCardIcon,
  X,
  Trash2,
  Pencil,
  ShoppingCart,
  Layers,
  Receipt,
} from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CARD_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444",
  "#F59E0B", "#10B981", "#3B82F6", "#06B6D4",
  "#1E1E1E", "#374151",
];

export default function CreditCardsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Card form
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("15");
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);
  const [cardStatus, setCardStatus] = useState<"pending" | "paid" | "overdue">("pending");
  const [savingCard, setSavingCard] = useState(false);

  // Transaction form (create + edit)
  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTxOriginal, setEditingTxOriginal] = useState<CardTransaction | null>(null);
  const [txDesc, setTxDesc] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txCategory, setTxCategory] = useState("outros");
  const [txCustomCategory, setTxCustomCategory] = useState("");
  const [txInstallments, setTxInstallments] = useState(false);
  const [txNumInstallments, setTxNumInstallments] = useState("2");
  const [savingTx, setSavingTx] = useState(false);

  // Edit scope modal for installments
  const [showEditScope, setShowEditScope] = useState(false);
  const [editScopeTx, setEditScopeTx] = useState<CardTransaction | null>(null);
  const [editAllInstallments, setEditAllInstallments] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteTxIsInstallment, setDeleteTxIsInstallment] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Dynamic categories
  const { categories, addCategory } = useCategories();
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const loadCards = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setCards(data || []);
  }, []);

  const loadTransactions = useCallback(async (cardId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("card_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("card_id", cardId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false });

    setTransactions(data || []);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    setLoading(true);
    loadCards().then(() => setLoading(false));
  }, [loadCards]);

  useEffect(() => {
    if (cards.length > 0 && cards[activeCardIdx]) {
      loadTransactions(cards[activeCardIdx].id);
    } else {
      setTransactions([]);
    }
  }, [cards, activeCardIdx, loadTransactions]);

  function prevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else { setSelectedMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else { setSelectedMonth((m) => m + 1); }
  }
  function prevCard() { setActiveCardIdx((i) => (i === 0 ? cards.length - 1 : i - 1)); }
  function nextCard() { setActiveCardIdx((i) => (i === cards.length - 1 ? 0 : i + 1)); }

  // === Card form ===
  function resetCardForm() {
    setCardName(""); setCreditLimit(""); setClosingDay("5"); setDueDay("15");
    setCardColor(CARD_COLORS[0]); setCardStatus("pending"); setEditingCardId(null);
  }
  function openNewCard() { resetCardForm(); setShowCardForm(true); }
  function openEditCard(card: CreditCard) {
    setEditingCardId(card.id); setCardName(card.name);
    setCreditLimit(String(card.credit_limit)); setClosingDay(String(card.closing_day));
    setDueDay(String(card.due_day)); setCardColor(card.color); setCardStatus(card.status); setShowCardForm(true);
  }
  function closeCardForm() { setShowCardForm(false); resetCardForm(); }

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingCard(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingCard(false); return; }
    const cardData = {
      name: cardName.trim(), bank_name: cardName.trim(),
      credit_limit: parseFloat(creditLimit) || 0,
      closing_day: parseInt(closingDay), due_day: parseInt(dueDay), color: cardColor,
      status: cardStatus,
    };
    if (editingCardId) {
      await supabase.from("credit_cards").update(cardData).eq("id", editingCardId);
      showToast("Cartao atualizado");
    } else {
      await supabase.from("credit_cards").insert({ user_id: user.id, ...cardData });
      showToast("Cartao adicionado");
    }
    closeCardForm(); setSavingCard(false); await loadCards();
  }

  async function handleDeleteCard() {
    if (!editingCardId) return;
    setSavingCard(true);
    const supabase = createClient();
    // Delete linked bills
    await supabase.from("bills").delete().like("notes", `card:${editingCardId}%`);
    await supabase.from("card_transactions").delete().eq("card_id", editingCardId);
    await supabase.from("credit_cards").delete().eq("id", editingCardId);
    closeCardForm(); setSavingCard(false); setActiveCardIdx(0);
    await loadCards(); showToast("Cartao removido");
  }

  // === Transaction form ===
  function resetTxForm() {
    setTxDesc(""); setTxAmount(""); setTxDate(new Date().toISOString().split("T")[0]);
    setTxCategory("outros"); setTxCustomCategory(""); setTxInstallments(false);
    setTxNumInstallments("2"); setEditingTxId(null); setEditingTxOriginal(null);
    setEditAllInstallments(false);
  }
  function openNewTx() { resetTxForm(); setShowTxForm(true); }

  function openEditTx(tx: CardTransaction) {
    if (tx.installments > 1) {
      setEditScopeTx(tx);
      setShowEditScope(true);
      return;
    }
    fillTxFormForEdit(tx);
  }

  function fillTxFormForEdit(tx: CardTransaction) {
    setEditingTxId(tx.id);
    setEditingTxOriginal(tx);
    setTxDesc(tx.description);
    setTxAmount(String(tx.amount));
    setTxDate(tx.date);
    const cat = tx.category;
    const knownCat = categories.find((c) => c.name === cat);
    if (knownCat) {
      setTxCategory(cat); setTxCustomCategory("");
    } else {
      setTxCategory("_custom"); setTxCustomCategory(cat);
    }
    setTxInstallments(false);
    setTxNumInstallments("2");
    setShowTxForm(true);
  }

  function closeTxForm() { setShowTxForm(false); resetTxForm(); }

  async function handleTxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cards.length === 0) return;
    setSavingTx(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingTx(false); return; }

    const card = cards[activeCardIdx];
    const resolvedCategory = txCategory === "_custom" ? txCustomCategory.trim().toLowerCase() : txCategory;

    // === EDIT MODE ===
    if (editingTxId && editingTxOriginal) {
      const updateData = {
        description: txDesc.trim(),
        amount: parseFloat(txAmount),
        date: txDate,
        category: resolvedCategory,
      };

      if (editAllInstallments && editingTxOriginal.installments > 1) {
        // Edit all installments: find siblings by card_id + description + installments count
        const { data: siblings } = await supabase
          .from("card_transactions")
          .select("id, date, installment_current")
          .eq("card_id", card.id)
          .eq("description", editingTxOriginal.description)
          .eq("installments", editingTxOriginal.installments)
          .eq("user_id", user.id);

        if (siblings) {
          for (const sib of siblings) {
            await supabase.from("card_transactions")
              .update({ description: txDesc.trim(), amount: parseFloat(txAmount), category: resolvedCategory })
              .eq("id", sib.id);
          }
          // Update linked bills
          await updateLinkedBills(supabase, user.id, card, editingTxOriginal, txDesc.trim(), parseFloat(txAmount));
        }
        showToast("Todas as parcelas atualizadas");
      } else {
        await supabase.from("card_transactions").update(updateData).eq("id", editingTxId);
        showToast("Lancamento atualizado");
      }

      closeTxForm(); setSavingTx(false);
      await loadTransactions(card.id);
      return;
    }

    // === CREATE MODE ===
    const totalAmount = parseFloat(txAmount);
    const numInst = txInstallments ? parseInt(txNumInstallments) : 1;
    const installmentAmount = Math.round((totalAmount / numInst) * 100) / 100;

    const txs = [];
    for (let i = 0; i < numInst; i++) {
      const d = new Date(txDate + "T12:00:00");
      d.setMonth(d.getMonth() + i);
      txs.push({
        user_id: user.id, card_id: card.id,
        description: txDesc.trim(), amount: installmentAmount,
        date: d.toISOString().split("T")[0],
        installments: numInst, installment_current: i + 1,
        category: resolvedCategory,
      });
    }
    await supabase.from("card_transactions").insert(txs);

    // Create bills for each installment (and for single purchases too)
    const bills = [];
    for (let i = 0; i < numInst; i++) {
      const d = new Date(txDate + "T12:00:00");
      d.setMonth(d.getMonth() + i);
      const billYear = d.getFullYear();
      const billMonth = d.getMonth();
      const lastDayOfMonth = new Date(billYear, billMonth + 1, 0).getDate();
      const billDueDay = Math.min(card.due_day, lastDayOfMonth);
      const billDueDate = `${billYear}-${String(billMonth + 1).padStart(2, "0")}-${String(billDueDay).padStart(2, "0")}`;

      const billDesc = numInst > 1
        ? `${card.name} - ${txDesc.trim()} ${i + 1}/${numInst}`
        : `${card.name} - ${txDesc.trim()}`;

      bills.push({
        user_id: user.id,
        description: billDesc,
        amount: installmentAmount,
        due_date: billDueDate,
        type: "payable" as const,
        status: "pending" as const,
        recurrent: false,
        recurrence_day: null,
        notes: `card:${card.id}`,
      });
    }
    await supabase.from("bills").insert(bills);

    // Navigate to the month of the first installment so user sees it
    const firstDate = new Date(txDate + "T12:00:00");
    setSelectedYear(firstDate.getFullYear());
    setSelectedMonth(firstDate.getMonth());

    closeTxForm(); setSavingTx(false);
    await loadTransactions(card.id);
    showToast(
      numInst > 1
        ? `Parcelado em ${numInst}x de ${formatCurrency(installmentAmount)} — contas criadas`
        : "Lancamento adicionado — conta criada"
    );
  }

  async function updateLinkedBills(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    card: CreditCard,
    originalTx: CardTransaction,
    newDesc: string,
    newAmount: number,
  ) {
    const { data: bills } = await supabase
      .from("bills")
      .select("id, description")
      .eq("user_id", userId)
      .like("notes", `card:${card.id}%`)
      .like("description", `${card.name} - ${originalTx.description}%`);

    if (bills) {
      for (const bill of bills) {
        const match = bill.description.match(/(\d+\/\d+)$/);
        const suffix = match ? ` ${match[1]}` : "";
        await supabase.from("bills")
          .update({ description: `${card.name} - ${newDesc}${suffix}`, amount: newAmount })
          .eq("id", bill.id);
      }
    }
  }

  // === Delete transaction ===
  function confirmDeleteTx(tx: CardTransaction) {
    setDeleteTxId(tx.id);
    setDeleteTxIsInstallment(tx.installments > 1);
    setShowDeleteConfirm(true);
  }

  async function handleDeleteTx(deleteAll: boolean) {
    if (!deleteTxId) return;
    const supabase = createClient();
    const card = cards[activeCardIdx];
    const tx = transactions.find((t) => t.id === deleteTxId);

    if (deleteAll && tx && tx.installments > 1) {
      // Delete all siblings
      const { data: siblings } = await supabase
        .from("card_transactions")
        .select("id")
        .eq("card_id", card.id)
        .eq("description", tx.description)
        .eq("installments", tx.installments);

      if (siblings) {
        await supabase.from("card_transactions").delete().in("id", siblings.map((s) => s.id));
      }
      // Delete linked bills
      await supabase.from("bills").delete()
        .like("notes", `card:${card.id}%`)
        .like("description", `${card.name} - ${tx.description}%`);

      showToast("Todas as parcelas removidas");
    } else {
      await supabase.from("card_transactions").delete().eq("id", deleteTxId);
      // Delete linked bill for this specific transaction
      if (tx) {
        const billDescPattern = tx.installments > 1
          ? `${card.name} - ${tx.description} ${tx.installment_current}/${tx.installments}`
          : `${card.name} - ${tx.description}`;
        await supabase.from("bills").delete()
          .like("notes", `card:${card.id}%`)
          .eq("description", billDescPattern);
      }
      showToast("Lancamento removido");
    }

    setShowDeleteConfirm(false); setDeleteTxId(null);
    await loadTransactions(card.id);
  }

  // Edit scope handler
  function handleEditScopeChoice(editAll: boolean) {
    if (!editScopeTx) return;
    setShowEditScope(false);
    setEditAllInstallments(editAll);
    fillTxFormForEdit(editScopeTx);
  }

  // Calculations
  const activeCard = cards[activeCardIdx] || null;
  const totalFatura = transactions.reduce((s, t) => s + t.amount, 0);
  const availableLimit = activeCard ? activeCard.credit_limit - totalFatura : 0;
  const limitPercent = activeCard && activeCard.credit_limit > 0
    ? Math.min((totalFatura / activeCard.credit_limit) * 100, 100) : 0;
  const txAVista = transactions.filter((t) => t.installments === 1);
  const txParceladas = transactions.filter((t) => t.installments > 1);
  const totalAVista = txAVista.reduce((s, t) => s + t.amount, 0);
  const totalParcelado = txParceladas.reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400 flex items-center gap-2 animate-fade-in">
          <CreditCardIcon size={14} /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Cartoes de Credito</h2>
        <div className="flex gap-2">
          {cards.length > 0 && (
            <button onClick={openNewTx} className="flex items-center gap-1.5 glass-btn text-white/60 hover:text-white text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl transition-colors">
              <Plus size={14} /> Lancamento
            </button>
          )}
          <button onClick={openNewCard} className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl transition-colors">
            <Plus size={14} /> Cartao
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <CreditCardIcon size={48} className="mx-auto text-white/20" />
          <p className="text-white/30">Nenhum cartao cadastrado</p>
          <button onClick={openNewCard} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm px-6 py-3 rounded-xl transition-colors">
            Adicionar primeiro cartao
          </button>
        </div>
      ) : (
        <>
          {/* Card Carousel */}
          <div className="flex items-center gap-3 mb-4">
            {cards.length > 1 && (
              <button onClick={prevCard} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white flex-shrink-0">
                <ChevronLeft size={20} />
              </button>
            )}
            <div
              className="flex-1 rounded-2xl p-5 relative overflow-hidden cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${activeCard?.color || "#6366F1"}, ${activeCard?.color || "#6366F1"}88)` }}
              onClick={() => activeCard && openEditCard(activeCard)}
            >
              <div className="absolute top-3 right-3 opacity-20"><CreditCardIcon size={48} /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-bold text-lg">{activeCard?.name}</p>
                  <Pencil size={10} className="text-white/30" />
                </div>
                <div className="mb-3">
                  <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">Fatura atual</p>
                  <p className="text-white font-bold text-2xl">{formatCurrency(totalFatura)}</p>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-white/60 mb-1">
                    <span>Usado: {formatCurrency(totalFatura)}</span>
                    <span>Limite: {formatCurrency(activeCard?.credit_limit || 0)}</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${limitPercent}%`,
                      backgroundColor: limitPercent > 80 ? "#EF4444" : limitPercent > 50 ? "#F59E0B" : "#10B981",
                    }} />
                  </div>
                  <p className="text-[10px] text-white/60 mt-1">Disponivel: {formatCurrency(Math.max(availableLimit, 0))}</p>
                </div>
                <div className="flex gap-6 text-[10px] text-white/60">
                  <span>Fecha dia {activeCard?.closing_day}</span>
                  <span>Vence dia {activeCard?.due_day}</span>
                </div>
              </div>
            </div>
            {cards.length > 1 && (
              <button onClick={nextCard} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white flex-shrink-0">
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {cards.length > 1 && (
            <div className="flex justify-center gap-1.5 mb-4">
              {cards.map((_, i) => (
                <button key={i} onClick={() => setActiveCardIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeCardIdx ? "bg-[#6366F1] w-4" : "bg-white/20"}`} />
              ))}
            </div>
          )}

          {/* Month carousel */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white"><ChevronLeft size={20} /></button>
            <span className="text-sm font-semibold tracking-wide">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
            <button onClick={nextMonth} className="p-2 rounded-xl glass-btn text-white/60 hover:text-white"><ChevronRight size={20} /></button>
          </div>

          {/* Invoice summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="glass-card p-3">
              <div className="flex items-center gap-1.5 mb-1"><ShoppingCart size={12} className="text-blue-400" /><p className="label-upper">A Vista</p></div>
              <p className="text-base font-bold text-blue-400">{formatCurrency(totalAVista)}</p>
            </div>
            <div className="glass-card p-3">
              <div className="flex items-center gap-1.5 mb-1"><Layers size={12} className="text-purple-400" /><p className="label-upper">Parcelado</p></div>
              <p className="text-base font-bold text-purple-400">{formatCurrency(totalParcelado)}</p>
            </div>
            <div className="glass-card p-3">
              <div className="flex items-center gap-1.5 mb-1"><Receipt size={12} className="text-white" /><p className="label-upper">Total</p></div>
              <p className="text-base font-bold text-white">{formatCurrency(totalFatura)}</p>
            </div>
          </div>

          {/* Transactions list */}
          {transactions.length === 0 ? (
            <p className="text-white/30 text-center py-8">Nenhum lancamento neste mes</p>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx) => {
                const catConfig = getCategoryConfig(tx.category);
                const CatIcon = catConfig.icon;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-3 glass-divider">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: catConfig.color + "20" }}>
                        <CatIcon size={14} style={{ color: catConfig.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description}
                          {tx.installments > 1 && (
                            <span className="text-white/40 ml-1">{tx.installment_current}/{tx.installments}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-white/30">
                          {catConfig.label} · {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      <span className="font-bold text-sm text-white">{formatCurrency(tx.amount)}</span>
                      <button onClick={() => openEditTx(tx)}
                        className="p-1.5 rounded-lg text-white/20 hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => confirmDeleteTx(tx)}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal: New/Edit Card */}
      {showCardForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCardForm} />
          <form onSubmit={handleCardSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">{editingCardId ? "Editar cartao" : "Novo cartao"}</h2>
              <button type="button" onClick={closeCardForm} className="text-white/45 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div>
              <label className="label-upper block mb-1">Nome do cartao</label>
              <input required value={cardName} onChange={(e) => setCardName(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" placeholder="Ex: Nubank Gold, Inter Black..." />
            </div>
            <div>
              <label className="label-upper block mb-1">Limite de credito</label>
              <input required type="number" step="0.01" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">Dia fechamento</label>
                <input required type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
              <div>
                <label className="label-upper block mb-1">Dia vencimento</label>
                <input required type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
            </div>
            <div>
              <label className="label-upper block mb-1">Cor do cartao</label>
              <div className="flex flex-wrap gap-2">
                {CARD_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setCardColor(c)}
                    className={`w-9 h-9 rounded-xl transition-all ${cardColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110" : "opacity-60 hover:opacity-100"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className="label-upper block mb-1">Status</label>
              <select value={cardStatus} onChange={(e) => setCardStatus(e.target.value as "pending" | "paid" | "overdue")}
                className="w-full glass-input px-3 py-3 text-base text-white">
                <option value="pending" className="bg-[#1a1a2e]">Pendente</option>
                <option value="paid" className="bg-[#1a1a2e]">Pago</option>
                <option value="overdue" className="bg-[#1a1a2e]">Atrasado</option>
              </select>
            </div>
            <div className="flex gap-3">
              {editingCardId && (
                <button type="button" onClick={handleDeleteCard} disabled={savingCard}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  <Trash2 size={16} />
                </button>
              )}
              <button type="submit" disabled={savingCard}
                className="flex-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
                {savingCard ? "Salvando..." : editingCardId ? "Salvar alteracoes" : "Adicionar cartao"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: New/Edit Transaction */}
      {showTxForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeTxForm} />
          <form onSubmit={handleTxSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">{editingTxId ? "Editar lancamento" : "Novo lancamento"}</h2>
              <button type="button" onClick={closeTxForm} className="text-white/45 hover:text-white p-1"><X size={20} /></button>
            </div>
            <p className="text-xs text-white/40">Cartao: <span className="text-white/70">{activeCard?.name}</span></p>
            <div>
              <label className="label-upper block mb-1">Descricao</label>
              <input required value={txDesc} onChange={(e) => setTxDesc(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white" placeholder="Ex: Netflix, Supermercado..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper block mb-1">{editingTxId ? "Valor" : "Valor total"}</label>
                <input required type="number" step="0.01" min="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" placeholder="0,00" />
              </div>
              <div>
                <label className="label-upper block mb-1">Data</label>
                <input required type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
            </div>
            <div>
              <label className="label-upper block mb-1">Categoria</label>
              <select value={txCategory}
                onChange={(e) => {
                  if (e.target.value === "__add__") { setShowNewCatModal(true); return; }
                  setTxCategory(e.target.value);
                  if (e.target.value !== "_custom") setTxCustomCategory("");
                }}
                className="w-full glass-input px-3 py-3 text-base text-white">
                {categories.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#1a1a2e]">{c.label}</option>
                ))}
                <option value="_custom" className="bg-[#1a1a2e]">Digitar manualmente...</option>
                <option value="__add__" className="bg-[#1a1a2e]">+ Adicionar categoria</option>
              </select>
              {txCategory === "_custom" && (
                <input required value={txCustomCategory} onChange={(e) => setTxCustomCategory(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white mt-2" placeholder="Ex: Assinatura, Farmacia..." />
              )}
            </div>
            {!editingTxId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={txInstallments} onChange={(e) => setTxInstallments(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#6366F1]" id="installments" />
                  <label htmlFor="installments" className="text-sm text-white/60 flex items-center gap-1 cursor-pointer">
                    <Layers size={14} className="text-white/45" /> Parcelado
                  </label>
                </div>
                {txInstallments && (
                  <div className="glass-card p-3 space-y-2">
                    <label className="label-upper block">Numero de parcelas</label>
                    <input type="number" min="2" max="48" value={txNumInstallments} onChange={(e) => setTxNumInstallments(e.target.value)}
                      className="w-full glass-input px-3 py-2.5 text-sm text-white" />
                    {txAmount && (
                      <p className="text-xs text-[#818CF8] flex items-center gap-1.5">
                        <Layers size={12} />
                        {txNumInstallments}x de {formatCurrency(parseFloat(txAmount) / parseInt(txNumInstallments || "1"))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <button type="submit" disabled={savingTx}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {savingTx ? "Salvando..." : editingTxId ? "Salvar alteracoes" : "Adicionar lancamento"}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Edit scope for installments */}
      {showEditScope && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditScope(false)} />
          <div className="relative glass p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Editar parcela</h2>
            <p className="text-sm text-white/60">Este lancamento e parcelado. O que deseja editar?</p>
            <div className="space-y-2">
              <button onClick={() => handleEditScopeChoice(false)}
                className="w-full glass-btn text-white text-sm py-3 rounded-xl hover:bg-white/10 transition-colors">
                So este mes
              </button>
              <button onClick={() => handleEditScopeChoice(true)}
                className="w-full glass-btn text-white text-sm py-3 rounded-xl hover:bg-white/10 transition-colors">
                Todas as parcelas
              </button>
            </div>
            <button onClick={() => setShowEditScope(false)} className="w-full text-white/40 text-sm py-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal: Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative glass p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Confirmar exclusao</h2>
            {deleteTxIsInstallment ? (
              <>
                <p className="text-sm text-white/60">Este lancamento e parcelado. O que deseja excluir?</p>
                <div className="space-y-2">
                  <button onClick={() => handleDeleteTx(false)}
                    className="w-full glass-btn text-white text-sm py-3 rounded-xl hover:bg-white/10 transition-colors">
                    So este mes
                  </button>
                  <button onClick={() => handleDeleteTx(true)}
                    className="w-full bg-red-500/20 text-red-400 text-sm py-3 rounded-xl hover:bg-red-500/30 transition-colors">
                    Todas as parcelas e contas vinculadas
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/60">Tem certeza que deseja excluir este lancamento?</p>
                <button onClick={() => handleDeleteTx(false)}
                  className="w-full bg-red-500/20 text-red-400 text-sm py-3 rounded-xl hover:bg-red-500/30 transition-colors">
                  Excluir
                </button>
              </>
            )}
            <button onClick={() => setShowDeleteConfirm(false)} className="w-full text-white/40 text-sm py-2">Cancelar</button>
          </div>
        </div>
      )}
      {/* Modal: Nova Categoria */}
      {showNewCatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setShowNewCatModal(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova Categoria</h2>
              <button onClick={() => setShowNewCatModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="label-upper mb-1 block">Nome</label>
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Assinaturas, Pet..."
                className="glass-input w-full px-3 py-2 text-sm text-white"
                onKeyDown={(e) => e.key === "Enter" && (async () => {
                  if (!newCatName.trim()) return;
                  const cat = await addCategory(newCatName);
                  if (cat) setTxCategory(cat.name);
                  setNewCatName(""); setShowNewCatModal(false);
                })()}
                autoFocus />
            </div>
            <button onClick={async () => {
              if (!newCatName.trim()) return;
              const cat = await addCategory(newCatName);
              if (cat) setTxCategory(cat.name);
              setNewCatName(""); setShowNewCatModal(false);
            }} className="glass-btn-active w-full py-2.5 text-sm font-medium">
              Adicionar
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
