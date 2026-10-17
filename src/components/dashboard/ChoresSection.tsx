"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  WEEKDAY_FULL, dowOf, fmtMin, makePlanner, overdueFixed, rowsToRoutine,
  type ChoreLog, type ChoreTask, type RoutineRow,
} from "@/lib/chores";
import { addDays, shortDate, todayStr } from "@/lib/shopping";

/** Casa: dois cards proprios (Hoje e Atrasadas/Semana), separados dos cards financeiros. */
export default function ChoresSection() {
  const [tasks, setTasks] = useState<ChoreTask[]>([]);
  const [routineRows, setRoutineRows] = useState<RoutineRow[]>([]);
  const [logs, setLogs] = useState<ChoreLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const today = todayStr();

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const from = addDays(today, -14);
      const to = addDays(today, 7);
      const [t, r, l] = await Promise.all([
        supabase.from("chore_tasks").select("*").eq("user_id", user.id).order("position", { ascending: true, nullsFirst: false }),
        supabase.from("chore_routine").select("*").eq("user_id", user.id),
        supabase.from("chore_logs").select("*").eq("user_id", user.id).gte("log_date", from).lte("log_date", to),
      ]);
      if (t.error || r.error || l.error) return;
      setTasks((t.data || []) as ChoreTask[]);
      setRoutineRows((r.data || []) as RoutineRow[]);
      setLogs((l.data || []) as ChoreLog[]);
    } finally {
      setLoaded(true);
    }
  }, [today]);

  useEffect(() => {
    load();
    window.addEventListener("finapp:chores-changed", load);
    return () => window.removeEventListener("finapp:chores-changed", load);
  }, [load]);

  const planner = useMemo(() => {
    const now = new Date();
    return makePlanner(tasks, rowsToRoutine(routineRows), logs, today, now.getHours() * 60 + now.getMinutes());
  }, [tasks, routineRows, logs, today]);

  if (!loaded) return null;

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45 flex items-center gap-1.5">
        <ClipboardCheck size={14} /> Casa
      </h2>
      <Link href="/chores" className="text-[10px] text-[#6366F1] hover:underline">Abrir Casa</Link>
    </div>
  );

  if (tasks.length === 0) {
    return (
      <section className="space-y-3">
        {header}
        <div className="glass-card p-4 text-xs text-white/45">
          Nenhuma tarefa da casa cadastrada ainda.{" "}
          <Link href="/chores" className="text-[#6366F1] hover:underline">Montar minha rotina</Link>
        </div>
      </section>
    );
  }

  // ---- Hoje ----
  const todayList = planner.entries(today);
  const doneToday = todayList.filter((e) => planner.isDone(e, today)).length;
  const planToday = todayList.reduce((s, e) => s + e.mins, 0);

  // ---- Atrasadas ----
  const overdue = overdueFixed(tasks, logs, today, 14);

  // ---- Proximos dias (3 proximos com tarefa) ----
  const upcoming: { date: string; count: number; mins: number }[] = [];
  for (let i = 1; i <= 7 && upcoming.length < 3; i++) {
    const ds = addDays(today, i);
    const list = planner.entries(ds);
    if (list.length) upcoming.push({ date: ds, count: list.length, mins: list.reduce((s, e) => s + e.mins, 0) });
  }
  // horas planejadas na semana (seg-dom)
  const monday = addDays(today, -((dowOf(today) + 6) % 7));
  let weekPlan = 0;
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(monday, i);
    planner.entries(ds).forEach((e) => {
      weekPlan += e.mins;
      const log = planner.isDone(e, ds);
      if (log) weekDone += log.real_min || e.mins;
    });
  }

  return (
    <section className="space-y-3">
      {header}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Hoje</h3>
            <span className="text-[10px] text-white/30">
              {todayList.length > 0 ? `${doneToday}/${todayList.length} feitas · ${fmtMin(planToday)}` : "dia livre"}
            </span>
          </div>
          {todayList.length === 0 ? (
            <p className="text-xs text-white/30">Nenhuma tarefa para hoje 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {todayList.map((e) => {
                const log = planner.isDone(e, today);
                return (
                  <div key={e.key} className="flex items-center gap-2 text-xs">
                    {log ? <CheckCircle2 size={14} className="text-green-400 shrink-0" /> : <Circle size={14} className="text-white/30 shrink-0" />}
                    <span className="w-1 h-4 rounded shrink-0" style={{ background: e.color, opacity: e.auto ? 0.55 : 1 }} />
                    <span className={`flex-1 truncate ${log ? "line-through text-white/40" : ""}`}>{e.name}</span>
                    <span className="text-white/30 shrink-0">{e.start} · {fmtMin(e.mins)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Atrasadas e semana</h3>
            <span className="text-[10px] text-white/30">{fmtMin(weekDone)} de {fmtMin(weekPlan)} na semana</span>
          </div>
          {overdue.length > 0 ? (
            <div className="space-y-1 mb-3">
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> {overdue.length} {overdue.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
              </p>
              {overdue.slice(-3).reverse().map((o) => (
                <p key={`${o.entry.key}-${o.date}`} className="text-xs text-white/60 truncate">
                  {o.entry.name} <span className="text-white/30">· {WEEKDAY_FULL[dowOf(o.date)]} {shortDate(o.date)}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-green-400 mb-3">Nada atrasado 👏</p>
          )}
          <div className="pt-2 border-t border-white/10">
            <p className="label-upper mb-1.5">Próximos dias</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-white/30">Sem tarefas nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-1">
                {upcoming.map((u) => (
                  <div key={u.date} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-white/60">{WEEKDAY_FULL[dowOf(u.date)]} {shortDate(u.date)}</span>
                    <span className="text-white/30">{u.count} {u.count === 1 ? "tarefa" : "tarefas"} · {fmtMin(u.mins)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
