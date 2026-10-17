"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { describeTask, fmtMin, fromMin, toMin, type ChoreTask, type NewTask } from "@/lib/chores";
import TaskFormModal from "./TaskFormModal";

interface Props {
  tasks: ChoreTask[];
  onSave: (data: NewTask, id?: string) => void;
  onDelete: (id: string) => void;
}

export default function TasksTab({ tasks, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<ChoreTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ChoreTask | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-white/40">
          Edite ou apague as sugestões.<br />
          <b className="text-indigo-300">Automática</b> = o app encaixa nos seus horários livres.
        </p>
        <button onClick={() => setCreating(true)} className="glass-btn flex items-center gap-1.5 px-3 py-2 text-xs shrink-0">
          <Plus size={14} /> Nova tarefa
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-10">Nenhuma tarefa ainda</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="glass-card px-3 py-2.5 flex items-center gap-3">
              <span className="w-1 h-9 rounded shrink-0" style={{ background: t.color, opacity: t.mode === "auto" ? 0.55 : 1 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {t.name}
                  {t.mode === "auto" && (
                    <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-indigo-300 border border-indigo-300/40 rounded-full px-1.5 py-px">automática</span>
                  )}
                </p>
                <p className="text-[11px] text-white/45">{describeTask(t)}</p>
                <p className="text-[11px] text-white/45">
                  {t.mode === "auto"
                    ? "Nos seus horários livres, dividida em blocos"
                    : `${t.start_time}–${fromMin(toMin(t.start_time || "00:00") + t.duration_min)} · ${fmtMin(t.duration_min)}`}
                </p>
              </div>
              <button onClick={() => setEditing(t)} aria-label="Editar" className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><Pencil size={14} /></button>
              <button onClick={() => setDeleting(t)} aria-label="Apagar" className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TaskFormModal
          key={editing?.id || "new"}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(data, id) => { onSave(data, id); setCreating(false); setEditing(null); }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm">Apagar <b>{deleting.name}</b>? O histórico do que já foi feito dessa tarefa também é apagado.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="glass-btn flex-1 py-2 text-sm">Cancelar</button>
              <button onClick={() => { onDelete(deleting.id); setDeleting(null); }}
                className="flex-1 py-2 text-sm rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
