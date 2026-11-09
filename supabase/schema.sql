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

-- =========================================================
-- Migração — adiciona valor efetivo (o que foi de fato pago/
-- recebido), separado do valor previsto (campo "valor" já existente)
-- Rode isso uma vez no SQL Editor do Supabase.
-- =========================================================

alter table transactions add column if not exists valor_efetivo numeric(12, 2);

-- =========================================================
-- Migração — parâmetros do usuário (saldo inicial da operação)
-- Rode isso uma vez no SQL Editor do Supabase.
-- =========================================================

create table if not exists user_settings (
  user_id uuid primary key references auth.users default auth.uid(),
  saldo_inicial numeric(12, 2) not null default 0,
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "user_settings_select_own" on user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on user_settings
  for update using (auth.uid() = user_id);

-- =========================================================
-- Migração — remove a coluna "pago", que não é mais usada.
-- Desde a introdução do valor efetivo, um lançamento é considerado
-- pago quando valor_efetivo > 0 — não existe mais um estado manual
-- separado. Rode isso uma vez no SQL Editor do Supabase.
-- =========================================================

alter table transactions drop column if exists pago;

-- =========================================================
-- Migração — reserva (transferências entre saldo principal e
-- reserva). Não é despesa nem receita — é dinheiro seu que muda
-- de lugar, não que entra ou sai de verdade. Rode uma vez no
-- SQL Editor do Supabase.
-- =========================================================

create table if not exists reserva_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  tipo text not null check (tipo in ('deposito', 'resgate')),
  valor numeric(12, 2) not null,
  descricao text,
  data_lancamento date not null,
  competencia_mes int not null check (competencia_mes between 1 and 12),
  competencia_ano int not null check (competencia_ano between 2000 and 2100),
  created_at timestamptz default now()
);

alter table reserva_movimentos enable row level security;

create policy "reserva_movimentos_select_own" on reserva_movimentos
  for select using (auth.uid() = user_id);
create policy "reserva_movimentos_insert_own" on reserva_movimentos
  for insert with check (auth.uid() = user_id);
create policy "reserva_movimentos_update_own" on reserva_movimentos
  for update using (auth.uid() = user_id);
create policy "reserva_movimentos_delete_own" on reserva_movimentos
  for delete using (auth.uid() = user_id);

create index if not exists idx_reserva_competencia
  on reserva_movimentos (user_id, competencia_ano, competencia_mes);

-- =========================================================
-- Migração — tema (claro/escuro) salvo no usuário, não só no
-- navegador. Resolve o tema "esquecendo" quando você alterna
-- entre o PWA instalado e a aba comum (cada um pode ter seu
-- próprio localStorage no celular, mas o banco é único).
-- Rode uma vez no SQL Editor do Supabase.
-- =========================================================

alter table user_settings
  add column if not exists tema text check (tema in ('light', 'dark'));

-- =========================================================
-- Migração — resumo mensal (e-mail "Resumo" + tela Resumo)
-- Rode uma vez no SQL Editor do Supabase.
--
-- A função calcula TODOS os números do resumo de uma competência.
-- É "security invoker": roda com as permissões de quem chamou, então o
-- RLS das tabelas continua valendo (cada usuário só enxerga o que é seu).
--
-- Regras (as mesmas do restante do app):
--  - Entradas e saídas saem nas DUAS visões: REAL (valor_efetivo, o que já foi
--    pago/recebido) e PREVISTO (valor, o que está programado no mês). Num mês
--    em andamento só o previsto mostra "quanto vai ser". Os percentuais de cada
--    visão usam a própria base (previsto ÷ previsto, real ÷ real).
--    Pendentes e valores de parcela usam o previsto.
--  - Entradas: "Salário" e "Outras". Categoria "Empréstimo" fica à parte e
--    NÃO conta como renda (nem nos percentuais).
--  - Grupos de despesa (disjuntos, somam o total de despesas):
--      recorrentes = marcado como recorrente
--      parceladas  = tem número de parcela OU grupo de parcelamento
--      variaveis   = o resto
--    (se um lançamento for recorrente E parcelado, conta como recorrente)
--  - Parcela "terminou no mês" = parcela_atual = parcela_total.
--  - Parcela "termina no mês seguinte" = falta 1 parcela (7/8) e a última
--    parcela da mesma compra NÃO está já no próprio mês (caso de antecipação).
--  - Parcela "começa" = parcela 1 de uma compra com mais de 1 parcela (1/10).
--    "Começa no mês seguinte" só aparece se essas parcelas já estiverem
--    lançadas no mês seguinte (o app cria todas as parcelas de uma vez).
--  - Saldo e reserva: mesma conta do Dashboard.
-- =========================================================

create or replace function resumo_mensal(p_ano integer, p_mes integer)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
base as (
  select
    t.tipo,
    t.descricao,
    t.valor,
    coalesce(t.valor_efetivo, 0) as efetivo,
    t.competencia_ano * 12 + t.competencia_mes as seq,
    t.recorrente,
    t.parcela_atual,
    t.parcela_total,
    t.grupo_parcelamento_id,
    c.nome as categoria,
    (t.grupo_parcelamento_id is not null
       or (t.parcela_atual is not null and t.parcela_total is not null)) as parcelada
  from transactions t
  left join categories c on c.id = t.categoria_id
  where t.user_id = auth.uid()
),
mes as (
  select * from base where seq = p_ano * 12 + p_mes
),
entradas as (
  select
    coalesce(sum(efetivo) filter (where categoria = 'Salário'), 0) as salario,
    coalesce(sum(efetivo) filter (where categoria = 'Empréstimo'), 0) as emprestimo,
    coalesce(sum(efetivo) filter (where coalesce(categoria, '') not in ('Salário', 'Empréstimo')), 0) as outras,
    coalesce(sum(efetivo), 0) as total_com_emprestimo,
    coalesce(sum(valor) filter (where categoria = 'Salário'), 0) as salario_previsto,
    coalesce(sum(valor) filter (where categoria = 'Empréstimo'), 0) as emprestimo_previsto,
    coalesce(sum(valor) filter (where coalesce(categoria, '') not in ('Salário', 'Empréstimo')), 0) as outras_previsto
  from mes
  where tipo = 'receita'
),
desp as (
  select
    *,
    case
      when recorrente then 'recorrentes'
      when parcelada then 'parceladas'
      else 'variaveis'
    end as grupo
  from mes
  where tipo = 'despesa'
),
saidas as (
  select
    coalesce(sum(efetivo), 0) as total,
    coalesce(sum(valor), 0) as total_previsto
  from desp
),
grupos as (
  select
    g.ord,
    g.chave,
    count(d.grupo) as qtd,
    count(d.grupo) filter (where d.efetivo > 0) as qtd_pagas,
    coalesce(sum(d.efetivo), 0) as valor,
    coalesce(sum(d.valor), 0) as valor_previsto
  from (values (1, 'recorrentes'), (2, 'parceladas'), (3, 'variaveis')) as g(ord, chave)
  left join desp d on d.grupo = g.chave
  group by g.ord, g.chave
),
finalizadas as (
  select descricao, parcela_atual, parcela_total, valor
  from mes
  where tipo = 'despesa'
    and parcela_atual is not null and parcela_total is not null
    and parcela_atual = parcela_total
),
terminam as (
  select m.descricao, m.parcela_atual, m.parcela_total, m.valor
  from mes m
  where m.tipo = 'despesa'
    and m.parcela_atual is not null and m.parcela_total is not null
    and m.parcela_total - m.parcela_atual = 1
    and not exists (
      select 1
      from mes f
      where f.tipo = 'despesa'
        and f.parcela_atual is not null and f.parcela_total is not null
        and f.parcela_atual = f.parcela_total
        and f.descricao = m.descricao
        and f.parcela_total = m.parcela_total
        and f.grupo_parcelamento_id is not distinct from m.grupo_parcelamento_id
    )
),
comecam as (
  select descricao, parcela_atual, parcela_total, valor
  from mes
  where tipo = 'despesa'
    and parcela_atual = 1 and parcela_total is not null and parcela_total > 1
),
comecam_prox as (
  select descricao, parcela_atual, parcela_total, valor
  from base
  where tipo = 'despesa'
    and seq = p_ano * 12 + p_mes + 1
    and parcela_atual = 1 and parcela_total is not null and parcela_total > 1
),
pendentes as (
  select
    count(*) filter (where tipo = 'despesa') as desp_qtd,
    coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as desp_valor,
    count(*) filter (where tipo = 'receita') as rec_qtd,
    coalesce(sum(valor) filter (where tipo = 'receita'), 0) as rec_valor
  from mes
  where not (efetivo > 0)
),
config as (
  select coalesce(
    (select saldo_inicial from user_settings where user_id = auth.uid()), 0
  ) as saldo_inicial
),
acumulado as (
  select coalesce(sum(case when tipo = 'receita' then efetivo else -efetivo end), 0) as valor
  from base
  where seq < p_ano * 12 + p_mes
),
reserva_ant as (
  select coalesce(sum(case when tipo = 'deposito' then valor else -valor end), 0) as net
  from reserva_movimentos
  where user_id = auth.uid()
    and competencia_ano * 12 + competencia_mes < p_ano * 12 + p_mes
),
reserva_mes as (
  select
    coalesce(sum(valor) filter (where tipo = 'deposito'), 0) as depositos,
    coalesce(sum(valor) filter (where tipo = 'resgate'), 0) as resgates
  from reserva_movimentos
  where user_id = auth.uid()
    and competencia_ano = p_ano and competencia_mes = p_mes
)
select jsonb_build_object(
  'ano', p_ano,
  'mes', p_mes,
  'entradas', jsonb_build_object(
    'salario', e.salario,
    'outras', e.outras,
    'renda', e.salario + e.outras,
    'emprestimo', e.emprestimo,
    'total_com_emprestimo', e.total_com_emprestimo,
    'salario_previsto', e.salario_previsto,
    'outras_previsto', e.outras_previsto,
    'renda_previsto', e.salario_previsto + e.outras_previsto,
    'emprestimo_previsto', e.emprestimo_previsto
  ),
  'saidas', jsonb_build_object(
    'total', s.total,
    'total_previsto', s.total_previsto,
    'grupos', (
      select jsonb_agg(
        jsonb_build_object(
          'chave', g.chave,
          'qtd', g.qtd,
          'qtd_pagas', g.qtd_pagas,
          'valor', g.valor,
          'pct_despesas', round(100 * g.valor / nullif(s.total, 0), 2),
          'pct_salario', round(100 * g.valor / nullif(e.salario, 0), 2),
          'pct_renda', round(100 * g.valor / nullif(e.salario + e.outras, 0), 2),
          'valor_previsto', g.valor_previsto,
          'prev_pct_despesas', round(100 * g.valor_previsto / nullif(s.total_previsto, 0), 2),
          'prev_pct_salario', round(100 * g.valor_previsto / nullif(e.salario_previsto, 0), 2),
          'prev_pct_renda', round(100 * g.valor_previsto / nullif(e.salario_previsto + e.outras_previsto, 0), 2)
        )
        order by g.ord
      )
      from grupos g
    )
  ),
  'parcelas', jsonb_build_object(
    'finalizadas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'descricao', f.descricao,
          'parcela_atual', f.parcela_atual,
          'parcela_total', f.parcela_total,
          'valor', f.valor
        ) order by f.descricao
      ) from finalizadas f
    ), '[]'::jsonb),
    'terminam_proximo_mes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'descricao', x.descricao,
          'parcela_atual', x.parcela_atual,
          'parcela_total', x.parcela_total,
          'valor', x.valor
        ) order by x.descricao
      ) from terminam x
    ), '[]'::jsonb),
    'comecam_mes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'descricao', c.descricao,
          'parcela_atual', c.parcela_atual,
          'parcela_total', c.parcela_total,
          'valor', c.valor
        ) order by c.descricao
      ) from comecam c
    ), '[]'::jsonb),
    'comecam_proximo_mes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'descricao', c.descricao,
          'parcela_atual', c.parcela_atual,
          'parcela_total', c.parcela_total,
          'valor', c.valor
        ) order by c.descricao
      ) from comecam_prox c
    ), '[]'::jsonb),
    'libera_no_mes_seguinte', (select coalesce(sum(valor), 0) from finalizadas),
    'libera_dois_meses_depois', (select coalesce(sum(valor), 0) from terminam),
    'entra_no_mes', (select coalesce(sum(valor), 0) from comecam),
    'entra_no_mes_seguinte', (select coalesce(sum(valor), 0) from comecam_prox)
  ),
  'pendentes', jsonb_build_object(
    'despesas', jsonb_build_object('qtd', p.desp_qtd, 'valor', p.desp_valor),
    'receitas', jsonb_build_object('qtd', p.rec_qtd, 'valor', p.rec_valor)
  ),
  'saldo', jsonb_build_object(
    'inicial', cfg.saldo_inicial + ac.valor - ra.net,
    'final', (cfg.saldo_inicial + ac.valor - ra.net)
             + e.total_com_emprestimo - s.total - (rm.depositos - rm.resgates),
    'reserva_total', ra.net + (rm.depositos - rm.resgates),
    'reserva_depositos', rm.depositos,
    'reserva_resgates', rm.resgates,
    'reserva_liquida_mes', rm.depositos - rm.resgates
  )
)
from entradas e, saidas s, pendentes p, config cfg, acumulado ac,
     reserva_ant ra, reserva_mes rm;
$$;

revoke execute on function resumo_mensal(integer, integer) from public, anon;
grant execute on function resumo_mensal(integer, integer) to authenticated;
