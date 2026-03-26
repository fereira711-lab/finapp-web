"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme, PRESET_GRADIENTS, type AppearanceSettings } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { ArrowLeft, Check, Upload, Palette } from "lucide-react";
import Link from "next/link";

export default function AppearancePage() {
  const { appearance, setAppearance, saveAppearance } = useTheme();
  const [draft, setDraft] = useState<AppearanceSettings>(appearance);
  const [customColor, setCustomColor] = useState("#1a1a2e");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function updateDraft(partial: Partial<AppearanceSettings>) {
    const updated = { ...draft, ...partial };
    setDraft(updated);
    setAppearance(updated);
  }

  function selectGradient(value: string) {
    updateDraft({ background: value, backgroundImage: undefined });
  }

  function applyCustomColor() {
    const gradient = `linear-gradient(145deg, ${customColor}, ${adjustBrightness(customColor, -20)}, ${adjustBrightness(customColor, -40)})`;
    updateDraft({ background: gradient, backgroundImage: undefined });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split(".").pop();
      const path = `backgrounds/${user.id}/bg.${ext}`;

      await supabase.storage.from("avatars").upload(path, file, { upsert: true });

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

      if (urlData?.publicUrl) {
        updateDraft({ backgroundImage: urlData.publicUrl });
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveAppearance(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <button className="glass-btn p-2 rounded-xl">
              <ArrowLeft size={18} className="text-white/60" />
            </button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Aparência</h1>
            <p className="text-xs text-white/30">Personalize o visual do app</p>
          </div>
        </div>

        {/* Gradient Presets */}
        <div className="glass-divider pb-5">
          <h2 className="label-upper mb-3">Fundo</h2>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_GRADIENTS.map((g) => {
              const isActive = draft.background === g.value && !draft.backgroundImage;
              return (
                <button
                  key={g.name}
                  onClick={() => selectGradient(g.value)}
                  className={`relative aspect-square rounded-2xl overflow-hidden transition-all ${
                    isActive ? "ring-2 ring-[#6366F1] ring-offset-2 ring-offset-transparent" : ""
                  }`}
                  style={{ background: g.value }}
                  title={g.name}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Check size={18} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color */}
        <div className="glass-divider pb-5">
          <h2 className="label-upper mb-3">Cor Personalizada</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-12 rounded-xl border-0 cursor-pointer bg-transparent"
              />
            </div>
            <button
              onClick={applyCustomColor}
              className="glass-btn px-4 py-2.5 text-xs uppercase tracking-wider text-white/60 flex items-center gap-2"
            >
              <Palette size={14} />
              Aplicar
            </button>
          </div>
        </div>

        {/* Upload Image */}
        <div className="glass-divider pb-5">
          <h2 className="label-upper mb-3">Imagem de Fundo</h2>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="glass-btn w-full flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-wider text-white/60 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "Enviando..." : "Escolher imagem"}
          </button>
          {draft.backgroundImage && (
            <button
              onClick={() => updateDraft({ backgroundImage: undefined })}
              className="mt-2 text-xs text-red-400 hover:text-red-300"
            >
              Remover imagem
            </button>
          )}
        </div>

        {/* Glass Opacity Slider */}
        <div className="glass-divider pb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="label-upper">Opacidade do Glass</h2>
            <span className="text-xs text-white/45 font-mono">{draft.glassOpacity}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            value={draft.glassOpacity}
            onChange={(e) => updateDraft({ glassOpacity: Number(e.target.value) })}
            className="w-full accent-[#6366F1] h-1.5"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-1">
            <span>5%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Border Opacity Slider */}
        <div className="glass-divider pb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="label-upper">Opacidade da Borda</h2>
            <span className="text-xs text-white/45 font-mono">{draft.borderOpacity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={90}
            value={draft.borderOpacity}
            onChange={(e) => updateDraft({ borderOpacity: Number(e.target.value) })}
            className="w-full accent-[#6366F1] h-1.5"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-1">
            <span>10%</span>
            <span>90%</span>
          </div>
        </div>

        {/* Preview */}
        <div className="glass-divider pb-5">
          <h2 className="label-upper mb-3">Preview</h2>
          <div
            className="rounded-2xl p-4 h-32 flex items-center justify-center"
            style={{
              background: `rgba(255, 255, 255, ${draft.glassOpacity / 100})`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: `1px solid rgba(255, 255, 255, ${draft.borderOpacity / 100})`,
              borderTop: `1.5px solid rgba(255, 255, 255, ${Math.min((draft.borderOpacity + 30) / 100, 1)})`,
            }}
          >
            <div className="text-center">
              <p className="label-upper mb-1">Saldo Total</p>
              <p className="text-2xl font-bold">R$ 12.450,00</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3.5 rounded-xl font-medium text-sm transition-all ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#6366F1] hover:bg-[#4F46E5] text-white disabled:opacity-50"
          }`}
        >
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Preferências"}
        </button>
      </div>
    </AppShell>
  );
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
