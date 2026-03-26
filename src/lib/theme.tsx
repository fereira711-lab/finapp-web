"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AppearanceSettings {
  background: string;
  backgroundImage?: string;
  glassOpacity: number;
  borderOpacity: number;
}

const DEFAULT_APPEARANCE: AppearanceSettings = {
  background: "linear-gradient(145deg, #1a1a2e, #16213e, #0f3460)",
  glassOpacity: 5,
  borderOpacity: 22,
};

export const PRESET_GRADIENTS = [
  { name: "Azul Escuro", value: "linear-gradient(145deg, #1a1a2e, #16213e, #0f3460)" },
  { name: "Preto", value: "linear-gradient(145deg, #0a0a0a, #1a1a1a, #0d0d0d)" },
  { name: "Roxo", value: "linear-gradient(145deg, #1a0a2e, #2d1b69, #1a0a2e)" },
  { name: "Verde", value: "linear-gradient(145deg, #0a1a0e, #0d2818, #0a2010)" },
  { name: "Laranja", value: "linear-gradient(145deg, #2a1a0a, #3d2010, #1a1008)" },
  { name: "Azul Claro", value: "linear-gradient(145deg, #0a1a2e, #1a3050, #0a2040)" },
  { name: "Cinza", value: "linear-gradient(145deg, #1a1a1a, #2a2a2a, #1a1a1a)" },
  { name: "Roxo Profundo", value: "linear-gradient(145deg, #0f0020, #1a0040, #2d0060)" },
];

interface ThemeContextType {
  appearance: AppearanceSettings;
  setAppearance: (a: AppearanceSettings) => void;
  saveAppearance: (a: AppearanceSettings) => Promise<void>;
  loaded: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  saveAppearance: async () => {},
  loaded: false,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeVars(a: AppearanceSettings) {
  const root = document.documentElement;
  root.style.setProperty("--glass-bg", `rgba(255, 255, 255, ${a.glassOpacity / 100})`);
  root.style.setProperty("--glass-border", `rgba(255, 255, 255, ${a.borderOpacity / 100})`);
  root.style.setProperty("--glass-border-top", `rgba(255, 255, 255, ${Math.min((a.borderOpacity + 30) / 100, 1)})`);

  if (a.backgroundImage) {
    root.style.setProperty("background", `url(${a.backgroundImage}) center/cover fixed`);
    document.body.style.background = `url(${a.backgroundImage}) center/cover fixed`;
  } else {
    root.style.setProperty("background", a.background);
    document.body.style.background = a.background;
    document.body.style.backgroundAttachment = "fixed";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadAppearance() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoaded(true);
          applyThemeVars(DEFAULT_APPEARANCE);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("appearance")
          .eq("id", user.id)
          .single();

        if (data?.appearance && Object.keys(data.appearance).length > 0) {
          const merged = { ...DEFAULT_APPEARANCE, ...data.appearance };
          setAppearance(merged);
          applyThemeVars(merged);
        } else {
          applyThemeVars(DEFAULT_APPEARANCE);
        }
      } catch {
        applyThemeVars(DEFAULT_APPEARANCE);
      }
      setLoaded(true);
    }
    loadAppearance();
  }, []);

  useEffect(() => {
    if (loaded) {
      applyThemeVars(appearance);
    }
  }, [appearance, loaded]);

  const saveAppearance = useCallback(async (a: AppearanceSettings) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ appearance: a })
      .eq("id", user.id);

    setAppearance(a);
  }, []);

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance, saveAppearance, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}
