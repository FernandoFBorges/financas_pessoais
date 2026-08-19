-- =========================================================
-- Controle Financeiro — schema Supabase
-- Rode isso no SQL Editor do seu projeto Supabase (uma vez só)
-- =========================================================

-- Extensão para gen_random_uuid (já vem habilitada na maioria dos projetos Supabase)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Categorias (despesa ou receita)
-- ---------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  nome text not null,
  tipo text not null check (tipo in ('despesa', 'receita')),
  created_at timestamptz default now()
);

alter table categories enable row level security;

create policy "categories_select_own" on categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on categories
  for update using (auth.uid() = user_id);
create policy "categories_delete_own" on categories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Meios de pagamento
-- ---------------------------------------------------------
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  nome text not null,
  created_at timestamptz default now()
);

alter table payment_methods enable row level security;

create policy "payment_methods_select_own" on payment_methods
  for select using (auth.uid() = user_id);
create policy "payment_methods_insert_own" on payment_methods
  for insert with check (auth.uid() = user_id);
create policy "payment_methods_update_own" on payment_methods
  for update using (auth.uid() = user_id);
create policy "payment_methods_delete_own" on payment_methods
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Lançamentos (despesas e receitas)
-- ---------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  tipo text not null check (tipo in ('despesa', 'receita')),
  descricao text not null,
  categoria_id uuid references categories on delete set null,
  meio_pagamento_id uuid references payment_methods on delete set null,
  valor numeric(12, 2) not null,
  data_lancamento date not null,
  competencia_mes int not null check (competencia_mes between 1 and 12),
  competencia_ano int not null check (competencia_ano between 2000 and 2100),
  pago boolean not null default false,
  parcela_atual int,
  parcela_total int,
  grupo_parcelamento_id uuid,
  recorrente boolean not null default false,
  observacao text,
  created_at timestamptz default now()
);

alter table transactions enable row level security;

create policy "transactions_select_own" on transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on transactions
  for update using (auth.uid() = user_id);
create policy "transactions_delete_own" on transactions
  for delete using (auth.uid() = user_id);

-- Índice para consultas por competência (a query mais comum do app)
create index if not exists idx_transactions_competencia
  on transactions (user_id, competencia_ano, competencia_mes);

create index if not exists idx_transactions_grupo_parcelamento
  on transactions (grupo_parcelamento_id);

-- =========================================================
-- Seed opcional: categorias e meios de pagamento a partir
-- das suas planilhas. Rode DEPOIS de criar seu usuário (login
-- uma vez no app) e SUBSTITUA 'SEU_USER_ID_AQUI' pelo seu id
-- (Supabase > Authentication > Users > copiar o UUID).
-- =========================================================

-- insert into categories (user_id, nome, tipo) values
--   ('SEU_USER_ID_AQUI', 'Moradia', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Imposto', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Transporte', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Internet', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'BB', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Casa', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Vestuário', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Presente', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Alimentação', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Saúde', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Educação', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Trabalho', 'despesa'),
--   ('SEU_USER_ID_AQUI', 'Salário', 'receita'),
--   ('SEU_USER_ID_AQUI', 'PJ', 'receita'),
--   ('SEU_USER_ID_AQUI', 'Sogro', 'receita'),
--   ('SEU_USER_ID_AQUI', 'Parto', 'receita'),
--   ('SEU_USER_ID_AQUI', 'Rendimento', 'receita');

-- insert into payment_methods (user_id, nome) values
--   ('SEU_USER_ID_AQUI', 'Pix'),
--   ('SEU_USER_ID_AQUI', 'Boleto'),
--   ('SEU_USER_ID_AQUI', 'Depósito Caixa'),
--   ('SEU_USER_ID_AQUI', 'Nubank'),
--   ('SEU_USER_ID_AQUI', 'Nubank MEI'),
--   ('SEU_USER_ID_AQUI', 'Nubank Thais'),
--   ('SEU_USER_ID_AQUI', 'Mercado Pago'),
--   ('SEU_USER_ID_AQUI', 'Dinheiro');
