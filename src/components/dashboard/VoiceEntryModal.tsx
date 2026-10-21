"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { parsePrice, priceToText, shopCat } from "@/lib/shopping";
import type { EntryDraft, ParseResponse, ShoppingParseResponse } from "@/lib/quickEntry";

interface Props {
  /** frase ja pronta (ex.: vinda do Atalho da Siri): interpreta ao abrir */
  initialText?: string;
  onClose: () => void;
  /** "shopping": usado na tela de Compras; toda frase vira compra de item da lista */
  mode?: "general" | "shopping";
  /** depois de marcar/adicionar um item da lista de compras */
  onSaved?: () => void;
  /** gasto/receita: o Lançamento Rápido abre preenchido para conferir e salvar */
  onEntry: (draft: EntryDraft, note?: string) => void;
}

// Reconhecimento de voz do navegador (Safari/Chrome). Tipagem minima, sem "any".
interface RecResult { isFinal: boolean; 0: { transcript: string } }
interface RecEvent { results: ArrayLike<RecResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface ShopRow { key: number; name: string; price: string; shopCategory: string; listItemId: string | null }

export default function VoiceEntryModal({ initialText = "", onClose, onEntry, mode = "general", onSaved }: Props) {
  const [text, setText] = useState(initialText);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shopping, setShopping] = useState<EntryDraft | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopPrice, setShopPrice] = useState("");
  // tela de Compras: varios itens numa frase
  const [rows, setRows] = useState<ShopRow[] | null>(null);
  const [rowsListId, setRowsListId] = useState("");
  const [saving, setSaving] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef(initialText);
  const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;

  const run = useCallback(async (phrase: string) => {
    const t = phrase.trim();
    if (!t) { setError("Fale ou digite o que você gastou."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/quick-entry/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, context: mode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Não consegui interpretar."); setBusy(false); return; }
      if (data.shopping) {
        const sp = data.shopping as ShoppingParseResponse;
        setRowsListId(sp.listId);
        setRows(sp.items.map((it, i) => ({
          key: i, name: it.name, price: it.amount == null ? "" : priceToText(it.amount),
          shopCategory: it.shopCategory, listItemId: it.listItemId,
        })));
        setBusy(false);
        return;
      }
      const { draft, note } = data as ParseResponse;
      if (draft.kind === "shopping") {
        setShopping(draft); setShopName(draft.description); setShopPrice(priceToText(draft.amount));
        setBusy(false);
        return;
      }
      onEntry(draft, note);
    } catch {
      setError("Erro de conexão. Tente de novo.");
      setBusy(false);
    }
  }, [onEntry, mode]);

  // frase vinda do Atalho: interpreta uma vez ao abrir
  const autoRan = useRef(false);
  useEffect(() => {
    if (initialText && !autoRan.current) { autoRan.current = true; run(initialText); }
  }, [initialText, run]);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError("");
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      const shown = (finalText + " " + interim).trim();
      textRef.current = shown;
      setText(shown);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Permita o microfone no navegador, ou use o microfone do teclado do celular.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Não consegui ouvir. Tente de novo ou digite.");
      }
    };
    rec.onend = () => {
      setListening(false);
      // terminou de falar: interpreta sozinho
      if (finalText.trim()) run(finalText);
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError("Não consegui iniciar o microfone."); }
  }

  async function saveShopping() {
    if (!shopping?.listId) return;
    const price = parsePrice(shopPrice);
    const name = shopName.trim();
    if (!name || price <= 0) { setError("Informe o item e o valor."); return; }
    setSaving(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    let err: { message: string } | null = null;
    if (shopping.listItemId) {
      ({ error: err } = await supabase.from("shopping_list_items")
        .update({ checked: true, price }).eq("id", shopping.listItemId));
    } else {
      ({ error: err } = await supabase.from("shopping_list_items").insert({
        list_id: shopping.listId, user_id: user.id, item_id: null, name, qty: "1 un",
        category: shopping.shopCategory, estimated_price: price, price, checked: true, position: 999,
      }));
    }
    setSaving(false);
    if (err) { setError("Erro ao salvar: " + err.message); return; }
    window.dispatchEvent(new Event("finapp:data-changed"));
    onSaved?.();
    onClose();
  }

  async function saveRows() {
    if (!rows) return;
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) { setError("Nenhum item para salvar."); return; }
    setSaving(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    let failed = "";
    for (const r of valid) {
      const price = parsePrice(r.price);
      let err: { message: string } | null = null;
      if (r.listItemId) {
        // ja esta na lista: com valor marca como comprado; sem valor nao ha nada a fazer
        if (price > 0) ({ error: err } = await supabase.from("shopping_list_items")
          .update({ checked: true, price }).eq("id", r.listItemId));
      } else {
        ({ error: err } = await supabase.from("shopping_list_items").insert({
          list_id: rowsListId, user_id: user.id, item_id: null, name: r.name.trim(), qty: "1 un",
          category: r.shopCategory, estimated_price: price > 0 ? price : null,
          price: price > 0 ? price : null, checked: price > 0, position: 999,
        }));
      }
      if (err) { failed = err.message; break; }
    }
    setSaving(false);
    if (failed) { setError("Erro ao salvar: " + failed); return; }
    window.dispatchEvent(new Event("finapp:data-changed"));
    onSaved?.();
    onClose();
  }

  function asExpense() {
    if (!shopping) return;
    onEntry({
      ...shopping, kind: "expense", description: shopName.trim() || shopping.description,
      amount: parsePrice(shopPrice) || shopping.amount, listId: null, listItemId: null,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && !saving && onClose()} />
      <div className="relative glass p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles size={18} className="text-[#818CF8]" /> Falar e registrar</h2>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white p-1" aria-label="Fechar"><X size={20} /></button>
        </div>

        {rows ? (
          <>
            <p className="text-xs text-white/45">
              Confira os itens. Com valor, entram como comprados; sem valor, só vão para a lista da semana.
            </p>
            <div className="space-y-2">
              {rows.map((r) => {
                const bought = parsePrice(r.price) > 0;
                return (
                  <div key={r.key} className="glass-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={r.name} aria-label="Item"
                        onChange={(e) => setRows(rows.map((x) => x.key === r.key ? { ...x, name: e.target.value } : x))}
                        className="flex-1 min-w-0 glass-input px-3 py-2 text-base text-white" />
                      <button type="button" aria-label="Remover item"
                        onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                        className="text-white/40 hover:text-white p-1"><X size={18} /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input value={r.price} inputMode="decimal" placeholder="Valor (R$)" aria-label="Valor pago"
                        onChange={(e) => setRows(rows.map((x) => x.key === r.key ? { ...x, price: e.target.value } : x))}
                        className="w-28 glass-input px-3 py-2 text-base text-white" />
                      <p className="text-xs text-white/40 min-w-0">
                        {shopCat(r.shopCategory).label} · {bought
                          ? (r.listItemId ? "marca como comprado" : "comprado agora")
                          : (r.listItemId ? "já está na lista" : "vai para a lista")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="button" onClick={saveRows} disabled={saving || rows.length === 0}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : `Salvar ${rows.length} ${rows.length === 1 ? "item" : "itens"}`}
            </button>
            <button type="button" onClick={() => { setRows(null); setError(""); }}
              className="w-full text-white/45 text-xs py-1 hover:text-white">Voltar e refazer</button>
          </>
        ) : !shopping ? (
          <>
            <p className="text-xs text-white/45">
              {mode === "shopping"
                ? <>Diga um ou vários itens: &quot;sabonete 9, arroz 28&quot; (comprados) ou &quot;leite e ovos na lista&quot; (só adiciona à lista). Você confere antes de salvar.</>
                : <>Diga ou digite, por exemplo: &quot;gastei 45 no mercado&quot;, &quot;300 no cartão Nubank em 3x&quot;,
                  &quot;recebi 600 do cliente&quot; ou &quot;comprei arroz por 28&quot;. Você confere antes de salvar.</>}
            </p>

            {supported && (
              <button type="button" onClick={toggleMic} disabled={busy}
                className={`w-full flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50 ${
                  listening ? "bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse" : "glass-btn-active"}`}>
                {listening ? <MicOff size={28} /> : <Mic size={28} />}
                {listening ? "Ouvindo... toque para parar" : "Toque e fale"}
              </button>
            )}

            <textarea value={text} rows={2}
              onChange={(e) => { setText(e.target.value); textRef.current = e.target.value; }}
              placeholder={supported ? "Ou digite aqui..." : "Digite aqui (no iPhone, use o microfone do teclado para ditar)"}
              className="w-full glass-input px-3 py-3 text-base text-white resize-none" />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button type="button" onClick={() => run(textRef.current)} disabled={busy || !text.trim()}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {busy ? "Entendendo..." : "Entender"}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-white/45">
              {shopping.listItemId
                ? "Vou marcar este item da lista de compras da semana como comprado."
                : "Esse item não está na lista da semana: vou adicioná-lo já como comprado."}
            </p>
            <div className="glass-card p-3 space-y-3">
              <div>
                <label className="label-upper block mb-1">Item</label>
                <input value={shopName} onChange={(e) => setShopName(e.target.value)}
                  className="w-full glass-input px-3 py-3 text-base text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="label-upper block mb-1">Valor pago (R$)</label>
                  <input value={shopPrice} inputMode="decimal" onChange={(e) => setShopPrice(e.target.value)}
                    className="w-full glass-input px-3 py-3 text-base text-white" />
                </div>
                <p className="text-xs text-white/40 pb-3">{shopCat(shopping.shopCategory).label} · {formatCurrency(parsePrice(shopPrice))}</p>
              </div>
            </div>
            <p className="text-[11px] text-white/30">
              A despesa só entra em Transações quando você finalizar a compra da semana, junto com os outros itens.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="button" onClick={saveShopping} disabled={saving}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : "Marcar como comprado"}
            </button>
            {mode === "general" && (
              <button type="button" onClick={asExpense} disabled={saving} className="w-full text-white/45 text-xs py-1 hover:text-white">
                Não é da lista? Registrar como gasto
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
