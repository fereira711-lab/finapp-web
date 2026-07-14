# finapp-web

Aplicacao web financeira pessoal baseada em Next.js, React, TypeScript e Supabase.

## Objetivo

Centralizar saldo, transacoes, contas, cartoes, metas, relatorios e assistencia por IA em uma interface unica com operacao manual dos lancamentos financeiros.

## Stack

- Next.js 15
- React 18
- TypeScript
- Supabase
- Tailwind CSS
- Recharts
- Anthropic SDK

## Estrutura principal

- `src/app/`: rotas, paginas e endpoints da aplicacao
- `src/components/`: componentes de interface
- `src/lib/`: integracoes, hooks e utilitarios
- `web/`: artefatos web estaticos
- `supabase-migrations/`: scripts de banco versionados

## Superficies principais identificadas

- dashboard financeiro
- transacoes
- contas e saldo
- contas a pagar
- cartoes de credito
- metas
- relatorios
- regras de categoria
- chat com IA

## Endpoints identificados

- `src/app/api/ai-chat/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/api/notifications/check/route.ts`

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
- `ANTHROPIC_API_KEY`

Leitura operacional atual das rotas sensiveis:

- `ai-chat`: usa `ANTHROPIC_API_KEY`, exige usuario autenticado e consulta dados financeiros via Supabase no servidor;
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
- os lancamentos passam a ser exclusivamente manuais;
- futuras automacoes e futuras integracoes bancarias nao fazem parte do escopo atual.

## Observacoes

- este repositório usa Supabase no cliente, middleware e servidor;
- existe endpoint de chat com IA via Anthropic;
- credenciais reais nao devem ser documentadas no repositório.
