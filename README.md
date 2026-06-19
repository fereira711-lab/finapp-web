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

## Observacoes

- este repositório usa Supabase no cliente, middleware e servidor;
- existe integracao com Pluggy para conectividade bancaria;
- existe endpoint de chat com IA via Anthropic;
- credenciais reais nao devem ser documentadas no repositório.
