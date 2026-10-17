"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUpDown, Check, RotateCcw } from "lucide-react";
import { useBillAlerts } from "@/lib/useBillAlerts";
import { useStockAlerts } from "@/lib/useStockAlerts";
import { useChoreAlerts } from "@/lib/useChoreAlerts";
import { applyNavOrder, useNavOrder } from "@/lib/useNavOrder";
import { NAV_ITEMS, type NavItem } from "@/lib/navItems";

function SortableNavRow({ item }: { item: NavItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href });
  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 bg-white/5 border border-white/10"
      style={{
        transform: CSS.Transform.toString(transform), transition, position: "relative",
        zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.85 : 1,
      }}
    >
      <button
        type="button" {...attributes} {...listeners} aria-label={`Arrastar ${item.label}`}
        className="-ml-1.5 p-1 rounded-lg text-white/40 hover:text-white cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={16} />
      </button>
      <item.icon size={18} strokeWidth={1.8} />
      <span className="flex-1">{item.label}</span>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { totalAlerts } = useBillAlerts();
  const stock = useStockAlerts();
  const chores = useChoreAlerts();
  const { order, save } = useNavOrder();
  const [editing, setEditing] = useState(false);

  const items = applyNavOrder(NAV_ITEMS, order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const hrefs = items.map((i) => i.href);
    save(arrayMove(hrefs, hrefs.indexOf(String(active.id)), hrefs.indexOf(String(over.id))));
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 glass-nav h-screen fixed left-0 top-0 z-40"
      style={{ borderTop: "none", borderRight: "1px solid var(--glass-border)", borderRadius: 0 }}
    >
      <div className="p-6">
        <h1 className="text-xl font-bold text-[#6366F1]">FinApp</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {editing ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.href)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {items.map((item) => <SortableNavRow key={item.href} item={item} />)}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          items.map((item) => {
            const active = pathname === item.href;
            const isStock = item.href === "/shopping";
            const badgeCount = item.href === "/bills" ? totalAlerts
              : isStock ? stock.count
              : item.href === "/chores" ? chores.count : 0;
            const showBadge = badgeCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  active
                    ? "glass-btn-active text-white font-medium"
                    : "text-white/45 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span
                    title={isStock ? "Itens acabando" : item.href === "/chores" ? "Tarefas atrasadas" : undefined}
                    className={`min-w-[20px] h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1.5 ${
                      isStock ? "bg-amber-500" : "bg-red-500"
                    }`}
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </nav>

      <div className="p-3 space-y-1">
        {editing && order && (
          <button
            onClick={() => save(null)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs text-white/45 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={14} /> Voltar à ordem padrão
          </button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-colors ${
            editing ? "glass-btn-active text-white font-medium" : "text-white/45 hover:text-white hover:bg-white/5"
          }`}
        >
          {editing ? <><Check size={14} /> Concluir</> : <><ArrowUpDown size={14} /> Reordenar menu</>}
        </button>
      </div>
    </aside>
  );
}
