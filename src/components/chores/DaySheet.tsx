"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  MONTH_NAMES, WEEKDAY_FULL, dowOf, fmtMin, fromMin, toMin,
  type Entry, type Planner, type Routine,
} from "@/lib/chores";

interface Props {
  date: string;
  today: string;
  planner: Planner;
  routine: Routine;
  onClose: () => void;
  onToggle: (entry: Entry, date: string, done: boolean) => void;
  onReal: (entry: Entry, date: string, mins: number) => void;
}

export default function DaySheet({ date, today, planner, routine, onClose, onToggle, onReal }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dow = dowOf(date);
  const [, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAY_FULL[dow].replace(/^./, (c) => c.toUpperCase());
  const list = planner.entries(date);
  const plan = list.reduce((s, e) => s + e.mins, 0);
  const free = planner.freeMinutes(date);
  const blocks = planner.blocked(date);
  const r = routine[dow];
  const routineParts: string[] = [];
  if (r.work[0] && r.work[1]) routineParts.push(`Trabalho ${r.work[0]}–${r.work[1]}`);
  if (r.other[0] && r.other[1]) routineParts.push(`Compromisso ${r.other[0]}–${r.other[1]}`);

  let realTotal = 0;
  let prevEnd = -1;

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[3px] flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        role="dialog" aria-label={`Tarefas de ${d} de ${MONTH_NAMES[m - 1]}`}
        className="w-full max-w-md max-h-[82vh] overflow-y-auto rounded-t-[22px] md:rounded-[22px] border border-white/20 px-4 pt-2.5 pb-7"
        style={{ background: "rgba(28,30,58,.98)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[38px] h-1 rounded-full bg-white/25 mx-auto mb-3 md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold">
              {weekday}, {d} de {MONTH_NAMES[m - 1]}{date === today ? " · hoje" : ""}
            </h2>
            <p className="text-xs text-white/45 mt-1 leading-snug">
              {plan > 0 && <>{fmtMin(plan)} planejadas<br /></>}
              {free > 0 ? `${fmtMin(free)} livres` : "sem horário livre"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        {routineParts.length > 0 && (
          <p className="text-[11px] text-white/45 mt-2 pb-2 border-b border-white/[0.08]">🕘 {routineParts.join(" · ")}</p>
        )}

        {list.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-6">Dia livre 🎉</p>
        ) : (
          <div>
            {list.map((e) => {
              const log = planner.isDone(e, date);
              const a = toMin(e.start);
              const b = a + e.mins;
              const overlap = a < prevEnd;
              prevEnd = Math.max(prevEnd, b);
              const inWork = !e.auto && blocks.some((x) => a < x.b && b > x.a);
              const late = date < today && !log;
              const real = log ? (log.real_min || e.mins) : 0;
              realTotal += real;
              return (
                <div key={e.key} className="flex items-start gap-2.5 py-3 border-b border-white/[0.08] last:border-0">
                  <span
                    className="w-1 self-stretch rounded shrink-0"
                    style={{ background: e.color, opacity: e.auto ? 0.55 : 1 }}
                  />
                  <input
                    type="checkbox" checked={Boolean(log)} aria-label={`Marcar ${e.name} como feita`}
                    onChange={(ev) => onToggle(e, date, ev.target.checked)}
                    className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${log ? "line-through text-white/40" : ""}`}>
                      {e.name}
                      {e.auto && (
                        <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-indigo-300 border border-indigo-300/40 rounded-full px-1.5 py-px">auto</span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/45 mt-0.5">
                      {e.start}–{fromMin(b)} · {fmtMin(e.mins)}
                      {e.auto && !log && <span className="text-indigo-300"> · encaixada no seu horário livre</span>}
                      {late && <span className="text-red-400"> · atrasada</span>}
                      {overlap && <span className="text-amber-400"> · ⚠ sobrepõe outra tarefa</span>}
                      {inWork && <span className="text-amber-400"> · ⚠ cai no seu trabalho/compromisso</span>}
                    </p>
                    {log && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-white/45">
                        Levou
                        <input
                          key={`${e.key}-${real}`}
                          type="number" min={5} step={5} defaultValue={real} aria-label="Minutos que levou"
                          onBlur={(ev) => {
                            const v = Math.max(5, Math.round(Number(ev.target.value)) || e.mins);
                            if (v !== real) onReal(e, date, v);
                          }}
                          className="glass-input w-[62px] px-1.5 py-1 text-xs text-right text-white"
                        />
                        min
                        <span>
                          {real !== e.mins ? `(${real > e.mins ? "+" : ""}${real - e.mins} min vs. plano)` : "(como planejado)"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {realTotal > 0 && (
              <p className="text-[11px] text-white/45 pt-2.5">Feito neste dia: {fmtMin(realTotal)} de {fmtMin(plan)} planejadas</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
