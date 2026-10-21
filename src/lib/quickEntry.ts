// Registro por voz/texto: tipos e validacao do rascunho que a IA devolve.
// Funcoes puras (sem acesso a banco/rede) para poderem ser testadas e usadas no servidor e no cliente.
import { SHOP_CATEGORIES } from "@/lib/shopping";

export type EntryKind = "expense" | "income" | "shopping";

export interface EntryDraft {
  kind: EntryKind;
  amount: number;
  description: string;
  /** categories.name (gasto/receita) */
  category: string;
  /** YYYY-MM-DD */
  date: string;
  method: "pix" | "card";
  cardId: string | null;
  /** 1 = a vista */
  installments: number;
  /** chave de SHOP_CATEGORIES (so para item da lista de compras) */
  shopCategory: string;
  listId: string | null;
  listItemId: string | null;
}

export interface ParseResponse {
  draft: EntryDraft;
  note?: string;
}

export interface ParseContext {
  today: string;
  categories: { name: string; label: string }[];
  cards: { id: string; name: string }[];
  /** lista de compras aberta da semana (itens ainda nao comprados) */
  openList: { id: string; items: { id: string; name: string }[] } | null;
  /** tela de Compras: toda frase e compra de item da lista (nunca gasto geral/receita) */
  forceShopping?: boolean;
}

/** Data de hoje em Brasilia (YYYY-MM-DD), independente do fuso do servidor. */
export function brToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Acha o item cujo nome bate com o texto (igual, ou um contido no outro); prefere o nome mais longo. */
export function matchByName<T extends { name: string }>(query: string | null | undefined, list: T[]): T | null {
  const q = norm(query || "");
  if (!q) return null;
  let best: { item: T; len: number } | null = null;
  for (const item of list) {
    const n = norm(item.name);
    if (!n) continue;
    if (n === q) return item;
    if (q.includes(n) || n.includes(q)) {
      if (!best || n.length > best.len) best = { item, len: n.length };
    }
  }
  return best ? best.item : null;
}

function validDate(s: unknown, today: string): string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return today;
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  if (isNaN(t) || new Date(t).getUTCDate() !== d) return today;
  const [ty, tm, td] = today.split("-").map(Number);
  const days = Math.round((Date.UTC(ty, tm - 1, td) - t) / 86400000);
  // nao aceita futuro (lancamento rapido e so de coisa realizada) nem mais de 1 ano atras
  return days < 0 || days > 365 ? today : s;
}

function toAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    // "1.234,56" (formato BR: com virgula) ou "45.90" (ponto decimal)
    const s = String(v ?? "").replace(/[^\d.,-]/g, "");
    n = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  }
  if (!isFinite(n)) return null;
  const amount = Math.round(n * 100) / 100;
  return amount > 0 && amount <= 10_000_000 ? amount : null;
}

/** Valida o JSON da IA e monta o rascunho. Devolve null se nao der para aproveitar (ex.: sem valor). */
export function buildDraft(raw: Record<string, unknown> | null, ctx: ParseContext): { draft: EntryDraft; note?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const amount = toAmount(raw.amount);
  if (amount == null) return null;

  let kind: EntryKind = ctx.forceShopping ? "shopping"
    : raw.kind === "income" ? "income" : raw.kind === "shopping" ? "shopping" : "expense";
  let note: string | undefined;

  const rawDesc = typeof raw.description === "string" ? raw.description.trim().slice(0, 80) : "";
  let description = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);

  const categoryNames = new Set(ctx.categories.map((c) => c.name));
  const rawCat = typeof raw.category === "string" ? raw.category.trim() : "";
  const category = categoryNames.has(rawCat) ? rawCat : categoryNames.has("outros") ? "outros" : ctx.categories[0]?.name || "outros";

  const shopRaw = typeof raw.shopping_category === "string" ? raw.shopping_category.trim() : "";
  const shopCategory = shopRaw in SHOP_CATEGORIES ? shopRaw : "outros";

  let listId: string | null = null;
  let listItemId: string | null = null;
  if (kind === "shopping") {
    if (!ctx.openList) {
      kind = "expense";
      note = "Não há lista de compras aberta nesta semana; registrei como gasto.";
    } else {
      listId = ctx.openList.id;
      const found = matchByName(description, ctx.openList.items);
      if (found) { listItemId = found.id; description = found.name; }
    }
  }
  if (!description) description = kind === "income" ? "Receita" : "Gasto";

  let method: "pix" | "card" = "pix";
  let cardId: string | null = null;
  let installments = 1;
  if (kind === "expense" && raw.payment === "card" && ctx.cards.length > 0) {
    method = "card";
    const card = matchByName(typeof raw.card === "string" ? raw.card : null, ctx.cards);
    cardId = card ? card.id : null;
    const n = Math.round(Number(raw.installments));
    installments = n >= 2 && n <= 48 ? n : 1;
  }

  return {
    draft: {
      kind, amount, description, category, date: validDate(raw.date, ctx.today),
      method, cardId, installments, shopCategory, listId, listItemId,
    },
    note,
  };
}

/** Um item citado na tela de Compras: com valor = comprado agora; sem valor = so entra na lista. */
export interface ShopItemDraft {
  name: string;
  /** valor pago; null = ainda nao comprado (so adicionar a lista) */
  amount: number | null;
  shopCategory: string;
  /** item que ja esta na lista da semana (ainda nao comprado) */
  listItemId: string | null;
}

export interface ShoppingParseResponse {
  listId: string;
  items: ShopItemDraft[];
}

/**
 * Tela de Compras: valida a lista de itens que a IA devolveu.
 * Aceita {"items":[...]} ou direto [...]. Devolve null se nao houver nenhum item aproveitavel.
 */
export function buildShoppingItems(raw: unknown, ctx: ParseContext): ShoppingParseResponse | null {
  if (!ctx.openList) return null;
  const arr = Array.isArray(raw) ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items : null;
  if (!arr) return null;

  const items: ShopItemDraft[] = [];
  const used = new Set<string>();
  for (const r of arr.slice(0, 15)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const nameRaw = typeof o.name === "string" ? o.name : typeof o.description === "string" ? o.description : "";
    const t = nameRaw.trim().slice(0, 80);
    if (!t) continue;
    const name = t.charAt(0).toUpperCase() + t.slice(1);
    const amount = o.amount == null || o.amount === "" ? null : toAmount(o.amount);
    const shopRaw = typeof o.shopping_category === "string" ? o.shopping_category.trim() : "";
    const shopCategory = shopRaw in SHOP_CATEGORIES ? shopRaw : "outros";

    // cada item da lista so pode ser usado uma vez na mesma frase
    const free = ctx.openList.items.filter((i) => !used.has(i.id));
    const found = matchByName(name, free);
    if (found) used.add(found.id);
    items.push({ name: found ? found.name : name, amount, shopCategory, listItemId: found ? found.id : null });
  }
  return items.length > 0 ? { listId: ctx.openList.id, items } : null;
}
