"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CACHE_KEY = "finapp:nav-order";

/**
 * Aplica a ordem salva a uma lista de itens (identificados por href).
 * Itens fora da ordem salva (ex.: telas novas) entram no fim, na ordem padrão;
 * rotas salvas que não existem mais são ignoradas.
 */
export function applyNavOrder<T extends { href: string }>(items: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return items;
  const byHref = new Map(items.map((i) => [i.href, i]));
  const ordered = order.flatMap((h) => (byHref.has(h) ? [byHref.get(h) as T] : []));
  const seen = new Set(ordered.map((i) => i.href));
  return ordered.concat(items.filter((i) => !seen.has(i.href)));
}

function readCache(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : null;
  } catch {
    return null;
  }
}
function writeCache(order: string[] | null) {
  try {
    if (order) localStorage.setItem(CACHE_KEY, JSON.stringify(order));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* sem armazenamento local: segue só com o banco */ }
}

/** Ordem do menu lateral: salva na conta (profiles.nav_order) com cópia local para abrir rápido. */
export function useNavOrder() {
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    const cached = readCache();
    if (cached) setOrder(cached);
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("profiles").select("nav_order").eq("id", user.id).single();
        if (error) return;
        const saved = Array.isArray(data?.nav_order) && data.nav_order.length > 0 ? (data.nav_order as string[]) : null;
        setOrder(saved);
        writeCache(saved);
      } catch { /* mantém a cópia local */ }
    })();
  }, []);

  /** next = null volta para a ordem padrão */
  const save = useCallback(async (next: string[] | null) => {
    setOrder(next);
    writeCache(next);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ nav_order: next }).eq("id", user.id);
    } catch { /* a ordem local já vale; tenta de novo na próxima mudança */ }
  }, []);

  return { order, save };
}
