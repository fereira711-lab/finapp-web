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
- metas
- relatorios
- compras semanais
- rotina da casa
- registro por voz ou texto

### Integracoes

- Supabase
- NVIDIA (IA principal)
- Anthropic (reserva)

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
- registro por voz/texto com IA ("Falar e registrar" no dashboard e atalho da Siri via /?voz=): a IA preenche o Lancamento Rapido e o usuario confere antes de salvar
- modulo de recorrencia e integracao bancaria (Pluggy) removidos (2026-07-14); lancamentos 100% manuais
- edicao e exclusao de categorias criadas; metas reordenaveis por arrastar com total das metas (2026-10-17)
- compras semanais: lista fixa, orcamento, historico, duracao dos itens, alerta de itens acabando, aprendizado automatico na 2a compra, fechamento por categoria e nova compra na mesma semana (2026-10-17 a 2026-10-20)
- registro de compras por voz ou texto com varios itens, inclusive pela Siri em /shopping?voz= (2026-10-20 e 2026-10-21)
- rotina da casa: calendario do mes, tarefas e encaixe automatico (2026-10-17)
- menu com ordem personalizavel, resumos de Casa e Compras no Dashboard, escala geral do texto (2026-10-17)
- IA da NVIDIA como principal, com lista de modelos de reserva e fallback do chat para a Anthropic (2026-10-17)

## Pendencias abertas

- confirmar contrato das variaveis de ambiente
- manter documentacao de integracoes atualizada
- revisar periodicamente a superficie de IA
- manter a lista real de endpoints `src/app/api/` e de integracoes `src/lib/supabase/` coerente com README e AGENTS
- manter documentado quais rotas exigem sessao, quais usam segredo server-side e quais escrevem no Supabase
- manter claro que `SUPABASE_SERVICE_ROLE_KEY` fica restrita aos fluxos server-to-server, sem contaminar rotas autenticadas por sessao
- conferir no painel da Vercel se `NVIDIA_API_KEY` e/ou `ANTHROPIC_API_KEY` existem em producao (sem nenhuma das duas a IA falha)
- conferir se a migration `011_allow_multiple_shopping_lists_per_week.sql` esta aplicada no Supabase antes de depender de varias listas de compras por semana
- `.env.local.txt` continua no disco (ignorado pelo Git); apagar ou renomear fica com o dono

## Nao fazer sem combinar

- expor chaves reais
- alterar banco real
- quebrar contratos de autenticacao
- abrir integracao nova sem documentar impacto
