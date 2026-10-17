"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import MonthTab from "@/components/chores/MonthTab";
import TasksTab from "@/components/chores/TasksTab";
import RoutineTab from "@/components/chores/RoutineTab";
import DaySheet from "@/components/chores/DaySheet";
import {
  DEFAULT_TASKS, MONTH_NAMES, emptyRoutine, hasWorkHours, makePlanner, monthDates, rowsToRoutine,
  routineToRow, type ChoreLog, type ChoreTask, type Entry, type NewTask, type Routine, type RoutineRow,
} from "@/lib/chores";
import { addDays, todayStr } from "@/lib/shopping";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";

type Tab = "mes" | "tarefas" | "rotina";
const TABS: { key: Tab; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "tarefas", label: "Tarefas" },
  { key: "rotina", label: "Minha rotina" },
];

const notify = () => window.dispatchEvent(new Event("finapp:chores-changed"));

export default function ChoresPage() {
  const today = todayStr();
  const [tab, setTab] = useState<Tab>("mes");
  const [cur, setCur] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ChoreTask[]>([]);
  const [routine, setRoutine] = useState<Routine>(emptyRoutine());
  const [logs, setLogs] = useState<ChoreLog[]>([]);
  const [toast, setToast] = useState("");
  const seeded = useRef(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function getUserId() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // semanas inteiras que tocam o mes (o encaixe automatico trabalha por semana)
    const dates = monthDates(cur.y, cur.m);
    const from = addDays(dates[0], -7);
    const to = addDays(dates[dates.length - 1], 7);

    const [taskRes, routineRes, logRes] = await Promise.all([
      supabase.from("chore_tasks").select("*").eq("user_id", user.id)
        .order("position", { ascending: true, nullsFirst: false }).order("created_at"),
      supabase.from("chore_routine").select("*").eq("user_id", user.id),
      supabase.from("chore_logs").select("*").eq("user_id", user.id).gte("log_date", from).lte("log_date", to),
    ]);

    let taskRows = (taskRes.data || []) as ChoreTask[];
    let routineRows = (routineRes.data || []) as RoutineRow[];

    // primeira vez: modelos iniciais (tarefas sugeridas + janela livre padrao)
    if (!seeded.current && routineRows.length === 0 && !taskRes.error && !routineRes.error) {
      seeded.current = true;
      const base = emptyRoutine();
      const seedRoutine = Object.keys(base).map((d) => ({ ...routineToRow(Number(d), base[Number(d)]), user_id: user.id }));
      const { error: rErr } = await supabase.from("chore_routine").upsert(seedRoutine, { onConflict: "user_id,weekday" });
      if (!rErr && taskRows.length === 0) {
        const today0 = todayStr();
        const { data: created } = await supabase.from("chore_tasks").insert(
          DEFAULT_TASKS.map((t, i) => ({ ...t, user_id: user.id, position: i, starts_on: today0 })),
        ).select("*");
        taskRows = ((created || []) as ChoreTask[]).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      }
      if (!rErr) routineRows = seedRoutine as unknown as RoutineRow[];
    }

    setTasks(taskRows);
    setRoutine(rowsToRoutine(routineRows));
    setLogs((logRes.data || []) as ChoreLog[]);
    setLoading(false);
  }, [cur.y, cur.m]);

  useEffect(() => { load(); }, [load]);

  const planner = useMemo(() => {
    const now = new Date();
    return makePlanner(tasks, routine, logs, today, now.getHours() * 60 + now.getMinutes());
  }, [tasks, routine, logs, today]);

  // ---------- feito / tempo real ----------
  async function toggleDone(entry: Entry, date: string, done: boolean) {
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    const same = (l: ChoreLog) => l.task_id === entry.taskId && l.slot === entry.slot && l.log_date === date;

    if (!done) {
      setLogs((prev) => prev.filter((l) => !same(l)));
      const { error } = await supabase.from("chore_logs").delete()
        .eq("task_id", entry.taskId).eq("slot", entry.slot).eq("log_date", date);
      if (error) { showToast("Erro ao desmarcar"); load(); }
      notify();
      return;
    }

    const row = {
      user_id: uid, task_id: entry.taskId, slot: entry.slot, log_date: date,
      planned_start: entry.start, planned_min: entry.mins, real_min: entry.mins,
    };
    setLogs((prev) => [...prev.filter((l) => !same(l)), row]);
    const { error } = await supabase.from("chore_logs").upsert(row, { onConflict: "task_id,slot,log_date" });
    if (error) { showToast("Erro ao marcar como feita"); load(); }
    notify();
  }

  async function setReal(entry: Entry, date: string, mins: number) {
    setLogs((prev) => prev.map((l) =>
      l.task_id === entry.taskId && l.slot === entry.slot && l.log_date === date ? { ...l, real_min: mins } : l));
    const supabase = createClient();
    const { error } = await supabase.from("chore_logs").update({ real_min: mins })
      .eq("task_id", entry.taskId).eq("slot", entry.slot).eq("log_date", date);
    if (error) { showToast("Erro ao salvar o tempo"); load(); }
  }

  // ---------- tarefas ----------
  async function saveTask(data: NewTask, id?: string) {
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    if (id) {
      const old = tasks.find((t) => t.id === id);
      // mudou quando/quanto repete: vale daqui para frente (nao cria "atrasadas" no passado)
      const scheduleChanged = !old || old.mode !== data.mode
        || old.start_time !== data.start_time || old.duration_min !== data.duration_min
        || old.weekly_min !== data.weekly_min || old.block_min !== data.block_min
        || old.weekdays.join() !== data.weekdays.join() || old.month_days.join() !== data.month_days.join();
      const { error } = await supabase.from("chore_tasks")
        .update(scheduleChanged ? { ...data, starts_on: todayStr() } : data).eq("id", id);
      if (error) { showToast("Erro ao salvar a tarefa"); return; }
    } else {
      const { error } = await supabase.from("chore_tasks")
        .insert({ ...data, user_id: uid, position: tasks.length, starts_on: todayStr() });
      if (error) { showToast("Erro ao criar a tarefa"); return; }
    }
    await load();
    notify();
  }

  async function deleteTask(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("chore_tasks").delete().eq("id", id);
    if (error) { showToast("Erro ao apagar a tarefa"); return; }
    await load();
    notify();
  }

  // ---------- rotina ----------
  async function saveRoutineDays(next: Routine, weekdays: number[]) {
    setRoutine(next);
    const supabase = createClient();
    const uid = await getUserId();
    if (!uid) return;
    const rows = weekdays.map((d) => ({ ...routineToRow(d, next[d]), user_id: uid }));
    const { error } = await supabase.from("chore_routine").upsert(rows, { onConflict: "user_id,weekday" });
    if (error) { showToast("Erro ao salvar a rotina"); load(); }
  }

  function changeRoutine(weekday: number, field: "work" | "other" | "avail", index: 0 | 1, value: string) {
    const pair = [...routine[weekday][field]] as [string, string];
    pair[index] = value;
    saveRoutineDays({ ...routine, [weekday]: { ...routine[weekday], [field]: pair } }, [weekday]);
  }

  function copyMonday() {
    const src = routine[1];
    const next = { ...routine };
    [2, 3, 4, 5].forEach((d) => {
      next[d] = { work: [...src.work], other: [...src.other], avail: [...src.avail] };
    });
    saveRoutineDays(next, [2, 3, 4, 5]);
    showToast("Segunda copiada para Seg a Sex ✓");
  }

  // ---------- atrasadas do mes ----------
  const late = monthDates(cur.y, cur.m).flatMap((ds) =>
    ds < today ? planner.entries(ds).filter((e) => !planner.isDone(e, ds)).map((e) => ({ e, ds })) : []);

  function changeMonth(delta: number) {
    const d = new Date(cur.y, cur.m + delta, 1);
    setLoading(true);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
    const isNow = d.getFullYear() === new Date().getFullYear() && d.getMonth() === new Date().getMonth();
    setSelected(isNow ? today : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }

  function openDay(ds: string) {
    setSelected(ds);
    setSheetOpen(true);
  }

  return (
    <AppShell>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-4 pb-24">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-[#6366F1]" />
              <h1 className="text-lg font-bold">Casa</h1>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"><ChevronLeft size={16} /></button>
              <span className="font-bold min-w-[104px] text-center capitalize">{MONTH_NAMES[cur.m]} {cur.y}</span>
              <button onClick={() => changeMonth(1)} aria-label="Próximo mês"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>

          {late.length > 0 && (
            <div className="glass-card px-3 py-2.5 border border-amber-500/30">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={14} /> {late.length} {late.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
              </p>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                {late.map((x, i) => (
                  <span key={`${x.e.key}${x.ds}`}>
                    {i > 0 && " · "}
                    <button className="underline" onClick={() => openDay(x.ds)}>
                      {x.e.name} ({x.ds.slice(8)}/{x.ds.slice(5, 7)})
                    </button>
                  </span>
                ))}
              </p>
            </div>
          )}

          <div className="flex gap-1.5 glass-card p-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-[#6366F1]/30 text-white" : "text-white/45 hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mes" && (
            <MonthTab
              year={cur.y} month={cur.m} today={today} planner={planner} selected={selected}
              needsRoutine={!hasWorkHours(routine) && tasks.some((t) => t.mode === "auto")}
              onSelect={openDay} onGoRoutine={() => setTab("rotina")}
            />
          )}
          {tab === "tarefas" && <TasksTab tasks={tasks} onSave={saveTask} onDelete={deleteTask} />}
          {tab === "rotina" && <RoutineTab routine={routine} onChange={changeRoutine} onCopyMonday={copyMonday} />}

          {sheetOpen && (
            <DaySheet
              date={selected} today={today} planner={planner} routine={routine}
              onClose={() => setSheetOpen(false)} onToggle={toggleDone} onReal={setReal}
            />
          )}

          {toast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
              {toast}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
