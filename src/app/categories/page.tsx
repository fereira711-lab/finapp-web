"use client";

import { useState } from "react";
import { getCategoryConfig } from "@/lib/categories";
import { useCategories, type Category } from "@/lib/useCategories";
import AppShell from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import { Tags, Plus, Pencil, Trash2, X } from "lucide-react";

export default function CategoriesPage() {
  const { categories, loading, addCategory, renameCategory, removeCategory } = useCategories();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setCreating(true); setEditing(null); setName(""); setError("");
  }
  function openEdit(c: Category) {
    setCreating(false); setEditing(c); setName(c.label); setError("");
  }
  function closeForm() {
    setCreating(false); setEditing(null); setError("");
  }

  async function handleSave() {
    if (!name.trim() || busy) return;
    setBusy(true);
    if (editing) {
      const res = await renameCategory(editing.id, name);
      if (!res.ok) { setError(res.error || "Erro ao salvar"); setBusy(false); return; }
    } else {
      const cat = await addCategory(name);
      if (!cat) { setError("Não foi possível criar (nome já existe?)"); setBusy(false); return; }
    }
    setBusy(false);
    closeForm();
  }

  async function handleDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    const res = await removeCategory(deleting.id);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Erro ao apagar"); return; }
    setDeleting(null);
  }

  const custom = categories.filter((c) => c.isCustom);
  const defaults = categories.filter((c) => !c.isCustom);

  return (
    <AppShell>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tags size={18} className="text-[#6366F1]" />
              <h1 className="text-lg font-bold">Categorias</h1>
            </div>
            <button onClick={openCreate} className="glass-btn flex items-center gap-1.5 px-3 py-2 text-xs">
              <Plus size={14} /> Nova Categoria
            </button>
          </div>

          <div>
            <p className="label-upper mb-2">Suas categorias</p>
            {custom.length === 0 ? (
              <p className="text-white/30 text-sm py-4">Nenhuma categoria criada</p>
            ) : (
              <div className="space-y-2">
                {custom.map((c) => {
                  const cfg = getCategoryConfig(c.name);
                  const Icon = cfg.icon;
                  return (
                    <div key={c.id} className="glass-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cfg.color + "20" }}>
                          <Icon size={16} style={{ color: cfg.color }} />
                        </div>
                        <p className="text-sm font-medium">{c.label}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} aria-label="Editar"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { setError(""); setDeleting(c); }} aria-label="Apagar"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="label-upper mb-2">Padrão (não editáveis)</p>
            <div className="flex flex-wrap gap-2">
              {defaults.map((c) => (
                <span key={c.id} className="glass-btn px-3 py-1.5 text-xs text-white/60">{c.label}</span>
              ))}
            </div>
          </div>

          {(creating || editing) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeForm}>
              <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">{editing ? "Editar Categoria" : "Nova Categoria"}</h2>
                  <button onClick={closeForm} className="text-white/40 hover:text-white"><X size={18} /></button>
                </div>
                <div>
                  <label className="label-upper mb-1 block">Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="glass-input w-full px-3 py-2 text-sm text-white" autoFocus />
                  {editing && (
                    <p className="text-xs text-white/30 mt-1">
                      O novo nome vale também para transações, cartões, metas e regras desta categoria.
                    </p>
                  )}
                  {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                </div>
                <button onClick={handleSave} disabled={busy}
                  className="glass-btn-active w-full py-2.5 text-sm font-medium disabled:opacity-50">
                  {editing ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          )}

          {deleting && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleting(null)}>
              <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm">
                  Apagar <b>{deleting.label}</b>? Transações e lançamentos de cartão dela vão para
                  &quot;Outros&quot;; a meta e as regras de categoria dela serão excluídas.
                </p>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setDeleting(null)} className="glass-btn flex-1 py-2 text-sm">Cancelar</button>
                  <button onClick={handleDelete} disabled={busy}
                    className="flex-1 py-2 text-sm rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                    Apagar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
