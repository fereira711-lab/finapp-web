# finapp-web

Aplicacao web financeira pessoal baseada em Next.js, React, TypeScript e Supabase.

## Objetivo

Centralizar saldo, transacoes, agenda financeira, cartoes, metas, relatorios, compras semanais, rotina da casa e assistencia por IA em uma interface unica, com operacao manual dos lancamentos financeiros e registro de gastos e compras por voz ou texto.

## Stack

- Next.js 15
- React 18
- TypeScript
- Supabase
- Tailwind CSS
- Recharts
- IA da NVIDIA (principal) e Anthropic SDK (reserva)

## Estrutura principal

- `src/app/`: rotas, paginas e endpoints da aplicacao
- `src/components/`: componentes de interface
- `src/lib/`: integracoes, hooks e utilitarios
- `web/`: artefatos web estaticos
- `supabase-migrations/`: scripts de banco versionados

## Superficies principais identificadas

- dashboard financeiro
- transacoes
- agenda financeira
- contas e saldo liquidado
- cartoes de credito
- metas
- relatorios
- regras de categoria
- compras semanais (lista fixa, orcamento, historico, duracao dos itens e alerta de estoque)
- rotina da casa (calendario do mes e tarefas)
- registro de gastos e compras por voz ou texto, inclusive pela Siri (`/?voz=`, `/shopping?voz=`)
- chat com IA

## Endpoints identificados

- `src/app/api/ai-chat/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/api/notifications/check/route.ts`
- `src/app/api/shopping/suggest-duration/route.ts` (sessao; so le; chama a IA da NVIDIA)
- `src/app/api/quick-entry/parse/route.ts` (sessao; so interpreta a frase e devolve rascunho, nao grava; chama a IA da NVIDIA)

## Como rodar

```bash
npm run dev
```

## Dependencias de ambiente

Ver `.env.example`.

Variaveis identificadas hoje:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (reserva)
- `NVIDIA_API_KEY` e `NVIDIA_MODEL` (IA principal; `NVIDIA_MODEL` aceita varios modelos separados por virgula; ver `src/lib/ai/nvidia.ts`)

Leitura operacional atual das rotas sensiveis:

- `ai-chat`: usa a NVIDIA quando ha `NVIDIA_API_KEY` e cai para a Anthropic (`ANTHROPIC_API_KEY`) se a NVIDIA falhar; exige usuario autenticado e consulta dados financeiros via Supabase no servidor;
- `notifications/check`: exige usuario autenticado e consulta contas a pagar via sessao server-side;
- `auth/callback`: troca o `code` por sessao Supabase no servidor.

Camada Supabase atual:

- `src/lib/supabase/client.ts`: cliente browser com chaves publicas;
- `src/lib/supabase/server.ts`: cliente server-side com cookies de sessao e chave anonima publica;
- `src/lib/supabase/middleware.ts`: atualiza sessao e protege rotas privadas;
- `SUPABASE_SERVICE_ROLE_KEY` permanece disponivel apenas para usos server-side controlados.

## Modulos descontinuados

- o modulo de recorrencia foi removido do projeto;
- a integracao bancaria com Pluggy foi removida do projeto;
- os lancamentos seguem operacao exclusivamente manual;
- futuras automacoes e futuras integracoes bancarias nao fazem parte do escopo atual.

## Observacoes

- este repositório usa Supabase no cliente, middleware e servidor;
- existe endpoint de chat com IA (NVIDIA, com Anthropic como reserva);
- credenciais reais nao devem ser documentadas no repositório.
