# 💰 finapp-web — Instruções do Projeto

## 1. CONTEXTO
App financeiro pessoal com conexão automática a bancos brasileiros via Open Finance (Pluggy), dashboard com gráficos, relatórios mensais e IA financeira (Claude API).

**Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase, Pluggy, Claude API
**Deploy:** Vercel — https://finapp-web-phi.vercel.app
**Repositório:** https://github.com/fereira711-lab/finapp-web

---

## 2. CAMINHOS
- 🏠 Casa: `C:\Users\rafae\finapp-web`
- 💼 Trabalho: `C:\Users\USER\finapp-web`

---

## 3. VARIÁVEIS DE AMBIENTE (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://dqplbqtsoplrmcjkugdb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...LYqg
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
ANTHROPIC_API_KEY=sk-ant-...

---

## 4. BANCO DE DADOS (Supabase)
- Tabelas: `profiles`, `accounts`, `transactions`, `bills`
- RLS ativo — cada usuário vê só seus dados
- Trigger automático cria perfil ao cadastrar

---

## 5. SERVIÇOS EXTERNOS
- **Supabase:** banco + auth — supabase.com
- **Pluggy:** Open Finance BR (+200 bancos) — pluggy.ai
- **Anthropic:** IA financeira — console.anthropic.com
- **Vercel:** deploy automático do GitHub

---

## 6. PÁGINAS DO APP
- `/` — Dashboard com gráficos
- `/transactions` — Transações com filtros
- `/bills` — Contas a pagar/receber
- `/reports` — Relatórios mensais
- `/ai` — Chat com IA financeira
- `/connect-bank` — Widget Pluggy
- `/profile` — Perfil do usuário

---

## 7. PENDÊNCIAS

### 🔧 MELHORIAS
- Editar conta depois de criada
- Recorrência automática ao marcar como paga
- Cartões de crédito em carrossel com visão mensal, parcelas e fatura
- Categorização inteligente de transações com IA
- Ativar chat IA (adicionar crédito na Anthropic)
- Adicionar transações manualmente (dinheiro em espécie)
- Metas financeiras por categoria
- Exportar relatório em PDF
- Notificações de vencimento
- Dark/light mode toggle
- Sincronização automática via webhook Pluggy
- Conectar banco real (aguardando Pluggy produção)

### ✅ CONCLUÍDO
- Autenticação com Supabase
- Dashboard com gráficos (donut + barras)
- Transações com filtros por categoria e período
- Contas a pagar/receber com formulário
- Relatórios mensais comparativos
- Integração Pluggy Connect
- Design mobile com bottom nav bar
- Deploy na Vercel
- CLAUDE.md criado

---

## 8. ROTINA

### 💼 AO CHEGAR NO TRABALHO
```bash
cd C:\Users\USER\finapp-web
git pull
npm install
npm run dev
```

### 💼 AO SAIR DO TRABALHO
```bash
git add .
git commit -m "descrição do que foi feito"
git push
```
- Tudo foi commitado?
- Há pendências para continuar em casa?
- Precisa atualizar o CLAUDE.md?

### 🏠 AO CHEGAR EM CASA
```bash
cd C:\Users\rafae\finapp-web
git pull
npm install
npm run dev
```

### 🏠 AO ENCERRAR EM CASA
```bash
git add .
git commit -m "descrição do que foi feito"
git push
```
- Tudo foi commitado?
- Há pendências para continuar no trabalho?
- Precisa atualizar o CLAUDE.md?

---

## 9. COMO ATUALIZAR ESTE ARQUIVO
Sempre que concluir uma pendência, surgir bug novo ou mudar configuração, peça ao Claude Code:
Atualize o CLAUDE.md: mova "[item]" de pendências para concluído

Ou:
Atualize o CLAUDE.md: adicione "[novo item]" nas melhorias pendentes

Depois commite:
```bash
git add CLAUDE.md
git commit -m "docs: atualiza CLAUDE.md"
git push
```

---

## 10. AVISO IMPORTANTE
Atualizar este arquivo sempre que:
- Concluir qualquer item da lista de pendências
- Surgir novo bug ou melhoria
- Mudar repositório, caminhos ou variáveis
- Mudar stack ou serviços

Depois rode:
git add CLAUDE.md && git commit -m "docs: atualiza CLAUDE.md" && git push
