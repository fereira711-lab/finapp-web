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

// O catalogo gratuito muda e modelos saem do ar sem aviso (HTTP 410/404).
// Tentamos em ordem; NVIDIA_MODEL (aceita varios, separados por virgula) tem prioridade.
// Ordem medida em 17/10/2026 na conta do dono: gpt-oss-20b ~3-8 s; gemma-4-31b ~20-40 s (reserva).
// mistral-large, gemma-3-12b, mistral-7b, mistral-nemo e nemotron-nano aparecem em /v1/models mas dao 404.
const DEFAULT_MODELS = [
  "openai/gpt-oss-20b",
  "google/gemma-4-31b-it",
  "z-ai/glm-5.3-flash",
];
let lastGoodModel: string | null = null;

function modelChain(): string[] {
  const fromEnv = (process.env.NVIDIA_MODEL || "").split(",").map((m) => m.trim()).filter(Boolean);
  const chain = [...(lastGoodModel ? [lastGoodModel] : []), ...fromEnv, ...DEFAULT_MODELS];
  return Array.from(new Set(chain));
}

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export async function nvidiaChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NvidiaNotConfiguredError();

  const base = (process.env.NVIDIA_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  let lastError = "nenhum modelo tentado";

  for (const model of modelChain()) {
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.2,
          stream: false,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
      });
    } catch {
      // timeout ou falha de rede neste modelo: tenta o proximo
      console.warn(`NVIDIA: modelo ${model} nao respondeu a tempo, tentando o proximo`);
      if (lastGoodModel === model) lastGoodModel = null;
      lastError = `sem resposta (modelo ${model})`;
      continue;
    }

    // chave invalida/sem permissao: trocar de modelo nao resolve
    if (res.status === 401 || res.status === 403) {
      throw new Error(`NVIDIA API respondeu ${res.status} (chave recusada)`);
    }
    // modelo aposentado/inexistente na conta, limite de uso ou erro do servidor: tenta o proximo
    if (res.status === 410 || res.status === 404 || res.status === 429 || res.status >= 500) {
      console.warn(`NVIDIA: modelo ${model} indisponivel (${res.status}), tentando o proximo`);
      if (lastGoodModel === model) lastGoodModel = null;
      lastError = `HTTP ${res.status} (modelo ${model})`;
      continue;
    }
    if (!res.ok) {
      // nao repassar o corpo da resposta ao cliente: pode conter detalhes da conta
      throw new Error(`NVIDIA API respondeu ${res.status} (modelo ${model})`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    // modelos de raciocinio podem devolver o "pensamento" entre <think>...</think>
    const text = typeof raw === "string" ? raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim() : "";
    if (!text) {
      // gpt-oss gasta os tokens pensando e pode devolver vazio: tenta o proximo
      console.warn(`NVIDIA: modelo ${model} devolveu resposta vazia, tentando o proximo`);
      lastError = `resposta vazia (modelo ${model})`;
      continue;
    }
    lastGoodModel = model;
    return text;
  }

  throw new Error(`Nenhum modelo da NVIDIA disponível no momento (${lastError})`);
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
