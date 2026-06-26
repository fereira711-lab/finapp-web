# AGENTS

## Escopo

Este projeto e um app financeiro pessoal em Next.js com Supabase, integracao bancaria e assistencia por IA.

## Regras

- nao expor `.env`, tokens, chaves ou segredos;
- nao alterar banco real sem pedido claro;
- nao executar migracoes sem autorizacao;
- preservar a separacao entre `src/app/`, `src/components/` e `src/lib/`;
- manter documentacao e roadmap coerentes com o estado real do projeto;
- tratar endpoints em `src/app/api/` como superficie sensivel.

## Areas sensiveis

- autenticacao e sessao
- Supabase
- webhooks Pluggy
- tokenizacao Pluggy
- chat com IA

## Superficie real identificada

- `src/app/api/ai-chat/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/api/notifications/check/route.ts`
- `src/app/api/pluggy-token/route.ts`
- `src/app/api/webhooks/pluggy/route.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`

## Leitura de risco atual

- `src/app/api/ai-chat/route.ts`: rota com IA e dados financeiros do usuario autenticado;
- `src/app/api/notifications/check/route.ts`: rota autenticada de leitura financeira server-side;
- `src/app/api/pluggy-token/route.ts`: rota que depende de segredos do servidor para gerar token de integracao;
- `src/app/api/webhooks/pluggy/route.ts`: rota de webhook com assinatura e escrita server-side em Supabase;
- `src/app/api/auth/callback/route.ts`: rota de autenticacao e sessao;
- `src/lib/supabase/server.ts`: ponto critico para acesso server-side ao Supabase com sessao por cookies;
- `src/lib/supabase/middleware.ts`: ponto critico para protecao de rotas privadas e refresh de sessao.

## Validacoes preferenciais

- revisar impacto em rotas `src/app/api/`
- revisar impacto em `src/lib/supabase/`
- confirmar variaveis necessarias em `.env.example`
- manter mudancas pequenas e localizadas quando possivel
