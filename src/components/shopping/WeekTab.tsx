"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import {
  SHOP_CATEGORIES, parsePrice, priceToText, progressColors, shortDate, shopCat, stockStatus,
  type NewListItem, type ShoppingItem, type ShoppingList, type ShoppingListItem,
} from "@/lib/shopping";
import type { Category } from "@/lib/useCategories";
import ItemFormModal from "./ItemFormModal";
import { Check, Plus, Trash2, X } from "lucide-react";

interface Props {
  list: ShoppingList | null;
  items: ShoppingListItem[];
  weekStart: string;
  isCurrentWeek: boolean;
  hasFixed: boolean;
  expenseCategories: Category[];
  onGenerate: () => Promise<void>;
  onSaveItem: (id: string, patch: { checked?: boolean; price?: number | null }) => void;
  onRemoveItem: (id: string) => void;
  onAddAvulso: (n: NewListItem) => void;
  onBudget: (v: number) => void;
  onFinish: (categoryName: string) => Promise<void>;
  inStock: ShoppingItem[];
  weekStartForStock: string;
  onAddFromStock: (item: ShoppingItem) => void;
}

function Row({ item, locked, onSave, onRemove }: {
  item: ShoppingListItem; locked: boolean;
  onSave: Props["onSaveItem"]; onRemove: Props["onRemoveItem"];
}) {
  const [text, setText] = useState(priceToText(item.price));
  useEffect(() => { setText(priceToText(item.price)); }, [item.price]);

  function toggle() {
    if (locked) return;
    const checked = !item.checked;
    if (checked && item.price == null && item.estimated_price > 0) {
      onSave(item.id, { checked, price: item.estimated_price });
    } else {
      onSave(item.id, { checked });
    }
  }

  function commitPrice() {
    if (locked) return;
    const v = text.trim() === "" ? null : parsePrice(text);
    if (v === item.price) return;
    onSave(item.id, v == null ? { price: null } : { price: v, checked: true });
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.08] last:border-0">
      <button type="button" onClick={toggle} disabled={locked} aria-label="Marcar como comprado"
        className={`w-[22px] h-[22px] rounded-[7px] border-[1.5px] flex items-center justify-center shrink-0 ${
          item.checked ? "bg-[#6366F1] border-[#6366F1]" : "border-white/25"}`}>
        {item.checked && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${item.checked ? "line-through text-white/40" : ""}`}>{item.name}</p>
        <p className="text-[11px] text-white/40">
          {item.qty}{item.estimated_price > 0 && ` · est. ${formatCurrency(item.estimated_price)}`}
        </p>
        {item.hint && !item.checked && <p className="text-[11px] text-yellow-400/90">{item.hint}</p>}
      </div>
      <input type="text" inputMode="decimal" value={text} disabled={locked}
        onChange={(e) => setText(e.target.value)} onBlur={commitPrice}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        placeholder={priceToText(item.estimated_price) || "0,00"}
        className="glass-input w-[84px] px-2 py-1.5 text-sm text-right text-white disabled:opacity-60" />
      {!locked && (
        <button onClick={() => onRemove(item.id)} aria-label="Remover item"
          className="p-1 text-white/25 hover:text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );
}

export default function WeekTab({
  list, items, weekStart, isCurrentWeek, hasFixed, expenseCategories,
  onGenerate, onSaveItem, onRemoveItem, onAddAvulso, onBudget, onFinish,
  inStock, weekStartForStock, onAddFromStock,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetText, setBudgetText] = useState("");
  const [showFinish, setShowFinish] = useState(false);
  const [finishCat, setFinishCat] = useState("alimentacao");
  const [busy, setBusy] = useState(false);

  if (!list) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-white/40 text-sm">
          {isCurrentWeek ? "Nenhuma lista para esta semana" : `Sem lista na semana de ${shortDate(weekStart)}`}
        </p>
        <p className="text-white/25 text-xs">
          {hasFixed
            ? "A lista nasce com os seus itens fixos."
            : "Cadastre seus itens de sempre na aba \"Itens fixos\" para a lista já nascer pronta."}
        </p>
        <button disabled={busy} onClick={async () => { setBusy(true); await onGenerate(); setBusy(false); }}
          className="glass-btn-active px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          Gerar lista da semana
        </button>
      </div>
    );
  }

  const locked = list.status === "done";
  const done = items.filter((i) => i.checked);
  const total = Math.round(done.reduce((s, i) => s + (i.price ?? 0), 0) * 100) / 100;
  const pct = list.budget > 0 ? Math.round((total / list.budget) * 100) : 0;
  const colors = progressColors(pct);
  const pending = items.length - done.length;

  const groupKeys = [
    ...Object.keys(SHOP_CATEGORIES),
    ...Array.from(new Set(items.map((i) => i.category))).filter((k) => !(k in SHOP_CATEGORIES)),
  ].filter((k) => items.some((i) => i.category === k));

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-upper">{locked ? "Total da compra" : "Gasto da semana"}</p>
            <p className="text-2xl font-bold">{formatCurrency(locked ? list.total ?? total : total)}</p>
          </div>
          <div className="text-right">
            <p className="label-upper">Orçamento</p>
            <button disabled={locked}
              onClick={() => { setBudgetText(priceToText(list.budget)); setShowBudget(true); }}
              className="glass-btn px-3 py-1.5 text-xs mt-1 disabled:opacity-70">
              {formatCurrency(list.budget)}{!locked && " ✎"}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/40">
          {done.length} de {items.length} itens comprados · {pct}% do orçamento
        </p>
        <div className="w-full h-2 rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        {locked && (
          <p className="text-xs text-green-400">Compra finalizada — despesa lançada em Transações.</p>
        )}
      </div>

      {/* Itens por categoria */}
      {items.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-6">Lista vazia. Adicione itens avulsos ou cadastre itens fixos.</p>
      ) : (
        groupKeys.map((k) => {
          const c = shopCat(k);
          return (
            <div key={k}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="label-upper">{c.label}</span>
              </div>
              <div className="glass-card px-4 py-1">
                {items.filter((i) => i.category === k).map((i) => (
                  <Row key={i.id} item={i} locked={locked} onSave={onSaveItem} onRemove={onRemoveItem} />
                ))}
              </div>
            </div>
          );
        })
      )}

      {inStock.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="label-upper">Em estoque (ainda não precisa)</span>
          </div>
          <div className="glass-card px-4 py-1">
            {inStock
              .map((f) => ({ f, st: stockStatus(f, weekStartForStock) }))
              .sort((a, b) => (a.st.daysLeft ?? 9999) - (b.st.daysLeft ?? 9999))
              .map(({ f, st }) => (
                <div key={f.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.08] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{f.name}</p>
                    <p className="text-[11px] text-white/40">
                      {st.runsOut ? `Dura até ${shortDate(st.runsOut)} · ${st.hint?.toLowerCase()}` : st.hint}
                    </p>
                  </div>
                  {!locked && (
                    <button onClick={() => onAddFromStock(f)} className="glass-btn px-2.5 py-1.5 text-[11px]">
                      + Adicionar
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {!locked && (
        <button onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-white/20 text-white/45 hover:text-white rounded-2xl py-2.5 text-xs flex items-center justify-center gap-1.5">
          <Plus size={14} /> Item avulso nesta semana
        </button>
      )}

      {/* Barra fixa */}
      {!locked && (
        <div className="fixed left-0 right-0 bottom-20 md:bottom-4 z-30 flex justify-center px-3 pointer-events-none md:pl-64">
          <div className="glass w-full max-w-md p-3.5 space-y-2 pointer-events-auto" style={{ background: "rgba(22,33,62,.9)" }}>
            <div className="flex items-end justify-between">
              <div>
                <p className="label-upper">Total até agora</p>
                <p className="text-xl font-bold">{formatCurrency(total)}</p>
              </div>
              <div className="text-right">
                <p className="label-upper">Restante</p>
                <p className={`text-sm font-semibold ${pct > 100 ? "text-red-400" : ""}`}>
                  {formatCurrency(Math.max(list.budget - total, 0))}
                </p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10">
              <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <button onClick={() => setShowFinish(true)} disabled={done.length === 0}
              className="glass-btn-active w-full py-2.5 text-sm font-medium disabled:opacity-40">
              Finalizar compra
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <ItemFormModal title="Item avulso" showSaveAsFixed
          onClose={() => setShowAdd(false)}
          onSubmit={(v) => { onAddAvulso(v); setShowAdd(false); }} />
      )}

      {showBudget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBudget(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Orçamento semanal</h2>
              <button onClick={() => setShowBudget(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <input type="text" inputMode="decimal" value={budgetText} autoFocus
              onChange={(e) => setBudgetText(e.target.value)} className="glass-input w-full px-3 py-2 text-sm text-white"
              onKeyDown={(e) => { if (e.key === "Enter") { onBudget(parsePrice(budgetText)); setShowBudget(false); } }} />
            <button className="glass-btn-active w-full py-2.5 text-sm font-medium"
              onClick={() => { onBudget(parsePrice(budgetText)); setShowBudget(false); }}>Salvar</button>
          </div>
        </div>
      )}

      {showFinish && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !busy && setShowFinish(false)}>
          <div className="glass w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold">Finalizar compra da semana</h2>
            <p className="text-xs text-white/50">Será lançada <b className="text-white">1 despesa</b> em Transações:</p>
            <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            <p className="text-xs text-white/40">Seg {shortDate(weekStart)} · {done.length} itens</p>
            <div>
              <label className="label-upper mb-1 block">Categoria da despesa</label>
              <select value={finishCat} onChange={(e) => setFinishCat(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm" style={{ background: "#1E293B", color: "white" }}>
                {expenseCategories.map((c) => (
                  <option key={c.name} value={c.name} style={{ background: "#1E293B", color: "white" }}>{c.label}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-white/40">
              {pending > 0 ? `${pending} item(ns) não comprado(s): os avulsos vão para a próxima lista, os fixos já entram toda semana.` : "Todos os itens foram comprados."}
            </p>
            <div className="flex gap-3 pt-1">
              <button disabled={busy} onClick={() => setShowFinish(false)} className="glass-btn flex-1 py-2.5 text-sm">Cancelar</button>
              <button disabled={busy} className="glass-btn-active flex-1 py-2.5 text-sm font-medium disabled:opacity-50"
                onClick={async () => { setBusy(true); await onFinish(finishCat); setBusy(false); setShowFinish(false); }}>
                Lançar despesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
