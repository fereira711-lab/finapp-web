# ROADMAP

## Objetivo atual

Consolidar o `finapp-web` como aplicacao financeira pessoal com boa base documental, integracoes controladas e IA segura.

## Prioridades atuais

- padronizar documentacao-base do projeto
- manter integracoes financeiras sem expor credenciais
- consolidar contratos de ambiente e dependencias externas
- separar pendencias de produto de detalhes tecnicos soltos

## Frentes identificadas

### Produto

- dashboard financeiro
- transacoes
- contas e saldo
- cartoes de credito
- contas a pagar
- metas e recorrencias
- relatorios

### Integracoes

- Supabase
- Anthropic

### Governanca tecnica

- README, AGENTS e ROADMAP alinhados
- `.env.example` sem valores reais
- migracoes versionadas
- clareza de endpoints sensiveis

## Feito

- autenticacao com Supabase
- dashboard com graficos (donut e barras)
- transacoes com filtros por categoria e periodo
- contas a pagar e receber com formulario e edicao
- carrossel de mes na pagina de contas
- relatorios mensais comparativos
- notificacoes de vencimento (badge, alertas, destaque visual)
- design glassmorphism com personalizacao (fundo, opacidade, imagem)
- design mobile com bottom nav bar
- deploy na Vercel
- modulo de cartoes de credito com parcelamento
- edicao de lancamentos do cartao (este mes ou todas as parcelas)
- integracao cartoes com pagina de contas (bills criadas automaticamente)
- detalhe da fatura do cartao ao clicar na conta
- dashboard com gastos consolidados (debito/PIX e cartoes)
- metas financeiras por categoria com alertas no dashboard
- agrupamento de faturas de cartao na pagina de contas
- saldo atomico via RPC Postgres, sem race condition
- sincronizacao de valores a receber entre devices (profiles.receive_dates)
- loading skeletons nas listas e no dashboard
- refactor do dashboard: BalanceModal e QuickAddModal extraidos
- IA financeira considera gastos de cartao de credito
- modelo Anthropic atualizado para claude-sonnet-4-6
- filtro "Todas" em /transactions, alcancando transacoes fora de 3 meses
- dashboard recarrega apos mutacoes em outras telas

## Pendencias abertas

- confirmar contrato das variaveis de ambiente
- manter documentacao de integracoes atualizada
- revisar periodicamente a superficie de IA e webhooks
- manter a lista real de endpoints `src/app/api/` e de integracoes `src/lib/supabase/` coerente com README e AGENTS
- manter documentado quais rotas exigem sessao, quais usam segredo server-side e quais escrevem no Supabase
- manter claro que `SUPABASE_SERVICE_ROLE_KEY` fica restrita aos fluxos server-to-server, sem contaminar rotas autenticadas por sessao

## Nao fazer sem combinar

- expor chaves reais
- alterar banco real
- quebrar contratos de autenticacao
- abrir integracao nova sem documentar impacto
