import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import { formatBRL, type Transaction } from '../lib/types'

export default function Dashboard() {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'despesa' | 'receita'>('todos')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('competencia_mes', mes)
      .eq('competencia_ano', ano)
      .order('data_lancamento', { ascending: true })
    setItems((data as Transaction[]) ?? [])
    setLoading(false)
  }, [mes, ano])

  useEffect(() => {
    load()
  }, [load])

  const nomeCategoria = (id: string | null) => categories.find((c) => c.id === id)?.nome ?? '—'
  const nomeMeio = (id: string | null) => paymentMethods.find((p) => p.id === id)?.nome ?? '—'

  const receitas = items.filter((i) => i.tipo === 'receita')
  const despesas = items.filter((i) => i.tipo === 'despesa')
  const totalReceitas = receitas.reduce((s, i) => s + Number(i.valor), 0)
  const totalDespesas = despesas.reduce((s, i) => s + Number(i.valor), 0)
  const saldo = totalReceitas - totalDespesas

  const visiveis = items.filter((i) => filtro === 'todos' || i.tipo === filtro)

  async function duplicarParaProximoMes(t: Transaction) {
    const novoMes = t.competencia_mes === 12 ? 1 : t.competencia_mes + 1
    const novoAno = t.competencia_mes === 12 ? t.competencia_ano + 1 : t.competencia_ano

    const { error } = await supabase.from('transactions').insert({
      tipo: t.tipo,
      descricao: t.descricao,
      categoria_id: t.categoria_id,
      meio_pagamento_id: t.meio_pagamento_id,
      valor: t.valor,
      data_lancamento: new Date().toISOString().slice(0, 10),
      competencia_mes: novoMes,
      competencia_ano: novoAno,
      pago: false,
      recorrente: true,
      observacao: t.observacao,
    })

    if (!error) load()
  }

  async function togglePago(t: Transaction) {
    await supabase.from('transactions').update({ pago: !t.pago }).eq('id', t.id)
    load()
  }

  async function excluir(t: Transaction) {
    if (t.grupo_parcelamento_id) {
      const apagarGrupo = confirm(
        'Esse lançamento faz parte de um parcelamento. Excluir só esta parcela (OK) ou cancelar (Cancelar)?'
      )
      if (!apagarGrupo) return
    } else if (!confirm('Excluir este lançamento?')) {
      return
    }
    await supabase.from('transactions').delete().eq('id', t.id)
    load()
  }

  return (
    <div>
      <div className="totals-row">
        <div className="ledger-card total-card total-receita">
          <span className="total-label">Receitas</span>
          <span className="total-value">{formatBRL(totalReceitas)}</span>
        </div>
        <div className="ledger-card total-card total-despesa">
          <span className="total-label">Despesas</span>
          <span className="total-value">{formatBRL(totalDespesas)}</span>
        </div>
        <div className={'stamp ' + (saldo >= 0 ? 'stamp-positivo' : 'stamp-negativo')}>
          <span className="stamp-title">{saldo >= 0 ? 'SALDO POSITIVO' : 'SALDO NEGATIVO'}</span>
          <span className="stamp-value">{formatBRL(saldo)}</span>
        </div>
      </div>

      <div className="list-toolbar">
        <div className="filter-tabs">
          <button className={filtro === 'todos' ? 'chip active' : 'chip'} onClick={() => setFiltro('todos')}>Todos</button>
          <button className={filtro === 'receita' ? 'chip active' : 'chip'} onClick={() => setFiltro('receita')}>Receitas</button>
          <button className={filtro === 'despesa' ? 'chip active' : 'chip'} onClick={() => setFiltro('despesa')}>Despesas</button>
        </div>
        <Link to="/nova" className="btn btn-primary">+ Novo lançamento</Link>
      </div>

      <div className="ledger-card">
        {loading ? (
          <p className="empty-state">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="empty-state">Nada lançado nessa competência ainda. Comece pelo botão acima.</p>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Meio</th>
                <th>Lançado em</th>
                <th className="col-valor">Valor</th>
                <th className="col-pago">Pago</th>
                <th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((t) => (
                <tr key={t.id} className={t.tipo === 'receita' ? 'row-receita' : 'row-despesa'}>
                  <td>
                    {t.descricao}
                    {t.parcela_atual && t.parcela_total && (
                      <span className="badge-parcela">{t.parcela_atual}/{t.parcela_total}</span>
                    )}
                    {t.recorrente && <span className="badge-recorrente">recorrente</span>}
                  </td>
                  <td>{nomeCategoria(t.categoria_id)}</td>
                  <td>{nomeMeio(t.meio_pagamento_id)}</td>
                  <td>{new Date(t.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="col-valor mono">
                    {t.tipo === 'despesa' ? '-' : '+'} {formatBRL(Number(t.valor))}
                  </td>
                  <td className="col-pago">
                    <button
                      className={'pago-toggle' + (t.pago ? ' pago' : '')}
                      onClick={() => togglePago(t)}
                      title={t.pago ? 'Marcar como pendente' : 'Marcar como pago'}
                    >
                      {t.pago ? '✓' : '·'}
                    </button>
                  </td>
                  <td className="col-acoes">
                    <button className="icon-btn" onClick={() => duplicarParaProximoMes(t)} title="Duplicar para o próximo mês">⧉</button>
                    <button className="icon-btn icon-btn-danger" onClick={() => excluir(t)} title="Excluir">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
