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
import { shopCat, type ShoppingItem } from "@/lib/shopping";
import ItemFormModal from "./ItemFormModal";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

interface Props {
  items: ShoppingItem[];
  onSave: (data: { name: string; qty: string; category: string; estimated_price: number }, id?: string) => void;
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

export default function FixedTab({ items, onSave, onDelete, onReorder }: Props) {
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ShoppingItem | null>(null);
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
                          <p className="text-[11px] text-white/40">{c.label} · {it.qty}</p>
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
          onClose={() => { setCreating(false); setEditing(null); }}
          onSubmit={(v) => {
            onSave({ name: v.name, qty: v.qty, category: v.category, estimated_price: v.estimated_price }, editing?.id);
            setCreating(false); setEditing(null);
          }} />
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
