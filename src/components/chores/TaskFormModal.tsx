"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TASK_COLORS, WEEKDAY_CHIPS, type ChoreTask, type NewTask } from "@/lib/chores";

interface Props {
  initial?: ChoreTask | null;
  onSave: (data: NewTask, id?: string) => void;
  onClose: () => void;
}

export default function TaskFormModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [mode, setMode] = useState<"fixed" | "auto">(initial?.mode || "fixed");
  const [days, setDays] = useState<Set<number>>(new Set(initial?.weekdays || []));
  const [dates, setDates] = useState((initial?.month_days || []).join(", "));
  const [start, setStart] = useState(initial?.start_time || "07:00");
  const [mins, setMins] = useState(String(initial?.mode === "fixed" ? initial.duration_min : 60));
  const [weekly, setWeekly] = useState(String(initial?.weekly_min || 90));
  const [block, setBlock] = useState(String(initial?.block_min || 45));
  const [color, setColor] = useState(initial?.color || TASK_COLORS[0]);
  const [error, setError] = useState("");

  const weeklyN = Math.max(0, Math.round(Number(weekly)) || 0);
  const blockN = Math.max(1, Math.round(Number(block)) || 1);

  function submit() {
    if (!name.trim()) { setError("Dê um nome para a tarefa."); return; }
    if (mode === "auto") {
      if (weeklyN < 5) { setError("Informe o tempo por semana (mínimo 5 min)."); return; }
      const b = Math.min(weeklyN, Math.max(5, blockN));
      onSave({
        name: name.trim(), color, mode: "auto", weekdays: [], month_days: [], start_time: null,
        duration_min: weeklyN, weekly_min: weeklyN, block_min: b,
      }, initial?.id);
      return;
    }
    const monthDays = Array.from(new Set(
      dates.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31),
    )).sort((a, b) => a - b);
    if (days.size === 0 && monthDays.length === 0) { setError("Escolha ao menos um dia da semana ou uma data do mês."); return; }
    onSave({
      name: name.trim(), color, mode: "fixed", weekdays: Array.from(days).sort((a, b) => a - b),
      month_days: monthDays, start_time: /^\d{2}:\d{2}$/.test(start) ? start : "07:00",
      duration_min: Math.max(5, Math.round(Number(mins)) || 60), weekly_min: null, block_min: null,
    }, initial?.id);
  }

  const chip = (on: boolean) =>
    `flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-colors ${
      on ? "bg-[#6366F1]/35 text-white border-[#6366F1]" : "bg-white/5 text-white/45 border-white/20 hover:text-white"}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass w-full max-w-sm p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{initial ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <div>
          <label className="label-upper mb-1 block">Tarefa</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Lavar roupa"
            className="glass-input w-full px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label className="label-upper mb-1 block">Como encaixar?</label>
          <div className="flex gap-1.5">
            <button type="button" className={chip(mode === "fixed")} onClick={() => setMode("fixed")}>Dia e hora fixos</button>
            <button type="button" className={chip(mode === "auto")} onClick={() => setMode("auto")}>Automática</button>
          </div>
        </div>

        {mode === "fixed" ? (
          <>
            <div>
              <label className="label-upper mb-1 block">Dias da semana</label>
              <div className="flex gap-1">
                {WEEKDAY_CHIPS.map(([label, v]) => (
                  <button key={v} type="button" className={chip(days.has(v))}
                    onClick={() => setDays((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label-upper mb-1 block">Datas do mês (opcional)</label>
              <input type="text" value={dates} onChange={(e) => setDates(e.target.value)} placeholder="Ex: 5, 20"
                className="glass-input w-full px-3 py-2 text-sm text-white" />
              <p className="text-[11px] text-white/30 mt-1">Use para faxina geral e coisas que não são toda semana.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper mb-1 block">Começa às</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm text-white" style={{ colorScheme: "dark" }} />
              </div>
              <div>
                <label className="label-upper mb-1 block">Dura (minutos)</label>
                <input type="text" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ""))}
                  className="glass-input w-full px-3 py-2 text-sm text-white" />
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper mb-1 block">Tempo por semana (min)</label>
                <input type="text" inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/\D/g, ""))}
                  className="glass-input w-full px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="label-upper mb-1 block">Bloco máximo (min)</label>
                <input type="text" inputMode="numeric" value={block} onChange={(e) => setBlock(e.target.value.replace(/\D/g, ""))}
                  className="glass-input w-full px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-1">
              Serão {weeklyN > 0 ? Math.ceil(weeklyN / Math.max(5, blockN)) : 0} bloco(s) por semana, em dias diferentes, nos seus horários livres.
            </p>
          </div>
        )}

        <div>
          <label className="label-upper mb-1 block">Cor</label>
          <div className="flex gap-2">
            {TASK_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
                className="w-[26px] h-[26px] rounded-full border-2"
                style={{ background: c, borderColor: color === c ? "#fff" : "transparent" }} />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={submit} className="glass-btn-active w-full py-2.5 text-sm font-medium">Salvar</button>
      </div>
    </div>
  );
}
