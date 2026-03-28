import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Service-role client for webhook (no user session)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// --- Auto-categorization by description keywords ---
const CATEGORY_RULES: [string[], string][] = [
  [["ifood", "rappi", "uber eats", "ubereats", "restaurante", "lanche", "padaria", "mercado", "supermercado", "hortifruti"], "alimentacao"],
  [["uber", "99", "99app", "combustivel", "posto", "estacionamento", "ipva", "pedagio", "onibus"], "transporte"],
  [["netflix", "spotify", "steam", "cinema", "lazer", "teatro", "show", "disney", "hbo", "prime video", "youtube premium"], "lazer"],
  [["farmacia", "drogaria", "hospital", "clinica", "medico", "consulta", "exame", "laboratorio", "unimed", "sulamerica"], "saude"],
  [["aluguel", "condominio", "agua", "luz", "energia", "gas", "iptu", "internet", "celular", "telefone"], "moradia"],
  [["escola", "faculdade", "curso", "livro", "udemy", "alura", "mensalidade escolar"], "educacao"],
  [["salario", "pagamento", "transferencia recebida", "pix recebido", "deposito"], "salario"],
  [["investimento", "cdb", "tesouro", "acao", "fundo", "renda fixa", "renda variavel", "cripto", "bitcoin"], "investimento"],
];

function autoCategory(description: string): string {
  const lower = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [keywords, category] of CATEGORY_RULES) {
    for (const kw of keywords) {
      const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes(kwNorm)) return category;
    }
  }
  return "outros";
}

// --- Signature verification ---
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// --- Pluggy webhook event types ---
interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw?: string;
  amount: number;
  date: string;
  category?: string;
  type?: string;
  status?: string;
  currencyCode?: string;
}

interface PluggyEvent {
  event: string;
  data?: {
    item?: { id: string };
    transactions?: PluggyTransaction[];
    transactionIds?: string[];
    [key: string]: unknown;
  };
}

// --- Lookup user_id from pluggy_account_id ---
async function findUserByPluggyAccount(
  supabase: ReturnType<typeof getSupabase>,
  pluggyAccountId: string
): Promise<{ userId: string; accountId: string } | null> {
  const { data } = await supabase
    .from("accounts")
    .select("id, user_id")
    .eq("pluggy_account_id", pluggyAccountId)
    .limit(1)
    .single();
  if (!data) return null;
  return { userId: data.user_id, accountId: data.id };
}

// --- Upsert transactions ---
async function upsertTransactions(
  supabase: ReturnType<typeof getSupabase>,
  transactions: PluggyTransaction[]
) {
  for (const tx of transactions) {
    const lookup = await findUserByPluggyAccount(supabase, tx.accountId);
    if (!lookup) {
      console.warn(`[pluggy-webhook] No account found for pluggy_account_id=${tx.accountId}`);
      continue;
    }

    const category = autoCategory(tx.description || tx.descriptionRaw || "");
    const txType = tx.amount > 0 ? "income" : "expense";

    const row = {
      user_id: lookup.userId,
      account_id: lookup.accountId,
      pluggy_transaction_id: tx.id,
      description: tx.description || tx.descriptionRaw || "Sem descrição",
      amount: tx.amount,
      category,
      date: tx.date.split("T")[0],
      type: txType,
      status: tx.status || "posted",
    };

    const { error } = await supabase
      .from("transactions")
      .upsert(row, { onConflict: "pluggy_transaction_id" });

    if (error) {
      console.error(`[pluggy-webhook] upsert error for tx ${tx.id}:`, error.message);
    }
  }
}

// --- Delete transactions ---
async function deleteTransactions(
  supabase: ReturnType<typeof getSupabase>,
  transactionIds: string[]
) {
  for (const txId of transactionIds) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("pluggy_transaction_id", txId);

    if (error) {
      console.error(`[pluggy-webhook] delete error for tx ${txId}:`, error.message);
    }
  }
}

// --- POST handler ---
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature
    const signature = req.headers.get("x-pluggy-signature");
    if (!verifySignature(rawBody, signature)) {
      console.warn("[pluggy-webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: PluggyEvent = JSON.parse(rawBody);
    const eventType = event.event;
    console.log(`[pluggy-webhook] Received event: ${eventType}`);

    const supabase = getSupabase();

    switch (eventType) {
      case "transactions/created":
      case "transactions/updated": {
        const transactions = event.data?.transactions;
        if (transactions && transactions.length > 0) {
          await upsertTransactions(supabase, transactions);
          console.log(`[pluggy-webhook] Upserted ${transactions.length} transactions`);
        }
        break;
      }

      case "transactions/deleted": {
        const ids = event.data?.transactionIds;
        if (ids && ids.length > 0) {
          await deleteTransactions(supabase, ids);
          console.log(`[pluggy-webhook] Deleted ${ids.length} transactions`);
        }
        break;
      }

      case "item/created":
      case "item/updated":
        // Acknowledge — no action needed for now
        console.log(`[pluggy-webhook] Item event acknowledged: ${eventType}`);
        break;

      default:
        console.log(`[pluggy-webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pluggy-webhook] Unexpected error:", err);
    return NextResponse.json({ ok: true });
  }
}
