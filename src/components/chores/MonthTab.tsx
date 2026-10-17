"use client";

import { AlertTriangle } from "lucide-react";
import {
  fmtMin, monthDates, weekKey, type Planner,
} from "@/lib/chores";
import { addDays, shortDate } from "@/lib/shopping";

interface Props {
  year: number;
  month: number;
  today: string;
  planner: Planner;
  selected: string;
  needsRoutine: boolean;
  onSelect: (ds: string) => void;
  onGoRoutine: () => void;
}

export default function MonthTab({ year, month, today, planner, selected, needsRoutine, onSelect, onGoRoutine }: Props) {
  const dates = monthDates(year, month);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // seg = 0

  let plan = 0, total = 0, done = 0, realDone = 0;
  const days = dates.map((ds) => {
    const list = planner.entries(ds);
    const dayPlan = list.reduce((s, e) => s + e.mins, 0);
    let doneN = 0;
    list.forEach((e) => {
      total++; plan += e.mins;
      const log = planner.isDone(e, ds);
      if (log) { done++; doneN++; realDone += log.real_min || e.mins; }
    });
    return {
      ds, list, plan: dayPlan,
      late: ds < today && doneN < list.length,
      all: list.length > 0 && doneN === list.length,
    };
  });

  const weeks: { k: string; plan: number }[] = [];
  days.forEach((d) => {
    const k = weekKey(d.ds);
    const w = weeks.find((x) => x.k === k);
    if (w) w.plan += d.plan; else weeks.push({ k, plan: d.plan });
  });
  const maxWeek = Math.max(...weeks.map((w) => w.plan), 1);

  const missing = weeks.flatMap((w) => {
    const u = planner.week(w.k).unplaced;
    if (u.length === 0) return [];
    const by: Record<string, number> = {};
    u.forEach((x) => { by[x.task.name] = (by[x.task.name] || 0) + x.mins; });
    return [`${shortDate(w.k)}–${shortDate(addDays(w.k, 6))}: faltou espaço para ${
      Object.entries(by).map(([n, m]) => `${n} (${fmtMin(m)})`).join(", ")}`];
  });

  return (
    <div className="space-y-4">
      {needsRoutine && (
        <button onClick={onGoRoutine} className="glass-card w-full text-left px-3 py-2.5 border border-indigo-400/30">
          <p className="text-xs font-semibold text-indigo-300">Preencha &quot;Minha rotina&quot;</p>
          <p className="text-[11px] text-white/50 mt-0.5">
            Informe seu horário de trabalho para as tarefas automáticas respeitarem os seus horários livres.
          </p>
        </button>
      )}

      <div className="glass-card p-3.5">
        <div className="grid grid-cols-7 gap-1 mb-1 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <span key={d} className="text-[10px] font-semibold uppercase text-white/45">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const lvl = d.plan >= 360 ? 3 : d.plan >= 180 ? 2 : d.plan > 0 ? 1 : 0;
            const tint = ["rgba(255,255,255,.03)", "rgba(99,102,241,.12)", "rgba(99,102,241,.25)", "rgba(99,102,241,.42)"][lvl];
            const colors = Array.from(new Set(d.list.map((e) => e.color))).slice(0, 4);
            return (
              <button
                key={d.ds}
                onClick={() => onSelect(d.ds)}
                aria-label={`Dia ${Number(d.ds.slice(8))}`}
                className="relative rounded-xl flex flex-col items-center justify-between py-1.5 px-0.5 text-white"
                style={{
                  aspectRatio: "1 / 1.12", background: tint,
                  border: d.ds === today ? "1px solid #fff" : "1px solid transparent",
                  outline: d.ds === selected ? "2px solid #6366F1" : "none", outlineOffset: 1,
                }}
              >
                <span className="text-xs font-semibold">
                  {Number(d.ds.slice(8))}{d.all && <span className="text-green-400 text-[10px]"> ✓</span>}
                </span>
                <span className="flex gap-0.5 h-1.5">
                  {colors.map((c) => <i key={c} className="block w-[5px] h-[5px] rounded-full" style={{ background: c }} />)}
                </span>
                <span className="text-[9px] text-white/45 h-[11px]">{d.plan ? fmtMin(d.plan) : ""}</span>
                {d.late && <span className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full bg-red-400" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-white/45">
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: "rgba(99,102,241,.4)" }} />Mais cheio = mais horas</span>
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full bg-red-400" />Ficou atrasada</span>
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full bg-green-400" />Tudo feito</span>
        </div>
      </div>

      <p className="text-center text-xs text-white/40">Toque em um dia para ver as tarefas dele.</p>

      <div className="glass-card p-3.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-upper">Feito no mês</p>
            <p className="text-[22px] font-bold">{done} de {total}</p>
          </div>
          <div className="text-right">
            <p className="label-upper">Tempo planejado</p>
            <p className="text-lg font-bold">{fmtMin(plan)}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-2.5">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: total ? `${Math.round((done / total) * 100)}%` : "0%" }} />
        </div>
        <p className="text-[11px] text-white/45 mt-1.5">
          {total ? Math.round((done / total) * 100) : 0}% das tarefas · {fmtMin(realDone)} de trabalho real até agora
        </p>

        <p className="label-upper mt-3.5">Horas por semana</p>
        {weeks.map((w) => (
          <div key={w.k} className="flex items-center gap-2 text-[11px] mt-2">
            <span className="w-[78px] shrink-0 text-white/45">{shortDate(w.k)}–{shortDate(addDays(w.k, 6))}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${(w.plan / maxWeek) * 100}%` }} />
            </div>
            <b className="w-[54px] text-right font-semibold">{fmtMin(w.plan)}</b>
          </div>
        ))}

        {missing.length > 0 && (
          <div className="mt-3 text-[11px] text-amber-400 leading-relaxed">
            {missing.map((m) => (
              <p key={m} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{m}</p>
            ))}
            <p className="text-white/45 mt-1">Abra mais horário livre em &quot;Minha rotina&quot; ou reduza a tarefa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
