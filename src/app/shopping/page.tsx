"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateWalletBalance } from "@/lib/wallet";
import { useCategories } from "@/lib/useCategories";
import {
  DEFAULT_BUDGET, addDays, daysBetween, mondayOf, shortDate, stockStatus, todayStr,
  type NewListItem, type ShoppingItem, type ShoppingList, type ShoppingListItem,
} from "@/lib/shopping";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import WeekTab from "@/components/shopping/WeekTab";
import FixedTab from "@/components/shopping/FixedTab";
import HistoryTab from "@/components/shopping/HistoryTab";
import { useStockAlerts, daysLeftLabel } from "@/lib/useStockAlerts";
import { AlertTriangle, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";

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

    // itens com duracao so entram se acabam antes da proxima compra
    const rows = [
      ...fixed.flatMap((f) => {
        const st = stockStatus(f, weekStart);
        if (!st.due) return [];
        return [{
          item_id: f.id, name: f.name, qty: f.qty, category: f.category,
          estimated_price: f.estimated_price, hint: st.hint,
        }];
      }),
      ...carried.map((c) => ({ item_id: null, hint: "Sobrou da semana passada", ...c })),
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
        estimated_price: n.estimated_price, duration_days: n.duration_days, position: fixed.length,
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

    // registra a data da compra dos itens fixos (base do alerta "esta acabando") e
    // aprende o ritmo real: aproxima a duração do intervalo desde a compra anterior
    // (70% valor atual + 30% intervalo real, para não oscilar com uma compra fora do normal).
    // Não aprende de item comprado antes da hora ("Adicionado antes da hora") nem de intervalos < 3 dias.
    const today = todayStr();
    const fixedById = new Map(fixed.map((f) => [f.id, f]));
    // Item SEM duração: a 1ª compra só registra a data; a próxima calcula a duração
    // (intervalo real entre as duas compras).
    let learned = 0;
    let firstCalc = 0;
    await Promise.all(
      done.flatMap((i) => {
        if (!i.item_id) return [];
        const f = fixedById.get(i.item_id);
        const patch: { last_bought_at: string; duration_days?: number } = { last_bought_at: today };
        if (f?.last_bought_at && !i.hint?.startsWith("Adicionado antes")) {
          const gap = daysBetween(f.last_bought_at, today);
          if (gap >= 3) {
            if (f.duration_days) {
              const next = Math.min(365, Math.max(1, Math.round(f.duration_days * 0.7 + gap * 0.3)));
              if (next !== f.duration_days) { patch.duration_days = next; learned++; }
            } else {
              patch.duration_days = Math.min(365, gap);
              firstCalc++;
            }
          }
        }
        return [supabase.from("shopping_items").update(patch).eq("id", i.item_id)];
      }),
    );

    let walletOk = true;
    try { await updateWalletBalance(supabase, uid, -total); } catch { walletOk = false; }

    window.dispatchEvent(new Event("finapp:data-changed"));
    const learnedMsg =
      (firstCalc > 0 ? ` · ${firstCalc} ${firstCalc === 1 ? "duração calculada" : "durações calculadas"} pela 2ª compra` : "") +
      (learned > 0 ? ` · ${learned} ${learned === 1 ? "duração ajustada" : "durações ajustadas"} pelo seu histórico` : "");
    window.dispatchEvent(new Event("finapp:stock-changed"));
    showToast((walletOk ? "Despesa lançada em Transações ✓" : "Despesa lançada, mas o saldo não foi atualizado") + learnedMsg);
    load();
  }

  // ---------- Itens fixos ----------
  async function saveFixed(data: { name: string; qty: string; category: string; estimated_price: number; duration_days: number | null; last_bought_at: string | null }, id?: string) {
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    if (id) {
      await supabase.from("shopping_items").update(data).eq("id", id);
    } else {
      await supabase.from("shopping_items").insert({ ...data, user_id: uid, position: fixed.length });
    }
    window.dispatchEvent(new Event("finapp:stock-changed"));
    load();
  }

  async function addFromStock(f: ShoppingItem) {
    if (!list || list.status === "done") return;
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    const st = stockStatus(f, weekStart);
    await supabase.from("shopping_list_items").insert({
      list_id: list.id, user_id: uid, item_id: f.id, name: f.name, qty: f.qty, category: f.category,
      estimated_price: f.estimated_price, hint: st.hint ? `Adicionado antes da hora · ${st.hint.toLowerCase()}` : null,
      position: items.length,
    });
    load();
  }

  async function applyDurations(updates: { id: string; days: number }[]) {
    const supabase = createClient();
    await Promise.all(updates.map((u) => supabase.from("shopping_items").update({ duration_days: u.days }).eq("id", u.id)));
    showToast("Durações atualizadas ✓");
    window.dispatchEvent(new Event("finapp:stock-changed"));
    load();
  }

  async function deleteFixed(id: string) {
    const supabase = createClient();
    await supabase.from("shopping_items").delete().eq("id", id);
    window.dispatchEvent(new Event("finapp:stock-changed"));
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

  const stockAlerts = useStockAlerts();
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

          {/* Itens acabando */}
          {stockAlerts.items.length > 0 && (
            <div className="glass-card px-3 py-2.5 border border-amber-500/30">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Acabando
              </p>
              <p className="text-xs text-white/60 mt-1">
                {stockAlerts.items.map((i) => `${i.name} (${daysLeftLabel(i.daysLeft)})`).join(" · ")}
              </p>
              <p className="text-[11px] text-white/35 mt-1">
                Entram na lista da semana com a dica. Na aba Semana, &quot;Em estoque&quot; mostra o que ainda dura.
              </p>
            </div>
          )}

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
              inStock={fixed.filter((f) => f.duration_days && !items.some((i) => i.item_id === f.id))}
              weekStartForStock={weekStart} onAddFromStock={addFromStock}
            />
          )}
          {tab === "fixos" && (
            <FixedTab items={fixed} weekStart={weekStart} onSave={saveFixed} onDelete={deleteFixed}
              onReorder={reorderFixed} onApplyDurations={applyDurations} />
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

