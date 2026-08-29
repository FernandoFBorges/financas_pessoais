export type Tipo = 'despesa' | 'receita'

export interface Category {
  id: string
  user_id: string
  nome: string
  tipo: Tipo
  created_at: string
}

export interface PaymentMethod {
  id: string
  user_id: string
  nome: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  tipo: Tipo
  descricao: string
  categoria_id: string | null
  meio_pagamento_id: string | null
  valor: number
  valor_efetivo: number | null
  data_lancamento: string // YYYY-MM-DD
  competencia_mes: number // 1-12
  competencia_ano: number
  parcela_atual: number | null
  parcela_total: number | null
  grupo_parcelamento_id: string | null
  recorrente: boolean
  observacao: string | null
  created_at: string
}

export interface ReservaMovimento {
  id: string
  user_id: string
  tipo: 'deposito' | 'resgate'
  valor: number
  descricao: string | null
  data_lancamento: string
  competencia_mes: number
  competencia_ano: number
  created_at: string
}

export interface UserSettings {
  user_id: string
  saldo_inicial: number
  updated_at: string
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export function competenciaLabel(mes: number, ano: number) {
  return `${MESES[mes - 1]} / ${ano}`
}

export function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Regra única do app: um lançamento está "pago" quando tem valor efetivo
// lançado e esse valor é maior que zero. Não existe mais um estado manual
// de "pago" separado — é sempre derivado do valor efetivo.
export function valorEfetivoRealizado(t: { valor_efetivo: number | null }) {
  return t.valor_efetivo != null ? Number(t.valor_efetivo) : 0
}

export function estaPago(t: { valor_efetivo: number | null }) {
  return t.valor_efetivo != null && Number(t.valor_efetivo) > 0
}
