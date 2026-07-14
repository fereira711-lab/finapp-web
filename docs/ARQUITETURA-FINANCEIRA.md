# Arquitetura Financeira Oficial

## 1. Objetivo

Formalizar a arquitetura financeira oficial do FinApp antes de qualquer correcao de codigo, definindo a responsabilidade de `Bill`, `Transaction`, `CardTransaction` e `Account.balance` com base na Auditoria Zero e no comportamento atual observado nas paginas e libs consultadas.

## Escopo de integracoes bancarias

- A integracao bancaria com Pluggy foi descontinuada.
- Integracoes bancarias e conectores de Open Finance estao fora do escopo ativo atual.
- A arquitetura financeira deve permanecer valida independentemente da origem futura dos dados.
- Pluggy nao faz parte das pendencias ativas desta arquitetura.

## Escopo de automacoes

- O modulo de recorrencia foi descontinuado.
- Lancamentos passam a ser exclusivamente manuais nas telas operacionais vigentes.
- Futuras automacoes de lancamento e futuras integracoes bancarias nao fazem parte do escopo atual.

## Papel das telas

- Dashboard = visao executiva do financeiro.
- Agenda Financeira = compromissos futuros, quitacao e organizacao operacional das Bills.
- Transacoes = movimentacoes realizadas de entrada e saida.
- `Account.balance` so muda por `Transaction`.
- Ajuste manual direto de saldo nao e fluxo oficial da arquitetura.

## 2. Entidades e responsabilidades

### `Bill`
- Representa compromisso financeiro futuro.
- Pode ser `payable` ou `receivable`.
- Pode estar `pending`, `overdue` ou `paid`.
- Bill `pending`, `overdue` ou cancelada nao altera saldo.
- Bill paga ou recebida registra quitacao do compromisso, mas a movimentacao liquidada oficial deve existir em `Transaction`.

### `Transaction`
- Representa movimentacao financeira realizada.
- E a fonte oficial de entradas e saidas liquidadas.
- E a base oficial para auditoria de caixa e saldo liquidado.
- Ao pagar ou receber uma Bill, deve ser criada uma `Transaction` correspondente.

### `CardTransaction`
- Representa compra realizada no cartao.
- Registra o evento economico da compra e sua classificacao.
- Nao altera `Account.balance` no momento da compra.
- Pode ser vinculada a uma ou mais Bills de fatura.

### `Account.balance`
- Representa somente saldo liquidado.
- Deve refletir apenas movimentacoes ja realizadas.
- Nao deve incluir contas a pagar, contas a receber previstas ou compras de cartao ainda nao liquidadas.

## 3. Fluxo de despesa realizada

1. Usuario registra uma despesa a vista.
2. O sistema cria uma `Transaction` do tipo `expense`.
3. O sistema atualiza `Account.balance`.
4. Nao deve existir `Bill` nesse fluxo, salvo se a regra do produto tratar a despesa como compromisso futuro.

## 4. Fluxo de conta a pagar

1. Usuario cria uma `Bill` do tipo `payable`.
2. A `Bill` representa apenas obrigacao futura.
3. Enquanto estiver `pending` ou `overdue`, nao altera `Account.balance`.
4. Ela pode compor indicadores de previsto, agenda e projecao.

## 5. Fluxo de conta a receber

1. Usuario cria uma `Bill` do tipo `receivable`.
2. A `Bill` representa apenas entrada futura esperada.
3. Enquanto estiver `pending` ou `overdue`, nao altera `Account.balance`.
4. Ela pode compor indicadores de previsto e projecao, separados do realizado.

## 6. Fluxo de pagamento de conta

1. Usuario paga uma `Bill payable`.
2. O sistema cria uma `Transaction` do tipo `expense`, com valor e data da liquidacao.
3. O sistema atualiza `Account.balance` a partir dessa `Transaction`.
4. So apos a atualizacao de saldo com sucesso a `Bill` e marcada como `paid`.
5. Se a atualizacao de saldo falhar, a liquidacao nao e concluida e o erro deve ser exposto.
6. Bills nao devem alterar saldo diretamente.

Fluxo de recebimento:

1. Usuario recebe uma `Bill receivable`.
2. O sistema cria uma `Transaction` do tipo `income`, com valor e data da liquidacao.
3. O sistema atualiza `Account.balance` a partir dessa `Transaction`.
4. A `Bill` e marcada como `paid`.

## 7. Fluxo de cartao de credito

1. Usuario registra uma compra no cartao.
2. O sistema cria uma `CardTransaction`.
3. O sistema cria a `Bill` da fatura correspondente como compromisso `payable`.
4. A compra no cartao nao altera `Account.balance` no momento do lancamento.
5. A fatura permanece como compromisso em `Bills` ate a quitacao.
6. No pagamento da fatura, deve ser criada uma `Transaction` de despesa liquidada.
7. So nessa liquidacao `Account.balance` deve ser alterado.
8. Na decisao atual, o pagamento da fatura cria uma `Transaction` por `Bill` liquidada.

Pendente de decisao:

- Se a `Bill` de cartao deve continuar item a item ou migrar para uma fatura consolidada por ciclo.
- O vinculo entre `card_transactions` e `bills` continua fragil por `notes` e `description` e depende de correcao estrutural futura com alteracao de schema.

## 8. Fonte oficial de cada indicador do dashboard

### Saldo atual
- Fonte oficial: `accounts.balance`.
- Interpretacao: saldo liquidado.

### Receitas realizadas
- Fonte oficial: `transactions` com movimentacoes liquidadas de entrada.

### Despesas realizadas
- Fonte oficial: `transactions` com movimentacoes liquidadas de saida.
- Compras em `card_transactions` sao despesa realizada no sentido economico, mas nao saldo liquidado.
- Pendente de decisao: manter no dashboard um indicador separado de despesa economica total, distinto de caixa liquidado.

### Contas a pagar
- Fonte oficial: `bills` do tipo `payable` com status nao pago.
- Faturas de cartao entram como previsto, nao como saldo atual.

### Contas a receber
- Fonte oficial: `bills` do tipo `receivable` com status nao pago.

### Valor final projetado
- Fonte oficial: calculo derivado.
- Formula oficial: saldo liquidado + recebimentos previstos - pagamentos previstos.

### Relatorios e metas
- Devem distinguir realizado de previsto.
- Realizado: `transactions`.
- Previsto: `bills`.
- Cartao aberto: compromisso futuro, ainda nao liquidado.

## 9. Regras de saldo

- `Account.balance` muda apenas com movimentacao liquidada.
- Criar, editar, atrasar, antecipar, cancelar ou excluir `Bill` nao deve alterar saldo, exceto se houver reflexo na `Transaction` de liquidacao ja existente.
- Criar `CardTransaction` nao deve alterar saldo.
- Pagar fatura do cartao deve alterar saldo por meio de `Transaction`.
- Falha ao atualizar saldo impede concluir a liquidacao da `Bill`.
- Ajustes manuais de saldo fora de `Transaction` ficam pendentes de decisao, pois hoje existe atualizacao direta por RPC em `src/lib/wallet.ts`.

## 10. Invariantes financeiras

- Todo valor liquidado que altere saldo deve ser rastreavel em `Transaction`.
- Nenhuma `Bill` pendente ou vencida pode alterar `Account.balance`.
- Nenhuma compra em `CardTransaction` pode alterar `Account.balance` antes da quitacao da fatura.
- Dashboard, relatorios e metas nao devem misturar realizado com previsto no mesmo indicador sem rotulo explicito.
- `Account.balance` deve continuar reconciliavel com o conjunto de movimentacoes liquidadas.

## 11. Pontos atuais que violam a arquitetura

### Bills alterando saldo diretamente
- `src/app/bills/page.tsx:454-460` recalcula efeito de saldo ao editar Bill.
- `src/app/bills/page.tsx:490-497` reverte saldo ao excluir Bill paga.
- `src/app/bills/page.tsx:511-516` marcar Bill como paga altera saldo sem criar `Transaction`.
- `src/app/bills/page.tsx:530-539` pagar grupo de cartao altera saldo sem criar `Transaction`.

### Transactions corretas como fonte de liquidacao a vista
- `src/app/transactions/page.tsx:314-325` cria `Transaction` e ajusta saldo para despesa/receita a vista.
- Esse fluxo esta alinhado com a arquitetura oficial.

### Cartao gera compromisso, mas quitacao ainda nao gera Transaction
- `src/app/transactions/page.tsx:249-291` cria `card_transactions` e `bills` para compras no cartao.
- `src/app/credit-cards/page.tsx:407-440` repete a mesma logica.
- O lancamento da compra respeita a separacao entre compra e compromisso, mas a quitacao da fatura ainda fecha saldo via `bills/page.tsx`, sem `Transaction`.

### Vinculo fragil entre cartao e Bill
- `src/app/credit-cards/page.tsx:252-263` localiza Bill por sufixo de descricao.
- `src/app/credit-cards/page.tsx:269-280` renomeia Bills por texto.
- `src/app/credit-cards/page.tsx:466-522` edita/exclui Bills por `notes` e `description`.
- Isso e fragil e permanece como divida tecnica ate uma etapa futura com alteracao de schema.

### Status mensal da fatura ainda depende de `credit_cards.status`
- `src/app/page.tsx` e `src/app/bills/page.tsx` ainda usam `credit_cards.status` como apoio para cartao aberto e grupo de fatura.
- Esse campo nao deve ser tratado como modelo definitivo do status mensal da fatura.
- A correcao estrutural tambem fica para etapa futura com alteracao de schema.

### Dashboard mistura realizado e previsto
- `src/app/page.tsx:122-149` consulta `accounts`, `transactions`, `bills` e `card_transactions` no mesmo carregamento.
- `src/app/page.tsx:182-187` calcula total de cartao por `card_transactions`.
- `src/app/page.tsx:189-224` calcula contas a pagar com mistura de `bills` e cartao aberto.
- `src/app/page.tsx:94-95` e `src/app/page.tsx:223-224` produzem projecao combinando saldo liquidado com previsto.
- A projecao em si faz sentido, mas precisa ficar explicitamente separada dos indicadores de realizado.

## 12. Ordem de implementacao

1. Oficializar este contrato como referencia obrigatoria.
2. Corrigir `Bills` para nao alterarem saldo diretamente.
3. Ao pagar ou receber `Bill`, criar `Transaction` correspondente.
4. Ajustar pagamento de fatura de cartao para gerar `Transaction` de liquidacao.
5. Separar no dashboard os indicadores de realizado, previsto e cartao aberto.
6. Revisar relatorios e metas para consumirem realizado e previsto de forma distinta.
7. Tratar o vinculo estrutural entre `card_transactions` e `bills`.
