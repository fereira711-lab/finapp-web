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
- Pluggy
- Anthropic

### Governanca tecnica

- README, AGENTS e ROADMAP alinhados
- `.env.example` sem valores reais
- migracoes versionadas
- clareza de endpoints sensiveis

## Pendencias abertas

- confirmar contrato das variaveis de ambiente
- manter documentacao de integracoes atualizada
- revisar periodicamente a superficie de IA e webhooks

## Nao fazer sem combinar

- expor chaves reais
- alterar banco real
- quebrar contratos de autenticacao
- abrir integracao nova sem documentar impacto
