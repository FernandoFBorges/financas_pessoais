import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../lib/types'

function diaDeHoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dataVencimento(t: Transaction) {
  // mês da competência é 1-12; o construtor de Date espera 0-11
  const d = new Date(t.competencia_ano, t.competencia_mes - 1, t.dia_vencimento ?? 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function diffDias(t: Transaction, hoje: Date) {
  return Math.round((dataVencimento(t).getTime() - hoje.getTime()) / 86400000)
}

export default function VencimentosAlerta() {
  const [itens, setItens] = useState<Transaction[]>([])

  useEffect(() => {
    async function carregar() {
      const hoje = new Date()
      const mes = hoje.getMonth() + 1
      const ano = hoje.getFullYear()
      const proxMes = mes === 12 ? 1 : mes + 1
      const proxAno = mes === 12 ? ano + 1 : ano

      // Olha o mês atual e o seguinte — suficiente pra cobrir qualquer
      // vencimento dentro da janela de 5 dias, mesmo virando o mês.
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('tipo', 'despesa')
        .is('valor_efetivo', null)
        .not('dia_vencimento', 'is', null)
        .or(
          `and(competencia_mes.eq.${mes},competencia_ano.eq.${ano}),` +
            `and(competencia_mes.eq.${proxMes},competencia_ano.eq.${proxAno})`
        )

      setItens((data as Transaction[]) ?? [])
    }
    carregar()
  }, [])

  if (itens.length === 0) return null

  const hoje = diaDeHoje()
  const atrasadas = itens.filter((t) => diffDias(t, hoje) < 0)
  const vencemHoje = itens.filter((t) => diffDias(t, hoje) === 0)
  const em3dias = itens.filter((t) => { const d = diffDias(t, hoje); return d >= 1 && d <= 3 })
  const em5dias = itens.filter((t) => { const d = diffDias(t, hoje); return d >= 4 && d <= 5 })

  const totalRelevante = atrasadas.length + vencemHoje.length + em3dias.length + em5dias.length
  if (totalRelevante === 0) return null

  return (
    <div className="vencimentos-alerta">
      {atrasadas.length > 0 && (
        <span className="venc-chip venc-atrasada">⚠ {atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}</span>
      )}
      {vencemHoje.length > 0 && (
        <span className="venc-chip venc-hoje">🔴 {vencemHoje.length} hoje</span>
      )}
      {em3dias.length > 0 && (
        <span className="venc-chip venc-3dias">🟡 {em3dias.length} até 3 dias</span>
      )}
      {em5dias.length > 0 && (
        <span className="venc-chip venc-5dias">{em5dias.length} até 5 dias</span>
      )}
    </div>
  )
}
