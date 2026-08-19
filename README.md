# Livro Caixa — Controle Financeiro (PWA)

App pessoal de controle financeiro, baseado nas suas planilhas "Controle Financeiro".
Stack: **React + TypeScript + Vite**, **Supabase** (Postgres + Auth) como backend,
**Tailwind v4** para estilo, PWA instalável, deploy automático no **GitHub Pages**.

## O que o app faz

- Lançamento de despesas e receitas, com categoria, meio de pagamento, valor e data.
- **Competência separada da data de lançamento** — você registra em que mês/ano o
  lançamento "vale" de fato, independente de quando foi digitado.
- **Duplicar para o próximo mês** — botão em cada lançamento pra recriar algo
  recorrente (aluguel, internet, salário) sem redigitar tudo.
- **Parcelamento** — tela própria que gera de uma vez todos os registros restantes
  de uma compra parcelada, um por competência, já ligados entre si. Aceita começar
  no meio (ex: parcela 3 de 12) pra casos que já vinham de outro controle.
- Totais de receita, despesa e saldo por mês selecionado.
- Categorias e meios de pagamento cadastráveis, com um botão pra preencher com os
  nomes que já aparecem nas suas planilhas (Moradia, Alimentação, Nubank, Pix etc.).
- Instalável como app (PWA) no celular ou desktop.

Fora de escopo por enquanto (não pedido no MVP): limites de cartão, caixinhas/reservas,
importação automática das planilhas antigas — você disse que vai lançar o histórico
manualmente, então não foi construído importador.

---

## 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e crie um novo projeto (free tier).
2. Vá em **SQL Editor** e rode o conteúdo do arquivo `supabase/schema.sql` deste
   projeto. Isso cria as tabelas `categories`, `payment_methods`, `transactions`,
   já com Row Level Security (cada linha só é visível pro seu próprio usuário).
3. Vá em **Authentication > Providers** e confirme que **Email** está habilitado
   (vem habilitado por padrão). Se quiser pular confirmação por e-mail pra testar
   mais rápido, em **Authentication > Settings** desative "Confirm email".
4. Vá em **Project Settings > API** e copie:
   - **Project URL**
   - **anon public key**

## 2. Rodar localmente

```bash
cp .env.example .env
# edite o .env e cole a URL e a anon key do passo anterior

npm install
npm run dev
```

Abra o endereço que o Vite mostrar, crie sua conta (e-mail/senha) na tela de login,
e em **Categorias & meios**, clique em "Preencher com categorias/meios padrão das
suas planilhas" pra já começar com Moradia, Alimentação, Nubank, Pix etc. cadastrados.

## 3. Publicar no GitHub Pages

1. Crie um repositório no GitHub e suba este projeto:
   ```bash
   git init
   git add .
   git commit -m "Livro Caixa - controle financeiro"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
   git push -u origin main
   ```
2. **Importante:** se o nome do seu repositório não for `financas-app`, abra
   `vite.config.ts` e troque a constante `REPO_NAME` pelo nome real do repositório
   — o GitHub Pages serve o site numa subpasta com esse nome
   (`SEU_USUARIO.github.io/NOME_DO_REPO/`), e o app precisa saber esse caminho.
3. No repositório no GitHub: **Settings > Pages > Build and deployment > Source**,
   selecione **GitHub Actions**.
4. Ainda no repositório: **Settings > Secrets and variables > Actions > New repository
   secret**, crie dois secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (os mesmos valores do seu `.env` local — são só a URL e a chave pública, não
   dão acesso admin ao banco, mas ainda assim ficam como secret por boa prática)
5. Dê push em `main` (ou rode o workflow manualmente em **Actions**). O workflow em
   `.github/workflows/deploy.yml` builda e publica automaticamente. Em alguns
   minutos o app estará em `https://SEU_USUARIO.github.io/NOME_DO_REPO/`.

Todo push em `main` depois disso publica de novo automaticamente.

## 4. Lançando o histórico manual (2024-2026)

Como combinado, o importador automático não foi construído — a ideia é você
digitar. Sugestão de ordem pra não perder o fio:
1. Cadastre primeiro todas as categorias e meios de pagamento que aparecem nas
   planilhas antigas (o seed padrão já cobre a maioria; adicione o que faltar
   em **Categorias & meios**, ex: "Sogro" e "Parto" como categorias de receita).
2. Lance mês a mês, mais recente pra mais antigo ou o inverso — o que for mais
   fácil de não perder lugar.
3. Pra despesas que já eram parceladas nas planilhas antigas e ainda têm parcelas
   futuras, use a tela **Parcelamento** com a parcela inicial correta (ex: se já
   está na parcela 5 de 12, comece com "parcela inicial = 5").

## Estrutura do projeto

```
src/
  lib/          cliente Supabase, tipos, hook de categorias/meios
  context/      autenticação e competência (mês/ano) selecionados
  components/   layout (sidebar + seletor de mês)
  pages/        Login, Dashboard, Novo lançamento, Parcelamento, Configurações
supabase/
  schema.sql    schema completo pra rodar no SQL Editor do Supabase
.github/workflows/deploy.yml   build + deploy automático no GitHub Pages
```

## Scripts

```bash
npm run dev       # desenvolvimento local
npm run build     # build de produção (roda antes do deploy também)
npm run preview   # pré-visualizar o build de produção localmente
```
