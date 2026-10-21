"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateWalletBalance } from "@/lib/wallet";
import { categoryKey } from "@/lib/useCategories";
import {
  DEFAULT_BUDGET, addDays, daysBetween, mondayOf, shopCat, shortDate, stockStatus, todayStr,
  type NewListItem, type ShoppingItem, type ShoppingList, type ShoppingListItem,
} from "@/lib/shopping";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import WeekTab from "@/components/shopping/WeekTab";
import FixedTab from "@/components/shopping/FixedTab";
import HistoryTab from "@/components/shopping/HistoryTab";
import { useStockAlerts, daysLeftLabel } from "@/lib/useStockAlerts";
import VoiceEntryModal from "@/components/dashboard/VoiceEntryModal";
import { AlertTriangle, ShoppingCart, ChevronLeft, ChevronRight, Mic } from "lucide-react";

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
  const [showVoice, setShowVoice] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  // Atalho da Siri: /shopping?voz=frase abre o "Falar" ja interpretando a compra
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("voz");
    // abre mesmo com a frase vazia (Atalho sem texto): o usuario fala/digita na tela
    if (q !== null) {
      setVoiceText(q.trim().slice(0, 300));
      setShowVoice(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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
      supabase.from("shopping_lists").select("*").eq("user_id", user.id).eq("week_start", weekStart)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
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

    // com varias compras por semana permitidas, evita criar lista repetida por toque duplo
    const { data: already } = await supabase.from("shopping_lists").select("id")
      .eq("user_id", uid).eq("week_start", weekStart).limit(1);
    if (already && already.length > 0) { load(); return; }

    // orcamento herdado da lista mais recente
    const { data: last } = await supabase.from("shopping_lists").select("id, budget")
      .eq("user_id", uid).lt("week_start", weekStart).order("week_start", { ascending: false })
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

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

  const addingAvulso = useRef(false);
  async function addAvulso(n: NewListItem) {
    if (!list || addingAvulso.current) return;
    addingAvulso.current = true;
    try {
      await addAvulsoNow(n, list);
    } finally {
      addingAvulso.current = false;
    }
  }

  async function addAvulsoNow(n: NewListItem, list: ShoppingList) {
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

  async function finish() {
    if (!list || list.status === "done") return;
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;

    const done = items.filter((i) => i.checked);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    // uma despesa por categoria de mercado (higiene, carnes, mercearia...), sem perguntar
    const byCat = new Map<string, number>();
    done.forEach((i) => byCat.set(i.category, r2((byCat.get(i.category) || 0) + (i.price ?? 0))));
    const parts = Array.from(byCat.entries()).filter(([, v]) => v > 0)
      .map(([shop, amount]) => {
        const c = shopCat(shop);
        return { shop, amount, label: c.label, name: categoryKey(c.label), color: c.color };
      });
    const total = r2(parts.reduce((s, p) => s + p.amount, 0));
    if (total <= 0) { showToast("Informe o preço dos itens comprados"); return; }

    // categoria do app com o mesmo nome (ex.: "higiene"); se não existir, é criada
    const { data: existing } = await supabase.from("categories").select("name")
      .eq("user_id", uid).in("name", parts.map((p) => p.name));
    const have = new Set((existing || []).map((e) => e.name as string));
    const missing = parts.filter((p) => !have.has(p.name));
    if (missing.length > 0) {
      const { error: cErr } = await supabase.from("categories").upsert(
        missing.map((p) => ({ user_id: uid, name: p.name, color: p.color, icon: "📦" })),
        { onConflict: "user_id,name", ignoreDuplicates: true },
      );
      if (cErr) { showToast("Erro ao criar categorias: " + cErr.message); return; }
    }

    const { data: txs, error } = await supabase.from("transactions").insert(
      parts.map((p) => ({
        user_id: uid,
        description: `Compras da semana ${shortDate(list.week_start)} · ${p.label}`,
        amount: -p.amount,
        category: p.name,
        date: todayStr(),
        type: "expense",
        status: "completed",
      })),
    ).select("id");
    if (error || !txs || txs.length === 0) { showToast("Erro ao lançar despesa: " + (error?.message || "")); return; }
    const tx = txs[0];

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
    const launched = parts.length === 1 ? "Despesa lançada" : `${parts.length} despesas lançadas (uma por categoria)`;
    showToast((walletOk ? `${launched} em Transações ✓` : `${launched}, mas o saldo não foi atualizado`) + learnedMsg);
    load();
  }

  // Nova compra na mesma semana, depois de finalizar a anterior:
  // abre outra lista com o que sobrou e o orçamento que restou da semana.
  async function newPurchase() {
    if (!list || list.status !== "done") return;
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;

    const { data: weekLists } = await supabase.from("shopping_lists").select("budget, total, status")
      .eq("user_id", uid).eq("week_start", list.week_start).order("created_at", { ascending: true });
    const rows = weekLists || [];
    const weekBudget = rows.length > 0 ? Number(rows[0].budget) : list.budget;
    const spent = rows.filter((l) => l.status === "done").reduce((s, l) => s + Number(l.total ?? 0), 0);
    const remaining = Math.max(Math.round((weekBudget - spent) * 100) / 100, 0);

    const { data: created, error } = await supabase.from("shopping_lists")
      .insert({ user_id: uid, week_start: list.week_start, budget: remaining }).select().single();
    if (error || !created) {
      showToast(error?.code === "23505"
        ? "Falta liberar mais de uma compra por semana (migração 011 no Supabase)"
        : "Não foi possível abrir a nova compra");
      return;
    }

    // o que não foi comprado na lista anterior continua na nova
    const left = items.filter((i) => !i.checked).map((i, idx) => ({
      list_id: created.id, user_id: uid, item_id: i.item_id, name: i.name, qty: i.qty, category: i.category,
      estimated_price: i.estimated_price, hint: "Sobrou da compra anterior", position: idx,
    }));
    if (left.length > 0) await supabase.from("shopping_list_items").insert(left);

    showToast(`Nova compra aberta · orçamento restante ${remaining.toFixed(2).replace(".", ",")}`);
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

  // Toques repetidos em "+ Adicionar" (a tela demora a atualizar no celular) criavam o mesmo item várias vezes:
  // trava por item e mostra o item na lista na hora, sem esperar o recarregamento.
  const addingIds = useRef<Set<string>>(new Set());
  async function addFromStock(f: ShoppingItem) {
    if (!list || list.status === "done") return;
    if (addingIds.current.has(f.id) || items.some((i) => i.item_id === f.id)) return;
    addingIds.current.add(f.id);
    try {
      const supabase = createClient();
      const uid = await getUserId();
      if (!uid) return;
      const st = stockStatus(f, weekStart);
      const { data, error } = await supabase.from("shopping_list_items").insert({
        list_id: list.id, user_id: uid, item_id: f.id, name: f.name, qty: f.qty, category: f.category,
        estimated_price: f.estimated_price, hint: st.hint ? `Adicionado antes da hora · ${st.hint.toLowerCase()}` : null,
        position: items.length,
      }).select().single();
      if (error || !data) { showToast("Não foi possível adicionar o item"); return; }
      const row = data as ShoppingListItem;
      setItems((prev) => prev.some((i) => i.id === row.id) ? prev : [
        ...prev, { ...row, estimated_price: Number(row.estimated_price), price: row.price == null ? null : Number(row.price) },
      ]);
      load();
    } finally {
      addingIds.current.delete(f.id);
    }
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
              {isCurrentWeek && (
                <button onClick={() => { setVoiceText(""); setShowVoice(true); }} aria-label="Falar item comprado"
                  className="ml-1 glass-btn-active flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium">
                  <Mic size={14} /> Falar
                </button>
              )}
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
              hasFixed={fixed.length > 0}
              onGenerate={generateList} onSaveItem={saveItem} onRemoveItem={removeItem}
              onAddAvulso={addAvulso} onBudget={setBudget} onFinish={finish} onNewPurchase={newPurchase}
              inStock={fixed.filter((f) => f.duration_days && !items.some((i) => i.item_id === f.id))}
              weekStartForStock={weekStart} onAddFromStock={addFromStock}
            />
          )}
          {tab === "fixos" && (
            <FixedTab items={fixed} weekStart={weekStart} onSave={saveFixed} onDelete={deleteFixed}
              onReorder={reorderFixed} onApplyDurations={applyDurations} />
          )}
          {tab === "hist" && <HistoryTab history={history} monthCats={monthCats} />}

          {showVoice && (
            <VoiceEntryModal
              mode="shopping"
              initialText={voiceText}
              onClose={() => setShowVoice(false)}
              onSaved={() => { showToast("Item marcado como comprado ✓"); load(); }}
              onEntry={() => setShowVoice(false)}
            />
          )}

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

