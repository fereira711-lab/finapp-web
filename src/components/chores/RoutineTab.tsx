"use client";

import { WEEKDAY_CHIPS, WEEKDAY_ORDER, normTime, type Routine } from "@/lib/chores";

type Field = "work" | "other" | "avail";

interface Props {
  routine: Routine;
  onChange: (weekday: number, field: Field, index: 0 | 1, value: string) => void;
  onCopyMonday: () => void;
}

function TimeInput({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
  return (
    <input
      key={value} defaultValue={value} placeholder="--:--" inputMode="numeric" aria-label={label}
      onBlur={(e) => {
        const t = normTime(e.target.value);
        e.target.value = t; // texto invalido volta para vazio
        if (t !== value) onCommit(t);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="glass-input w-full min-w-0 px-0.5 py-1.5 text-[11px] text-center text-white"
    />
  );
}

export default function RoutineTab({ routine, onChange, onCopyMonday }: Props) {
  const pair = (d: number, f: Field, name: string) => (
    <div className="flex items-center gap-0.5">
      <TimeInput value={routine[d][f][0]} label={`${name} início`} onCommit={(v) => onChange(d, f, 0, v)} />
      <span className="text-white/40 text-[10px]">–</span>
      <TimeInput value={routine[d][f][1]} label={`${name} fim`} onCommit={(v) => onChange(d, f, 1, v)} />
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 leading-relaxed">
        Preencha seus horários. As tarefas <b className="text-indigo-300">automáticas</b> só entram nos horários{" "}
        <b>livres</b> (fora do trabalho e dos compromissos) e são divididas em blocos. Deixe em branco o que não existe naquele dia.
      </p>
      <div className="glass-card p-3.5">
        <div className="grid gap-2 mb-1.5" style={{ gridTemplateColumns: "34px 1fr 1fr 1fr" }}>
          <span />
          {["Trabalho", "Outro compromisso", "Livre p/ tarefas"].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-white/45 text-center leading-tight">{h}</span>
          ))}
        </div>
        {WEEKDAY_ORDER.map((d) => (
          <div key={d} className="grid gap-2 items-center py-2 border-b border-white/[0.08] last:border-0"
            style={{ gridTemplateColumns: "34px 1fr 1fr 1fr" }}>
            <b className="text-xs font-semibold">{WEEKDAY_CHIPS.find(([, v]) => v === d)?.[0]}</b>
            {pair(d, "work", "Trabalho")}
            {pair(d, "other", "Compromisso")}
            {pair(d, "avail", "Livre")}
          </div>
        ))}
        <button onClick={onCopyMonday} className="glass-btn w-full mt-3 py-2.5 text-xs">Copiar Segunda → Seg a Sex</button>
      </div>
      <p className="text-[11px] text-white/35 leading-relaxed">
        Dica: marque como &quot;livre&quot; só o horário em que você realmente quer fazer tarefas de casa (ex.: 06:00–22:00 ou 18:00–21:00).
      </p>
    </div>
  );
}
