"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateWalletBalance } from "@/lib/wallet";
import { useCategories } from "@/lib/useCategories";
import {
  DEFAULT_BUDGET, addDays, mondayOf, shortDate, todayStr,
  type NewListItem, type ShoppingItem, type ShoppingList, type ShoppingListItem,
} from "@/lib/shopping";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import WeekTab from "@/components/shopping/WeekTab";
import FixedTab from "@/components/shopping/FixedTab";
import HistoryTab from "@/components/shopping/HistoryTab";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";

type Tab = "semana" | "fixos" | "hist";
const TABS: { key: Tab; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "fixos", label: "Itens fixos" },
  { key: "hist", label: "Histórico" },
];

export default function ShoppingPage() {
  const [tab, setTab] = useState<Tab>("semana");
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [fixed, setFixed] = useState<ShoppingItem[]>([]);
  const [history, setHistory] = useState<ShoppingList[]>([]);
  const [monthCats, setMonthCats] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");
  const { categories } = useCategories();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [listRes, fixedRes, histRes, monthRes] = await Promise.all([
      supabase.from("shopping_lists").select("*").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle(),
      supabase.from("shopping_items").select("*").eq("user_id", user.id)
        .order("position", { ascending: true, nullsFirst: false }).order("created_at"),
      supabase.from("shopping_lists").select("*").eq("user_id", user.id).eq("status", "done")
        .order("week_start", { ascending: false }).limit(8),
      supabase.from("shopping_lists").select("id").eq("user_id", user.id).eq("status", "done")
        .gte("finished_at", monthStart),
    ]);

    const toNum = <T extends { budget?: unknown; total?: unknown }>(l: T) => ({
      ...l, budget: Number(l.budget), total: l.total == null ? null : Number(l.total),
    });
    const cur = listRes.data ? (toNum(listRes.data) as ShoppingList) : null;
    setList(cur);
    setFixed((fixedRes.data || []).map((f) => ({ ...f, estimated_price: Number(f.estimated_price) })));
    setHistory((histRes.data || []).map((l) => toNum(l) as ShoppingList));

    const [curItemsRes, monthItemsRes] = await Promise.all([
      cur
        ? supabase.from("shopping_list_items").select("*").eq("list_id", cur.id)
            .order("position", { ascending: true, nullsFirst: false }).order("created_at")
        : Promise.resolve({ data: [] as ShoppingListItem[] }),
      (monthRes.data || []).length > 0
        ? supabase.from("shopping_list_items").select("category, price")
            .eq("checked", true).in("list_id", (monthRes.data || []).map((l) => l.id))
        : Promise.resolve({ data: [] as { category: string; price: number | null }[] }),
    ]);

    setItems(((curItemsRes.data || []) as ShoppingListItem[]).map((i) => ({
      ...i, estimated_price: Number(i.estimated_price), price: i.price == null ? null : Number(i.price),
    })));
    const cats: Record<string, number> = {};
    (monthItemsRes.data || []).forEach((i) => {
      cats[i.category] = (cats[i.category] || 0) + Number(i.price || 0);
    });
    setMonthCats(cats);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  async function getUserId() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  // ---------- Semana ----------
  async function generateList() {
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;

    // orcamento herdado da lista mais recente
    const { data: last } = await supabase.from("shopping_lists").select("id, budget")
      .eq("user_id", uid).lt("week_start", weekStart).order("week_start", { ascending: false }).limit(1).maybeSingle();

    const { data: created, error } = await supabase.from("shopping_lists")
      .insert({ user_id: uid, week_start: weekStart, budget: last ? Number(last.budget) : DEFAULT_BUDGET })
      .select().single();
    if (error || !created) { showToast("Não foi possível criar a lista"); return; }

    // avulsos nao comprados da lista anterior vao junto
    let carried: { name: string; qty: string; category: string; estimated_price: number }[] = [];
    if (last) {
      const { data: pend } = await supabase.from("shopping_list_items").select("name, qty, category, estimated_price")
        .eq("list_id", last.id).eq("checked", false).is("item_id", null);
      carried = (pend || []).map((p) => ({ ...p, estimated_price: Number(p.estimated_price) }));
    }

    const rows = [
      ...fixed.map((f) => ({
        item_id: f.id, name: f.name, qty: f.qty, category: f.category, estimated_price: f.estimated_price,
      })),
      ...carried.map((c) => ({ item_id: null, ...c })),
    ].map((r, i) => ({ ...r, list_id: created.id, user_id: uid, position: i }));

    if (rows.length > 0) await supabase.from("shopping_list_items").insert(rows);
    load();
  }

  function patchItem(id: string, patch: Partial<ShoppingListItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function saveItem(id: string, patch: { checked?: boolean; price?: number | null }) {
    patchItem(id, patch);
    const supabase = createClient();
    const { error } = await supabase.from("shopping_list_items").update(patch).eq("id", id);
    if (error) { showToast("Erro ao salvar item"); load(); }
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const supabase = createClient();
    await supabase.from("shopping_list_items").delete().eq("id", id);
  }

  async function addAvulso(n: NewListItem) {
    if (!list) return;
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;

    let itemId: string | null = null;
    if (n.saveAsFixed) {
      const { data } = await supabase.from("shopping_items").insert({
        user_id: uid, name: n.name, qty: n.qty, category: n.category,
        estimated_price: n.estimated_price, position: fixed.length,
      }).select().single();
      itemId = data?.id || null;
    }
    await supabase.from("shopping_list_items").insert({
      list_id: list.id, user_id: uid, item_id: itemId, name: n.name, qty: n.qty,
      category: n.category, estimated_price: n.estimated_price, position: items.length,
    });
    load();
  }

  async function setBudget(v: number) {
    if (!list || v <= 0) return;
    setList({ ...list, budget: v });
    const supabase = createClient();
    await supabase.from("shopping_lists").update({ budget: v }).eq("id", list.id);
  }

  async function finish(categoryName: string) {
    if (!list || list.status === "done") return;
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;

    const done = items.filter((i) => i.checked);
    const total = Math.round(done.reduce((s, i) => s + (i.price ?? 0), 0) * 100) / 100;
    if (total <= 0) { showToast("Informe o preço dos itens comprados"); return; }

    const { data: tx, error } = await supabase.from("transactions").insert({
      user_id: uid,
      description: `Compras da semana ${shortDate(list.week_start)}`,
      amount: -total,
      category: categoryName,
      date: todayStr(),
      type: "expense",
      status: "completed",
    }).select("id").single();
    if (error || !tx) { showToast("Erro ao lançar despesa: " + (error?.message || "")); return; }

    await supabase.from("shopping_lists").update({
      status: "done", total, transaction_id: tx.id, finished_at: new Date().toISOString(),
    }).eq("id", list.id);

    let walletOk = true;
    try { await updateWalletBalance(supabase, uid, -total); } catch { walletOk = false; }

    window.dispatchEvent(new Event("finapp:data-changed"));
    showToast(walletOk ? "Despesa lançada em Transações ✓" : "Despesa lançada, mas o saldo não foi atualizado");
    load();
  }

  // ---------- Itens fixos ----------
  async function saveFixed(data: { name: string; qty: string; category: string; estimated_price: number }, id?: string) {
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    if (id) {
      await supabase.from("shopping_items").update(data).eq("id", id);
    } else {
      await supabase.from("shopping_items").insert({ ...data, user_id: uid, position: fixed.length });
    }
    load();
  }

  async function deleteFixed(id: string) {
    const supabase = createClient();
    await supabase.from("shopping_items").delete().eq("id", id);
    load();
  }

  async function reorderFixed(next: ShoppingItem[]) {
    setFixed(next);
    const supabase = createClient();
    const results = await Promise.all(
      next.map((f, i) => supabase.from("shopping_items").update({ position: i }).eq("id", f.id))
    );
    if (results.some((r) => r.error)) load();
  }

  const expenseCategories = categories.filter((c) => c.name !== "salario" && c.name !== "investimento");
  const isCurrentWeek = weekStart === mondayOf();

  return (
    <AppShell>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-4 pb-40">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-[#6366F1]" />
              <h1 className="text-lg font-bold">Compras</h1>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => { setLoading(true); setWeekStart(addDays(weekStart, -7)); }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white" aria-label="Semana anterior">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => { setLoading(true); setWeekStart(mondayOf()); }}
                className="font-bold min-w-[72px] text-center" title="Voltar para a semana atual">
                Seg {shortDate(weekStart)}
              </button>
              <button onClick={() => { setLoading(true); setWeekStart(addDays(weekStart, 7)); }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white" aria-label="Próxima semana">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 glass-card p-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-[#6366F1]/30 text-white" : "text-white/45 hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "semana" && (
            <WeekTab
              list={list} items={items} weekStart={weekStart} isCurrentWeek={isCurrentWeek}
              hasFixed={fixed.length > 0} expenseCategories={expenseCategories}
              onGenerate={generateList} onSaveItem={saveItem} onRemoveItem={removeItem}
              onAddAvulso={addAvulso} onBudget={setBudget} onFinish={finish}
            />
          )}
          {tab === "fixos" && (
            <FixedTab items={fixed} onSave={saveFixed} onDelete={deleteFixed} onReorder={reorderFixed} />
          )}
          {tab === "hist" && <HistoryTab history={history} monthCats={monthCats} />}

          {toast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
              {toast}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

