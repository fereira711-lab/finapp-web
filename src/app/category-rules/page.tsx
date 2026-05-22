"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCategories } from "@/lib/useCategories";
import { getCategoryConfig } from "@/lib/categories";
import type { CategoryRule } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Plus, X, Trash2, Tag } from "lucide-react";

export default function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const { categories } = useCategories();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fPattern, setFPattern] = useState("");
  const [fCategory, setFCategory] = useState("outros");
  const [fPriority, setFPriority] = useState("0");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("category_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: false });

    setRules((data || []) as CategoryRule[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFPattern("");
    setFCategory("outros");
    setFPriority("0");
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(r: CategoryRule) {
    setEditingId(r.id);
    setFPattern(r.pattern);
    setFCategory(r.category);
    setFPriority(String(r.priority));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const data = {
      pattern: fPattern.trim(),
      category: fCategory,
      priority: parseInt(fPriority) || 0,
    };

    if (editingId) {
      await supabase.from("category_rules").update(data).eq("id", editingId);
      showToast("Regra atualizada");
    } else {
      await supabase.from("category_rules").insert({ user_id: user.id, ...data });
      showToast("Regra criada");
    }

    closeForm();
    setSaving(false);
    await load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    await supabase.from("category_rules").delete().eq("id", deleteId);
    setDeleteId(null);
    showToast("Regra removida");
    await load();
  }

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass px-5 py-3 text-sm text-green-400">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="label-upper">Regras de Categorização</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={14} /> Nova
        </button>
      </div>

      <p className="text-xs text-white/45 mb-4">
        Quando voce adiciona um gasto cuja descricao contem o texto da regra,
        a categoria e aplicada automaticamente.
        Exemplo: regra <span className="text-white/70">&quot;uber&quot;</span> → Transporte aplica em &quot;Uber 99&quot;, &quot;UBER VIAGEM&quot; etc.
      </p>

      {loading ? (
        <p className="text-white/45">Carregando...</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Tag size={40} className="mx-auto text-white/20" />
          <p className="text-white/40 text-sm">Nenhuma regra configurada</p>
          <button onClick={openNew} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm px-5 py-2.5 rounded-xl transition-colors">
            Criar primeira regra
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => {
            const cat = getCategoryConfig(r.category);
            const Icon = cat.icon;
            return (
              <div key={r.id} className="glass-card p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => openEdit(r)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "20" }}>
                    <Icon size={16} style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="text-white/40">se contém</span>{" "}
                      <span className="font-mono font-medium text-white">&quot;{r.pattern}&quot;</span>
                    </p>
                    <p className="text-[11px] text-white/40">
                      → {cat.label}
                      {r.priority !== 0 && <span> · prioridade {r.priority}</span>}
                    </p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New/Edit */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSubmit} className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">
                {editingId ? "Editar regra" : "Nova regra"}
              </h2>
              <button type="button" onClick={closeForm} className="text-white/45 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="label-upper block mb-1">Texto na descrição</label>
              <input required value={fPattern} onChange={(e) => setFPattern(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white"
                placeholder="Ex: uber, ifood, netflix..." />
              <p className="text-[10px] text-white/40 mt-1">
                Busca sem distinguir maiusculas/minusculas.
              </p>
            </div>

            <div>
              <label className="label-upper block mb-1">Categoria</label>
              <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white">
                {categories.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#1a1a2e]">{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-upper block mb-1">Prioridade (opcional)</label>
              <input type="number" value={fPriority} onChange={(e) => setFPriority(e.target.value)}
                className="w-full glass-input px-3 py-3 text-base text-white"
                placeholder="0" />
              <p className="text-[10px] text-white/40 mt-1">
                Numero maior = aplicada primeiro. Util quando uma descricao casa com mais de uma regra.
              </p>
            </div>

            <button type="submit" disabled={saving}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Adicionar"}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Delete */}
      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative glass p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Excluir regra?</h2>
            <p className="text-sm text-white/60">
              Transacoes ja categorizadas nao serao afetadas.
            </p>
            <div className="space-y-2">
              <button onClick={handleDelete}
                className="w-full bg-red-500/20 text-red-400 text-sm font-medium py-3 rounded-xl hover:bg-red-500/30 transition-colors">
                Excluir
              </button>
              <button onClick={() => setDeleteId(null)} className="w-full text-white/40 text-sm py-2">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
