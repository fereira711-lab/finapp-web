"use client";

import { useState } from "react";
import { SHOP_CATEGORIES, parseDays, parsePrice, priceToText, todayStr } from "@/lib/shopping";
import { Sparkles, X } from "lucide-react";

export interface ItemFormValues {
  name: string; qty: string; category: string; estimated_price: number;
  duration_days: number | null; saveAsFixed: boolean;
  /** só preenchido no cadastro de item fixo (YYYY-MM-DD) */
  last_bought_at: string | null;
}

interface Props {
  title: string;
  initial?: Partial<ItemFormValues>;
  showSaveAsFixed?: boolean;
  /** mostra o campo "Última compra" (itens fixos) */
  showLastBought?: boolean;
  onSubmit: (v: ItemFormValues) => void;
  onClose: () => void;
}

export default function ItemFormModal({ title, initial, showSaveAsFixed, showLastBought, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [qty, setQty] = useState(initial?.qty || "1 un");
  const [category, setCategory] = useState(initial?.category || "mercearia");
  const [price, setPrice] = useState(priceToText(initial?.estimated_price ?? null));
  const [saveAsFixed, setSaveAsFixed] = useState(false);
  const [days, setDays] = useState(initial?.duration_days ? String(initial.duration_days) : "");
  const [lastBought, setLastBought] = useState(initial?.last_bought_at || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  async function suggest() {
    if (!name.trim() || aiBusy) return;
    setAiBusy(true); setAiMsg("");
    try {
      const res = await fetch("/api/shopping/suggest-duration", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, qty }),
      });
      const data = await res.json();
      if (!res.ok) { setAiMsg(data.error || "Erro ao consultar a IA"); }
      else { setDays(String(data.days)); setAiMsg(data.reason || ""); }
    } catch {
      setAiMsg("Erro de conexão com a IA");
    }
    setAiBusy(false);
  }

  function submit() {
    if (!name.trim()) return;
    const today = todayStr();
    onSubmit({
      name: name.trim(), qty: qty.trim() || "1 un", category,
      estimated_price: parsePrice(price), duration_days: parseDays(days), saveAsFixed,
      // data futura não faz sentido para "última compra"
      last_bought_at: lastBought ? (lastBought > today ? today : lastBought) : null,
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
            <label className="label-upper mb-1 block">Dura quantos dias? (opcional)</label>
            <div className="flex gap-2">
              <input type="text" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 30" className="glass-input flex-1 px-3 py-2 text-sm text-white" />
              <button type="button" onClick={suggest} disabled={aiBusy || !name.trim()}
                className="glass-btn px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Sparkles size={14} /> {aiBusy ? "Pensando..." : "Sugerir com IA"}
              </button>
            </div>
            {aiMsg && <p className="text-xs text-white/40 mt-1">{aiMsg}</p>}
            <p className="text-[11px] text-white/30 mt-1">Com duração, o item só entra na lista quando estiver acabando.</p>
          </div>
          {showLastBought && (
            <div>
              <label className="label-upper mb-1 block">Última compra (opcional)</label>
              <input type="date" value={lastBought} max={todayStr()} onChange={(e) => setLastBought(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm text-white" style={{ colorScheme: "dark" }} />
              <p className="text-[11px] text-white/30 mt-1">
                Quando comprou pela última vez? Com a data, o app já sabe quando acaba e avisa.
              </p>
            </div>
          )}
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
