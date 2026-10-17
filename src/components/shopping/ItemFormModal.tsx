"use client";

import { useState } from "react";
import { SHOP_CATEGORIES, parsePrice, priceToText } from "@/lib/shopping";
import { X } from "lucide-react";

export interface ItemFormValues {
  name: string; qty: string; category: string; estimated_price: number; saveAsFixed: boolean;
}

interface Props {
  title: string;
  initial?: Partial<ItemFormValues>;
  showSaveAsFixed?: boolean;
  onSubmit: (v: ItemFormValues) => void;
  onClose: () => void;
}

export default function ItemFormModal({ title, initial, showSaveAsFixed, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [qty, setQty] = useState(initial?.qty || "1 un");
  const [category, setCategory] = useState(initial?.category || "mercearia");
  const [price, setPrice] = useState(priceToText(initial?.estimated_price ?? null));
  const [saveAsFixed, setSaveAsFixed] = useState(false);

  function submit() {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(), qty: qty.trim() || "1 un", category,
      estimated_price: parsePrice(price), saveAsFixed,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label-upper mb-1 block">Item</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              placeholder="Ex: Arroz" className="glass-input w-full px-3 py-2 text-sm text-white"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-upper mb-1 block">Quantidade</label>
              <input type="text" value={qty} onChange={(e) => setQty(e.target.value)}
                placeholder="2 kg" className="glass-input w-full px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="label-upper mb-1 block">Preço est. (R$)</label>
              <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00" className="glass-input w-full px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="label-upper mb-1 block">Categoria do mercado</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm" style={{ background: "#1E293B", color: "white" }}>
              {Object.entries(SHOP_CATEGORIES).map(([k, c]) => (
                <option key={k} value={k} style={{ background: "#1E293B", color: "white" }}>{c.label}</option>
              ))}
            </select>
          </div>
          {showSaveAsFixed && (
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={saveAsFixed} onChange={(e) => setSaveAsFixed(e.target.checked)} />
              Salvar também como item fixo (entra toda semana)
            </label>
          )}
        </div>

        <button onClick={submit} className="glass-btn-active w-full py-2.5 text-sm font-medium">Salvar</button>
      </div>
    </div>
  );
}
