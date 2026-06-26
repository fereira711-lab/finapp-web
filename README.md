# finapp-web

Aplicacao web financeira pessoal baseada em Next.js, React, TypeScript e Supabase.

## Objetivo

Centralizar saldo, transacoes, contas, cartoes, metas, recorrencias, relatorios e assistencia por IA em uma interface unica.

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
- recorrencias
- relatorios
- regras de categoria
- integracao bancaria
- chat com IA

## Endpoints identificados

- `src/app/api/ai-chat/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/api/notifications/check/route.ts`
- `src/app/api/pluggy-token/route.ts`
- `src/app/api/webhooks/pluggy/route.ts`

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
- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`
- `PLUGGY_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`

Leitura operacional atual das rotas sensiveis:

- `ai-chat`: usa `ANTHROPIC_API_KEY`, exige usuario autenticado e consulta dados financeiros via Supabase no servidor;
- `notifications/check`: exige usuario autenticado e consulta contas a pagar via sessao server-side;
- `pluggy-token`: usa `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` para gerar token de conexao;
- `webhooks/pluggy`: usa `PLUGGY_WEBHOOK_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` para validar assinatura e persistir transacoes;
- `auth/callback`: troca o `code` por sessao Supabase no servidor.

Camada Supabase atual:

- `src/lib/supabase/client.ts`: cliente browser com chaves publicas;
- `src/lib/supabase/server.ts`: cliente server-side com cookies de sessao e chave anonima publica;
- `src/lib/supabase/middleware.ts`: atualiza sessao e protege rotas privadas;
- `SUPABASE_SERVICE_ROLE_KEY` fica restrita ao webhook Pluggy.

## Observacoes

- este repositório usa Supabase no cliente, middleware e servidor;
- existe integracao com Pluggy para conectividade bancaria;
- existe endpoint de chat com IA via Anthropic;
- credenciais reais nao devem ser documentadas no repositório.
