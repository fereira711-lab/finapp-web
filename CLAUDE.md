# finapp-web — Instrucoes do Projeto

## 1. CONTEXTO
App financeiro pessoal com conexao automatica a bancos brasileiros via Open Finance (Pluggy), dashboard com graficos, relatorios mensais e IA financeira (Claude API).

- **Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase, Pluggy, Claude API
- **Deploy:** Vercel — finapp-web-phi.vercel.app
- **Repositorio:** https://github.com/fereira711-lab/finapp-web

## 2. CAMINHOS

- Casa: `C:\Users\rafae\finapp-web`
- Trabalho: `C:\Users\USER\finapp-web`

## 3. VARIAVEIS DE AMBIENTE (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://dqplbqtsoplrmcjkugdb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...LYqg
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
ANTHROPIC_API_KEY=sk-ant-...
```

## 4. BANCO DE DADOS (Supabase)
- **Tabelas:** profiles, accounts, transactions, bills
- **RLS ativo** — cada usuario ve so seus dados
- **Trigger automatico** cria perfil ao cadastrar

## 5. SERVICOS EXTERNOS

- **Supabase:** banco + auth — supabase.com
- **Pluggy:** Open Finance BR (+200 bancos) — pluggy.ai
- **Anthropic:** IA financeira — console.anthropic.com
- **Vercel:** deploy automatico do GitHub

## 6. PAGINAS DO APP

| Rota | Descricao |
|------|-----------|
| `/` | Dashboard com graficos |
| `/transactions` | Transacoes com filtros |
| `/bills` | Contas a pagar/receber |
| `/reports` | Relatorios mensais |
| `/ai` | Chat com IA financeira |
| `/connect-bank` | Widget Pluggy |
| `/profile` | Perfil do usuario |

## 7. PENDENCIAS

### MELHORIAS
- Editar conta depois de criada
- Recorrencia automatica ao marcar como paga
- Cartoes de credito em carrossel com visao mensal, parcelas e fatura
- Categorizacao inteligente de transacoes com IA
- Ativar chat IA (adicionar credito na Anthropic)
- Adicionar transacoes manualmente (dinheiro em especie)
- Metas financeiras por categoria
- Exportar relatorio em PDF
- Notificacoes de vencimento
- Dark/light mode toggle
- Sincronizacao automatica via webhook Pluggy
- Conectar banco real (aguardando Pluggy producao)

### CONCLUIDO
- Autenticacao com Supabase
- Dashboard com graficos (donut + barras)
- Transacoes com filtros por categoria e periodo
- Contas a pagar/receber com formulario
- Relatorios mensais comparativos
- Integracao Pluggy Connect
- Design mobile com bottom nav bar
- Deploy na Vercel

## 8. ROTINA

### AO CHEGAR NO TRABALHO
```bash
cd C:\Users\USER\finapp-web
git pull
npm install
npm run dev
```

### AO SAIR DO TRABALHO
```bash
git add .
git commit -m "descricao do que foi feito"
git push
```

### AO CHEGAR EM CASA
```bash
cd C:\Users\rafae\finapp-web
git pull
npm install
npm run dev
```

### AO ENCERRAR EM CASA
```bash
git add .
git commit -m "descricao do que foi feito"
git push
```

## 9. AVISO
Atualizar estas instrucoes sempre que concluir uma pendencia, surgir bug novo ou mudar alguma configuracao.
