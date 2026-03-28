"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { getCategoryConfig, CATEGORY_CONFIG } from "@/lib/categories";
import type { Goal } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Target, Plus, Pencil, Trash2, X } from "lucide-react";

interface GoalWithSpent extends Goal {
  spent: number;
}

const EXPENSE_CATEGORIES = [
  "alimentacao", "transporte", "lazer", "saude", "moradia", "educacao", "outros",
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formCategory, setFormCategory] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");

  async function loadGoals() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [goalsRes, txRes, cardTxRes] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("transactions").select("amount, type, category")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
      supabase.from("card_transactions").select("amount, category")
        .eq("user_id", user.id).gte("date", startOfMonth).lte("date", endOfMonth),
    ]);

    const spentMap: Record<string, number> = {};
    (txRes.data || [])
      .filter((t) => t.type === "expense" || t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "outros";
        spentMap[cat] = (spentMap[cat] || 0) + Math.abs(t.amount);
      });
    (cardTxRes.data || []).forEach((t) => {
      const cat = t.category || "outros";
      spentMap[cat] = (spentMap[cat] || 0) + Math.abs(t.amount);
    });

    const withSpent: GoalWithSpent[] = (goalsRes.data || []).map((g) => ({
      ...g,
      monthly_limit: Number(g.monthly_limit),
      spent: spentMap[g.category] || 0,
    }));

    setGoals(withSpent);
    setLoading(false);
  }

  useEffect(() => { loadGoals(); }, []);

  function openCreate() {
    setEditingGoal(null);
    setFormCategory(availableCategories.length > 0 ? availableCategories[0] : "__custom__");
    setCustomCategory("");
    setFormLimit("");
    setShowForm(true);
  }

  function openEdit(g: GoalWithSpent) {
    setEditingGoal(g);
    const isKnown = EXPENSE_CATEGORIES.includes(g.category);
    setFormCategory(isKnown ? g.category : "__custom__");
    setCustomCategory(isKnown ? "" : g.category);
    setFormLimit(String(g.monthly_limit));
    setShowForm(true);
  }

  async function handleSave() {
    const finalCategory = formCategory === "__custom__" ? customCategory.trim().toLowerCase() : formCategory;
    if (!finalCategory || !formLimit) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const limit = parseFloat(formLimit.replace(",", "."));
    if (isNaN(limit) || limit <= 0) return;

    if (editingGoal) {
      await supabase.from("goals").update({ category: finalCategory, monthly_limit: limit })
        .eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").upsert({
        user_id: user.id, category: finalCategory, monthly_limit: limit,
      }, { onConflict: "user_id,category" });
    }

    setShowForm(false);
    loadGoals();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", id);
    setDeleteConfirm(null);
    loadGoals();
  }

  function getProgressColor(pct: number) {
    if (pct > 100) return "bg-red-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-green-500";
  }

  function getTextColor(pct: number) {
    if (pct > 100) return "text-red-400";
    if (pct >= 70) return "text-yellow-400";
    return "text-green-400";
  }

  const usedCategories = goals.map((g) => g.category);
  const availableCategories = editingGoal
    ? EXPENSE_CATEGORIES
    : EXPENSE_CATEGORIES.filter((c) => !usedCategories.includes(c));

  return (
    <AppShell>
      {loading ? (
        <div className="text-white/45">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#6366F1]" />
              <h1 className="text-lg font-bold">Metas Financeiras</h1>
            </div>
            <button onClick={openCreate} className="glass-btn flex items-center gap-1.5 px-3 py-2 text-xs">
              <Plus size={14} /> Nova Meta
            </button>
          </div>

          {/* Goals List */}
          {goals.length === 0 ? (
            <div className="text-center py-12">
              <Target size={40} className="mx-auto text-white/15 mb-3" />
              <p className="text-white/30 text-sm">Nenhuma meta definida</p>
              <p className="text-white/20 text-xs mt-1">Crie metas para controlar seus gastos por categoria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => {
                const cat = getCategoryConfig(g.category);
                const Icon = cat.icon;
                const pct = g.monthly_limit > 0 ? Math.round((g.spent / g.monthly_limit) * 100) : 0;
                const barWidth = Math.min(pct, 100);

                return (
                  <div key={g.id} className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}>
                          <Icon size={16} style={{ color: cat.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{cat.label}</p>
                          <p className="text-xs text-white/40">
                            {formatCurrency(g.spent)} / {formatCurrency(g.monthly_limit)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getTextColor(pct)}`}>{pct}%</span>
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(g.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(pct)}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {pct >= 80 && (
                      <p className="text-xs text-yellow-400/80">
                        {pct >= 100 ? "Limite ultrapassado!" : `${pct}% do limite atingido`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowForm(false)}>
              <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">{editingGoal ? "Editar Meta" : "Nova Meta"}</h2>
                  <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label-upper mb-1 block">Categoria</label>
                    <select
                      value={formCategory}
                      onChange={(e) => { setFormCategory(e.target.value); if (e.target.value !== "__custom__") setCustomCategory(""); }}
                      className="glass-input w-full px-3 py-2 text-sm"
                      style={{ background: "#1E293B", color: "white" }}
                    >
                      {(editingGoal ? EXPENSE_CATEGORIES : availableCategories).map((c) => (
                        <option key={c} value={c} style={{ background: "#1E293B", color: "white" }}>
                          {getCategoryConfig(c).label}
                        </option>
                      ))}
                      <option value="__custom__" style={{ background: "#1E293B", color: "white" }}>
                        Personalizada...
                      </option>
                    </select>
                    {formCategory === "__custom__" && (
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Nome da categoria"
                        className="glass-input w-full px-3 py-2 text-sm mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <label className="label-upper mb-1 block">Limite Mensal (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formLimit}
                      onChange={(e) => setFormLimit(e.target.value)}
                      placeholder="500.00"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button onClick={handleSave} className="glass-btn-active w-full py-2.5 text-sm font-medium">
                  {editingGoal ? "Salvar" : "Criar Meta"}
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirm Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleteConfirm(null)}>
              <div className="glass w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm">Tem certeza que deseja excluir esta meta?</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)} className="glass-btn flex-1 py-2 text-sm">
                    Cancelar
                  </button>
                  <button onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 py-2 text-sm rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                    Excluir
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
