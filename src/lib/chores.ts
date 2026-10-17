// Tela "Casa": tarefas fixas ou automaticas, rotina pessoal e registro do que foi feito.
// Toda a logica de calendario/encaixe fica aqui (sem acesso ao banco) para ser reaproveitada
// pela pagina e pelo aviso de tarefas atrasadas.
import { addDays, mondayOf, todayStr } from "@/lib/shopping";

export interface ChoreTask {
  id: string;
  name: string;
  color: string;
  mode: "fixed" | "auto";
  weekdays: number[]; // 0=dom ... 6=sab
  month_days: number[];
  start_time: string | null; // "HH:MM"
  duration_min: number;
  weekly_min: number | null;
  block_min: number | null;
  starts_on: string;
  position: number | null;
}

/** [de, ate] em "HH:MM"; "" = nao tem */
export type TimePair = [string, string];

export interface DayRoutine {
  work: TimePair;
  other: TimePair;
  avail: TimePair; // janela em que a pessoa aceita fazer tarefas
}
export type Routine = Record<number, DayRoutine>;

export interface ChoreLog {
  id?: string;
  task_id: string;
  slot: string; // "f" = tarefa fixa; "0","1".. = bloco da tarefa automatica
  log_date: string;
  planned_start: string | null;
  planned_min: number | null;
  real_min: number | null;
}

export interface Entry {
  key: string; // `${taskId}|${slot}`
  taskId: string;
  slot: string;
  name: string;
  color: string;
  start: string;
  mins: number;
  auto: boolean;
}

export const WEEKDAY_CHIPS: [string, number][] = [
  ["Seg", 1], ["Ter", 2], ["Qua", 3], ["Qui", 4], ["Sex", 5], ["Sáb", 6], ["Dom", 0],
];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const TASK_COLORS = ["#6366F1", "#38bdf8", "#f472b6", "#fb923c", "#4ade80", "#facc15"];

// ---------- tempo ----------
export function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function fromMin(n: number) {
  const v = Math.max(0, Math.min(24 * 60 - 1, Math.round(n)));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}
/** aceita "8", "8:30", "0830"; devolve "HH:MM" ou "" se invalido */
export function normTime(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  const t = v.includes(":") ? v : v.length <= 2 ? `${v}:00` : `${v.slice(0, -2)}:${v.slice(-2)}`;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(t) ? fromMin(toMin(t)) : "";
}
export function fmtMin(m: number) {
  const v = Math.round(m);
  const h = Math.floor(v / 60);
  const r = v % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

// ---------- datas (YYYY-MM-DD, horario local) ----------
function parseDate(ds: string) {
  const [y, m, d] = ds.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function dowOf(ds: string) {
  return parseDate(ds).getDay();
}
export function weekKey(ds: string) {
  return mondayOf(parseDate(ds));
}
export function monthDates(year: number, month: number) {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
}
export function ymdOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ---------- modelos iniciais ----------
export type NewTask = Omit<ChoreTask, "id" | "starts_on" | "position">;

export const DEFAULT_TASKS: NewTask[] = [
  { name: "Lavar roupa", color: "#38bdf8", mode: "fixed", weekdays: [0], month_days: [], start_time: "07:00", duration_min: 360, weekly_min: null, block_min: null },
  { name: "Arrumar a casa", color: "#f472b6", mode: "fixed", weekdays: [6], month_days: [], start_time: "14:00", duration_min: 120, weekly_min: null, block_min: null },
  { name: "Lavar o banheiro", color: "#4ade80", mode: "fixed", weekdays: [3], month_days: [], start_time: "19:00", duration_min: 40, weekly_min: null, block_min: null },
  { name: "Limpeza geral", color: "#fb923c", mode: "fixed", weekdays: [], month_days: [5, 20], start_time: "14:00", duration_min: 180, weekly_min: null, block_min: null },
  { name: "Levar o lixo", color: "#facc15", mode: "fixed", weekdays: [1, 4], month_days: [], start_time: "20:00", duration_min: 10, weekly_min: null, block_min: null },
  { name: "Passar roupa", color: "#a78bfa", mode: "auto", weekdays: [], month_days: [], start_time: null, duration_min: 90, weekly_min: 90, block_min: 45 },
  { name: "Limpar a cozinha", color: "#6366F1", mode: "auto", weekdays: [], month_days: [], start_time: null, duration_min: 120, weekly_min: 120, block_min: 40 },
];

export const DEFAULT_AVAIL: TimePair = ["06:00", "22:00"];

export function emptyRoutine(): Routine {
  const r: Routine = {};
  for (let d = 0; d < 7; d++) r[d] = { work: ["", ""], other: ["", ""], avail: [...DEFAULT_AVAIL] };
  return r;
}

export interface RoutineRow {
  weekday: number;
  work_start: string | null; work_end: string | null;
  other_start: string | null; other_end: string | null;
  avail_start: string | null; avail_end: string | null;
}
export function rowsToRoutine(rows: RoutineRow[]): Routine {
  const r = emptyRoutine();
  rows.forEach((x) => {
    r[x.weekday] = {
      work: [x.work_start || "", x.work_end || ""],
      other: [x.other_start || "", x.other_end || ""],
      avail: [x.avail_start || "", x.avail_end || ""],
    };
  });
  return r;
}
export function routineToRow(weekday: number, d: DayRoutine) {
  return {
    weekday,
    work_start: d.work[0] || null, work_end: d.work[1] || null,
    other_start: d.other[0] || null, other_end: d.other[1] || null,
    avail_start: d.avail[0] || null, avail_end: d.avail[1] || null,
  };
}

export function hasWorkHours(routine: Routine) {
  return Object.values(routine).some((d) => d.work[0] && d.work[1]);
}

// ---------- registros ----------
export const logKey = (taskId: string, slot: string, date: string) => `${taskId}|${slot}|${date}`;
export function logMapOf(logs: ChoreLog[]) {
  return new Map(logs.map((l) => [logKey(l.task_id, l.slot, l.log_date), l]));
}

// ---------- tarefas fixas ----------
export function fixedEntries(tasks: ChoreTask[], ds: string): Entry[] {
  const dow = dowOf(ds);
  const dom = Number(ds.slice(8));
  return tasks
    .filter((t) => t.mode === "fixed" && t.start_time && ds >= t.starts_on
      && (t.weekdays.includes(dow) || t.month_days.includes(dom)))
    .map((t) => ({
      key: `${t.id}|f`, taskId: t.id, slot: "f", name: t.name, color: t.color,
      start: t.start_time as string, mins: t.duration_min, auto: false,
    }));
}

/** Fixas dos ultimos `days` dias (antes de hoje) que nao foram marcadas como feitas. */
export function overdueFixed(tasks: ChoreTask[], logs: ChoreLog[], today: string = todayStr(), days = 14) {
  const done = logMapOf(logs);
  const out: { entry: Entry; date: string }[] = [];
  for (let i = days; i >= 1; i--) {
    const ds = addDays(today, -i);
    fixedEntries(tasks, ds).forEach((e) => {
      if (!done.has(logKey(e.taskId, e.slot, ds))) out.push({ entry: e, date: ds });
    });
  }
  return out;
}

// ---------- encaixe automatico ----------
export interface PlanWeek {
  placed: Record<string, Entry[]>;
  unplaced: { task: ChoreTask; mins: number }[];
}

export function blocksOf(t: ChoreTask) {
  const weekly = t.weekly_min || 0;
  const block = Math.max(5, t.block_min || weekly || 5);
  const sizes: number[] = [];
  let left = weekly;
  while (left > 0) { sizes.push(Math.min(block, left)); left -= block; }
  return sizes;
}

export function makePlanner(
  tasks: ChoreTask[],
  routine: Routine,
  logs: ChoreLog[],
  today: string = todayStr(),
  nowMin = 0,
) {
  const cache = new Map<string, PlanWeek>();
  const logMap = logMapOf(logs);

  function blocked(ds: string) {
    const r = routine[dowOf(ds)];
    const out: { kind: "work" | "other"; a: number; b: number }[] = [];
    (["work", "other"] as const).forEach((k) => {
      const [a, b] = r[k];
      if (a && b && toMin(b) > toMin(a)) out.push({ kind: k, a: toMin(a), b: toMin(b) });
    });
    return out;
  }

  /** janelas livres (>= 10 min) do dia: janela "livre p/ tarefas" menos trabalho, compromissos e tarefas */
  function gaps(ds: string, extra: Entry[] = []) {
    const [wa, wb] = routine[dowOf(ds)].avail;
    if (!wa || !wb || toMin(wb) <= toMin(wa)) return [] as [number, number][];
    const busy: [number, number][] = blocked(ds).map((x) => [x.a, x.b]);
    fixedEntries(tasks, ds).concat(extra).forEach((e) => busy.push([toMin(e.start), toMin(e.start) + e.mins]));
    busy.sort((x, y) => x[0] - y[0]);
    // hoje: nada antes de agora (arredondado para 5 min)
    let t = toMin(wa);
    if (ds === today) t = Math.max(t, Math.ceil(nowMin / 5) * 5);
    const end = toMin(wb);
    const out: [number, number][] = [];
    busy.forEach(([a, b]) => {
      if (a > t) out.push([t, Math.min(a, end)]);
      t = Math.max(t, b);
    });
    if (t < end) out.push([t, end]);
    return out.filter((g) => g[1] - g[0] >= 10);
  }

  function week(wk: string): PlanWeek {
    const hit = cache.get(wk);
    if (hit) return hit;
    const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
    const placed: Record<string, Entry[]> = {};
    days.forEach((d) => { placed[d] = []; });
    const unplaced: PlanWeek["unplaced"] = [];
    const weekOver = days[6] < today;

    tasks.filter((t) => t.mode === "auto").sort((a, b) => (b.block_min || 0) - (a.block_min || 0)).forEach((t) => {
      const sizes = blocksOf(t);
      const used = new Set<string>();
      sizes.forEach((size, idx) => {
        const slot = String(idx);
        const name = sizes.length > 1 ? `${t.name} (${idx + 1}/${sizes.length})` : t.name;
        // bloco ja feito nesta semana: fica onde foi feito
        const done = days.map((d) => logMap.get(logKey(t.id, slot, d))).find(Boolean);
        if (done) {
          placed[done.log_date].push({
            key: `${t.id}|${slot}`, taskId: t.id, slot, name, color: t.color, auto: true,
            start: done.planned_start || "00:00", mins: done.planned_min || size,
          });
          used.add(done.log_date);
          return;
        }
        if (weekOver) return;
        let best: { ds: string; gap: [number, number]; score: number } | null = null;
        days.filter((d) => d >= today).forEach((d) => {
          const g = gaps(d, placed[d]);
          const free = g.reduce((s, x) => s + (x[1] - x[0]), 0);
          const gap = g.filter((x) => x[1] - x[0] >= size).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
          if (!gap) return;
          const score = free - (used.has(d) ? 100000 : 0); // prefere dias diferentes
          if (!best || score > best.score) best = { ds: d, gap, score };
        });
        if (!best) { unplaced.push({ task: t, mins: size }); return; }
        const b = best as { ds: string; gap: [number, number] };
        used.add(b.ds);
        placed[b.ds].push({
          key: `${t.id}|${slot}`, taskId: t.id, slot, name, color: t.color, auto: true,
          start: fromMin(b.gap[0]), mins: size,
        });
      });
    });
    const res = { placed, unplaced };
    cache.set(wk, res);
    return res;
  }

  /** tudo do dia, ordenado por horario */
  function entries(ds: string): Entry[] {
    const list = fixedEntries(tasks, ds).concat(week(weekKey(ds)).placed[ds] || []);
    // fixa feita que nao bate mais com a regra atual (tarefa editada): mostra pelo registro
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    logs.forEach((l) => {
      if (l.log_date !== ds || l.slot !== "f") return;
      if (list.some((e) => e.taskId === l.task_id && e.slot === "f")) return;
      const t = taskById.get(l.task_id);
      if (!t) return;
      list.push({
        key: `${t.id}|f`, taskId: t.id, slot: "f", name: t.name, color: t.color, auto: false,
        start: l.planned_start || t.start_time || "00:00", mins: l.planned_min || t.duration_min,
      });
    });
    return list.sort((a, b) => toMin(a.start) - toMin(b.start));
  }

  function isDone(e: Entry, ds: string) {
    return logMap.get(logKey(e.taskId, e.slot, ds));
  }

  function freeMinutes(ds: string) {
    const auto = (week(weekKey(ds)).placed[ds] || []);
    return gaps(ds, auto).reduce((s, g) => s + (g[1] - g[0]), 0);
  }

  return { blocked, gaps, week, entries, isDone, freeMinutes };
}

export type Planner = ReturnType<typeof makePlanner>;

export function describeTask(t: ChoreTask) {
  if (t.mode === "auto") return `${fmtMin(t.weekly_min || 0)} por semana · blocos de até ${fmtMin(t.block_min || t.weekly_min || 0)}`;
  const parts: string[] = [];
  if (t.weekdays.length) {
    const order = WEEKDAY_ORDER.filter((d) => t.weekdays.includes(d));
    const names = order.map((d) => WEEKDAY_FULL[d]);
    if (order.length === 1) {
      const d = order[0];
      parts.push(`${d === 0 || d === 6 ? "Todo" : "Toda"} ${names[0]}`);
    } else if (order.length === 2 && order.includes(6) && order.includes(0)) {
      parts.push("Todo fim de semana");
    } else {
      parts.push(`${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`);
    }
  }
  if (t.month_days.length) parts.push(`Dia ${t.month_days.join(" e ")} do mês`);
  return parts.join(" · ") || "Sem repetição";
}
