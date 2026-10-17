"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency } from "@/lib/format";
import { shopCat, shortDate, stockStatus, type ShoppingItem } from "@/lib/shopping";
import ItemFormModal from "./ItemFormModal";
import { GripVertical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

interface LearnSuggestion {
  item_id: string; name: string; current: number | null; suggested: number; reason: string;
}

interface Props {
  items: ShoppingItem[];
  weekStart: string;
  onApplyDurations: (updates: { id: string; days: number }[]) => void;
  onSave: (data: { name: string; qty: string; category: string; estimated_price: number; duration_days: number | null; last_bought_at: string | null }, id?: string) => void;
  onDelete: (id: string) => void;
  onReorder: (next: ShoppingItem[]) => void;
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" {...attributes} {...listeners} aria-label="Arrastar para reordenar"
      className="p-1 -ml-1 rounded-lg text-white/30 hover:text-white cursor-grab active:cursor-grabbing touch-none">
      <GripVertical size={16} />
    </button>
  );
  return (
    <div ref={setNodeRef} className="glass-card px-3 py-2.5"
      style={{
        transform: CSS.Transform.toString(transform), transition, position: "relative",
        zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.85 : 1,
      }}>
      {children(handle)}
    </div>
  );
}

export default function FixedTab({ items, weekStart, onSave, onDelete, onReorder, onApplyDurations }: Props) {
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ShoppingItem | null>(null);
  const [learning, setLearning] = useState(false);
  const [learnMsg, setLearnMsg] = useState("");
  const [suggestions, setSuggestions] = useState<LearnSuggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function learn() {
    setLearning(true); setLearnMsg("");
    try {
      const res = await fetch("/api/shopping/learn", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setLearnMsg(data.error || "Erro ao consultar a IA"); }
      else if ((data.suggestions || []).length === 0) { setLearnMsg(data.note || "Nada para ajustar."); }
      else {
        setSuggestions(data.suggestions);
        setPicked(new Set((data.suggestions as LearnSuggestion[]).map((s) => s.item_id)));
      }
    } catch {
      setLearnMsg("Erro de conexão com a IA");
    }
    setLearning(false);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    ));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-white/40">
          Toda semana a lista nasce com estes itens.<br />Arraste para reordenar.
        </p>
        <button onClick={() => setCreating(true)} className="glass-btn flex items-center gap-1.5 px-3 py-2 text-xs shrink-0">
          <Plus size={14} /> Novo item
        </button>
      </div>

      {items.some((i) => i.duration_days) && (
        <div>
          <button onClick={learn} disabled={learning}
            className="glass-btn w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50">
            <Sparkles size={14} /> {learning ? "Analisando histórico..." : "Ajustar durações com meu histórico (IA)"}
          </button>
          {learnMsg && <p className="text-xs text-white/40 mt-1.5 text-center">{learnMsg}</p>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-10">Nenhum item fixo ainda</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((it) => {
                const c = shopCat(it.category);
                return (
                  <SortableRow key={it.id} id={it.id}>
                    {(handle) => (
                      <div className="flex items-center gap-3">
                        {handle}
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{it.name}</p>
                          <p className="text-[11px] text-white/40">
                            {c.label} · {it.qty}
                            {it.duration_days && ` · dura ${it.duration_days} dias`}
                          </p>
                          {it.duration_days && (() => {
                            const st = stockStatus(it, weekStart);
                            return st.hint && st.runsOut ? (
                              <p className={`text-[11px] ${st.due ? "text-yellow-400/90" : "text-white/30"}`}>
                                {st.hint} ({shortDate(st.runsOut)})
                              </p>
                            ) : null;
                          })()}
                        </div>
                        <span className="text-xs text-white/45">{formatCurrency(it.estimated_price)}</span>
                        <button onClick={() => setEditing(it)} aria-label="Editar"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><Pencil size={14} /></button>
                        <button onClick={() => setDeleting(it)} aria-label="Apagar"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </SortableRow>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {(creating || editing) && (
        <ItemFormModal
          title={editing ? "Editar item fixo" : "Novo item fixo"}
          initial={editing || undefined}
          showLastBought
          onClose={() => { setCreating(false); setEditing(null); }}
          onSubmit={(v) => {
            // sem duração não há o que acompanhar: não guarda data de compra
            onSave({
              name: v.name, qty: v.qty, category: v.category, estimated_price: v.estimated_price,
              duration_days: v.duration_days, last_bought_at: v.duration_days ? v.last_bought_at : null,
            }, editing?.id);
            setCreating(false); setEditing(null);
          }} />
      )}

      {suggestions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSuggestions(null)}>
          <div className="glass w-full max-w-sm p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold">Ajustes sugeridos pela IA</h2>
            <p className="text-xs text-white/40">Baseado no intervalo real entre as suas compras. Marque o que quer aplicar.</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <label key={s.item_id} className="glass-card px-3 py-2.5 flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={picked.has(s.item_id)}
                    onChange={() => setPicked((prev) => { const n = new Set(prev); n.has(s.item_id) ? n.delete(s.item_id) : n.add(s.item_id); return n; })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{s.name}: {s.current ? `${s.current} → ` : ""}<b>{s.suggested} dias</b></p>
                    {s.reason && <p className="text-[11px] text-white/40">{s.reason}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSuggestions(null)} className="glass-btn flex-1 py-2.5 text-sm">Cancelar</button>
              <button disabled={picked.size === 0} className="glass-btn-active flex-1 py-2.5 text-sm font-medium disabled:opacity-40"
                onClick={() => {
                  onApplyDurations(suggestions.filter((s) => picked.has(s.item_id)).map((s) => ({ id: s.item_id, days: s.suggested })));
                  setSuggestions(null);
                }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm">Remover <b>{deleting.name}</b> dos itens fixos? As listas já criadas não mudam.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="glass-btn flex-1 py-2 text-sm">Cancelar</button>
              <button onClick={() => { onDelete(deleting.id); setDeleting(null); }}
                className="flex-1 py-2 text-sm rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
