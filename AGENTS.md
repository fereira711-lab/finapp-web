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

## Validacoes preferenciais

- revisar impacto em rotas `src/app/api/`
- revisar impacto em `src/lib/supabase/`
- confirmar variaveis necessarias em `.env.example`
- manter mudancas pequenas e localizadas quando possivel
