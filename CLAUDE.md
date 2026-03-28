# 💰 finapp-web — Instruções do Projeto

## 1. CONTEXTO
App financeiro pessoal com conexão automática a bancos brasileiros via Open Finance (Pluggy), dashboard com gráficos, relatórios mensais e IA financeira (Claude API).

**Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase, Pluggy, Claude API
**Deploy:** Vercel — https://finapp-web-phi.vercel.app
**Repositório:** https://github.com/fereira711-lab/finapp-web

---

## 2. CAMINHOS
- 🏠 Casa: C:\Users\rafae\finapp-web
- 💼 Trabalho: C:\Users\USER\finapp-web

---

## 3. VARIÁVEIS DE AMBIENTE (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://dqplbqtsoplrmcjkugdb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...LYqg
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
ANTHROPIC_API_KEY=sk-ant-...

---

## 4. BANCO DE DADOS (Supabase)
- Tabelas: profiles, accounts, transactions, bills, credit_cards, card_transactions, goals
- Coluna appearance (jsonb) em profiles para preferências visuais
- RLS ativo — cada usuário vê só seus dados
- Trigger automático cria perfil ao cadastrar

---

## 5. SERVIÇOS EXTERNOS
- Supabase: banco + auth — supabase.com
- Pluggy: Open Finance BR (+200 bancos) — pluggy.ai
- Anthropic: IA financeira — console.anthropic.com
- Vercel: deploy automático do GitHub

---

## 6. PÁGINAS DO APP
- / — Dashboard com gráficos, alertas de vencimento, widget de metas
- /transactions — Transações com filtros e categorização
- /bills — Contas a pagar/receber com carrossel de mês
- /credit-cards — Cartões de crédito em carrossel com faturas
- /reports — Relatórios mensais comparativos
- /ai — Chat com IA financeira
- /connect-bank — Widget Pluggy
- /profile — Perfil + configurações de aparência
- /goals — Metas financeiras por categoria com barras de progresso
- /settings/appearance — Glass morphism personalizável

---

## 7. PENDÊNCIAS

### 🔧 MELHORIAS
- Categorização inteligente de transações com IA
- Ativar chat IA (adicionar crédito na Anthropic)
- Conectar banco real (aguardando Pluggy produção / CNPJ)

### ✅ CONCLUÍDO
- Autenticação com Supabase
- Dashboard com gráficos (donut + barras)
- Transações com filtros por categoria e período
- Contas a pagar/receber com formulário e edição
- Carrossel de mês na página de contas
- Recorrência automática com projeção de meses futuros
- Relatórios mensais comparativos
- Notificações de vencimento (badge, alertas, destaque visual)
- Integração Pluggy Connect
- Webhook Pluggy configurado (5 eventos)
- Sincronização automática via webhook (aguardando banco real)
- Design glassmorphism com personalização (fundo, opacidade, imagem)
- Design mobile com bottom nav bar
- Deploy na Vercel
- Módulo cartões de crédito com parcelamento
- Edição de lançamentos do cartão (este mês ou todas as parcelas)
- Integração cartões com página de contas (bills criadas automaticamente)
- Detalhe da fatura do cartão ao clicar na conta
- Dashboard com gastos consolidados (débito/PIX + cartões)
- CLAUDE.md criado e atualizado
- Metas financeiras por categoria com alertas no dashboard
- Agrupamento de faturas de cartão na página de contas

---

## 8. ROTINA

### 💼 AO CHEGAR NO TRABALHO
cd C:\Users\USER\finapp-web
git pull
npm install
npm run dev

### 💼 AO SAIR DO TRABALHO
git add .
git commit -m "descrição do que foi feito"
git push
- Tudo foi commitado?
- Há pendências para continuar em casa?
- Precisa atualizar o CLAUDE.md?

### 🏠 AO CHEGAR EM CASA
cd C:\Users\rafae\finapp-web
git pull
npm install
npm run dev

### 🏠 AO ENCERRAR EM CASA
git add .
git commit -m "descrição do que foi feito"
git push
- Tudo foi commitado?
- Há pendências para continuar no trabalho?
- Precisa atualizar o CLAUDE.md?

---

## 9. COMO ATUALIZAR ESTE ARQUIVO
Sempre que concluir uma pendência, surgir bug novo ou mudar configuração, peça ao Claude Code:

Atualize o CLAUDE.md: mova "[item]" de pendências para concluído

Depois commite:
git add CLAUDE.md
git commit -m "docs: atualiza CLAUDE.md"
git push

---

## 10. AVISO IMPORTANTE
Atualizar este arquivo sempre que:
- Concluir qualquer item da lista de pendências
- Surgir novo bug ou melhoria
- Mudar repositório, caminhos ou variáveis
- Mudar stack ou serviços

Depois: git add CLAUDE.md && git commit -m "docs: atualiza CLAUDE.md" && git push
