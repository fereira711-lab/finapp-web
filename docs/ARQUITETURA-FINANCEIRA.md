# Arquitetura Financeira Oficial

## 1. Objetivo

Formalizar a arquitetura financeira vigente do FinApp, com separacao explicita entre compromisso futuro, movimentacao liquidada e compra no cartao.

## Escopo atual

- Lancamentos sao exclusivamente manuais.
- O modulo de recorrencia foi totalmente descontinuado.
- A integracao bancaria com Pluggy foi descontinuada.
- A arquitetura deve permanecer valida independentemente de futuras origens de dados.

## Papel das telas

- Dashboard = visao executiva de saldo, realizado e previsto.
- Agenda Financeira = compromissos futuros, quitacao e organizacao operacional das Bills.
- Transacoes = movimentacoes realizadas de entrada e saida.
- Cartoes = compras no cartao e composicao da fatura aberta.

## 2. Entidades e responsabilidades

### `Bill`
- Representa compromisso financeiro futuro.
- Pode ser `payable` ou `receivable`.
- Pode estar `pending`, `overdue` ou `paid`.
- Bill pendente ou vencida nao altera saldo.

### `Transaction`
- Representa movimentacao financeira liquidada.
- E a fonte oficial de entradas e saidas liquidadas.
- Segue o padrao atual do projeto:
- `income` com `amount` positivo.
- `expense` com `amount` negativo.

### `CardTransaction`
- Representa compra realizada no cartao.
- Nao altera `Account.balance` no momento da compra.
- Gera compromisso futuro em `Bills`.

### `Account.balance`
- Representa somente saldo liquidado.
- So deve refletir movimentacoes ja realizadas via `Transaction`.

## 3. Fluxo de despesa realizada

1. Usuario registra uma despesa a vista.
2. O sistema cria uma `Transaction` do tipo `expense` com `amount` negativo.
3. O sistema atualiza `Account.balance`.

## 4. Fluxo de receita realizada

1. Usuario registra uma receita recebida.
2. O sistema cria uma `Transaction` do tipo `income` com `amount` positivo.
3. O sistema atualiza `Account.balance`.

## 5. Fluxo de conta a pagar

1. Usuario cria uma `Bill` do tipo `payable`.
2. A `Bill` representa apenas obrigacao futura.
3. Enquanto estiver `pending` ou `overdue`, nao altera `Account.balance`.

## 6. Fluxo de conta a receber

1. Usuario cria uma `Bill` do tipo `receivable`.
2. A `Bill` representa apenas entrada futura esperada.
3. Enquanto estiver `pending` ou `overdue`, nao altera `Account.balance`.

## 7. Fluxo de liquidacao de Bill

### Pagamento

1. Usuario liquida uma `Bill payable`.
2. O sistema cria uma `Transaction` do tipo `expense`.
3. O sistema atualiza `Account.balance`.
4. So apos sucesso no saldo a `Bill` e marcada como `paid`.

### Recebimento

1. Usuario liquida uma `Bill receivable`.
2. O sistema cria uma `Transaction` do tipo `income`.
3. O sistema atualiza `Account.balance`.
4. So apos sucesso no saldo a `Bill` e marcada como `paid`.

## 8. Fluxo de cartao de credito

1. Usuario registra uma compra no cartao.
2. O sistema cria uma `CardTransaction`.
3. O sistema cria a `Bill` correspondente como compromisso `payable`.
4. A compra nao altera `Account.balance`.
5. No pagamento da fatura, o sistema liquida cada `Bill` com uma `Transaction`.
6. So a `Transaction` altera o saldo.

## 9. Fonte oficial de cada indicador do dashboard

### Saldo atual
- Fonte oficial: `accounts.balance`.

### A receber
- Fonte oficial: `bills` do tipo `receivable` com status diferente de `paid`.

### A pagar
- Fonte oficial: `bills` do tipo `payable` com status diferente de `paid`.

### Saldo previsto
- Formula oficial: saldo liquidado + recebimentos previstos - pagamentos previstos.

### Receitas realizadas
- Fonte oficial: `transactions` liquidadas de entrada.

### Despesas realizadas
- Fonte oficial: `transactions` liquidadas de saida.
- Compras em `card_transactions` podem aparecer em indicadores economicos separados, mas nao compoem saldo liquidado.

## 10. Regras de saldo

- `Account.balance` muda apenas com movimentacao liquidada.
- Criar, editar, excluir ou reclassificar `Bill` nao altera saldo diretamente.
- Criar `CardTransaction` nao altera saldo.
- Todo valor que altera saldo deve ser rastreavel em `transactions`.
- O Quick Add segue o mesmo padrao de sinal das demais `transactions`.

## 11. Invariantes financeiras

- Nenhuma `Bill` pendente ou vencida pode alterar `Account.balance`.
- Nenhuma compra em `CardTransaction` pode alterar `Account.balance` antes da quitacao.
- Toda `Bill` liquidada deve gerar `Transaction`.
- Dashboard, relatorios e metas devem distinguir realizado de previsto.
- `Account.balance` deve continuar reconciliavel com o conjunto de movimentacoes liquidadas.

## 12. Dividas tecnicas ativas

### Vinculo fragil entre cartao e Bill
- O vinculo entre `card_transactions` e `bills` ainda depende de `notes` e `description`.
- A correcao estrutural fica para etapa futura com alteracao de schema.

### `credit_cards.status`
- O campo ainda e usado como apoio para estado de fatura aberta.
- Nao deve ser tratado como modelo definitivo de status mensal da fatura.

### Ausencia de atomicidade completa na liquidacao
- Hoje a ordem e `Transaction` -> saldo -> `Bill paid`.
- Se houver falha apos criar a `Transaction`, a Bill permanece pendente e o erro e exposto.
- Ainda existe risco residual de a `Transaction` ficar criada sem concluir toda a liquidacao.
