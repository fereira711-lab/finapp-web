// Cliente server-side da API da NVIDIA (build.nvidia.com), compativel com OpenAI.
// NUNCA importar em componentes client: a chave fica so no servidor.

export class NvidiaNotConfiguredError extends Error {
  constructor() {
    super("NVIDIA_API_KEY não configurada");
    this.name = "NvidiaNotConfiguredError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";
const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export async function nvidiaChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NvidiaNotConfiguredError();

  const base = (process.env.NVIDIA_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    // nao repassar o corpo da resposta ao cliente: pode conter detalhes da conta
    throw new Error(`NVIDIA API respondeu ${res.status}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Resposta da NVIDIA sem conteúdo");
  return text;
}

/** Extrai o primeiro objeto JSON de um texto de modelo (tolera ```json e texto em volta). */
export function extractJson<T = unknown>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
