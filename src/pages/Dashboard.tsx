import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import Modal from '../components/Modal'
import TransactionForm, { type DuplicadoPrefill } from '../components/TransactionForm'
import TransactionColumn from '../components/TransactionColumn'
import { formatBRL, type Tipo, type Transaction } from '../lib/types'

export default function Dashboard() {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [modalTipo, setModalTipo] = useState<Tipo>('despesa')
  const [modalDuplicado, setModalDuplicado] = useState<DuplicadoPrefill | null>(null)

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

  const valorEfetivoRealizado = (t: Transaction) => {
    if (t.valor_efetivo != null) return Number(t.valor_efetivo)
    if (t.pago) return Number(t.valor)
    return 0
  }

  const receitas = items.filter((i) => i.tipo === 'receita')
  const despesas = items.filter((i) => i.tipo === 'despesa')

  const previstoReceitas = receitas.reduce((s, i) => s + Number(i.valor), 0)
  const previstoDespesas = despesas.reduce((s, i) => s + Number(i.valor), 0)
  const efetivoReceitas = receitas.reduce((s, i) => s + valorEfetivoRealizado(i), 0)
  const efetivoDespesas = despesas.reduce((s, i) => s + valorEfetivoRealizado(i), 0)
  const saldoEfetivo = efetivoReceitas - efetivoDespesas
  const saldoPrevisto = previstoReceitas - previstoDespesas

  function abrirNovo(tipo: Tipo) {
    setModalTipo(tipo)
    setModalDuplicado(null)
    setModalAberto(true)
  }

  function abrirDuplicar(t: Transaction) {
    const novoMes = t.competencia_mes === 12 ? 1 : t.competencia_mes + 1
    const novoAno = t.competencia_mes === 12 ? t.competencia_ano + 1 : t.competencia_ano
    setModalTipo(t.tipo)
    setModalDuplicado({
      tipo: t.tipo,
      descricao: t.descricao,
      categoria_id: t.categoria_id,
      meio_pagamento_id: t.meio_pagamento_id,
      valor: Number(t.valor),
      competencia_mes: novoMes,
      competencia_ano: novoAno,
      observacao: t.observacao,
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setModalDuplicado(null)
  }

  function onSalvo() {
    fecharModal()
    load()
  }

  async function togglePago(t: Transaction) {
    const novoPago = !t.pago
    const patch =
      novoPago && t.valor_efetivo == null
        ? { pago: novoPago, valor_efetivo: t.valor }
        : { pago: novoPago }
    await supabase.from('transactions').update(patch).eq('id', t.id)
    load()
  }

  async function salvarEfetivo(t: Transaction, valor: number | null) {
    await supabase.from('transactions').update({ valor_efetivo: valor }).eq('id', t.id)
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
          <span className="total-label">Receitas — efetivo</span>
          <span className="total-value">{formatBRL(efetivoReceitas)}</span>
          <span className="total-sub">Previsto: {formatBRL(previstoReceitas)}</span>
        </div>
        <div className="ledger-card total-card total-despesa">
          <span className="total-label">Despesas — efetivo</span>
          <span className="total-value">{formatBRL(efetivoDespesas)}</span>
          <span className="total-sub">Previsto: {formatBRL(previstoDespesas)}</span>
        </div>
        <div className={'stamp ' + (saldoEfetivo >= 0 ? 'stamp-positivo' : 'stamp-negativo')}>
          <span className="stamp-title">{saldoEfetivo >= 0 ? 'SALDO EFETIVO +' : 'SALDO EFETIVO -'}</span>
          <span className="stamp-value">{formatBRL(saldoEfetivo)}</span>
          <span className="stamp-sub">Previsto: {formatBRL(saldoPrevisto)}</span>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <div className="columns-grid">
          <TransactionColumn
            tipo="despesa"
            titulo="Despesas"
            items={despesas}
            categories={categories}
            paymentMethods={paymentMethods}
            onNovo={() => abrirNovo('despesa')}
            onDuplicar={abrirDuplicar}
            onTogglePago={togglePago}
            onSalvarEfetivo={salvarEfetivo}
            onExcluir={excluir}
          />
          <TransactionColumn
            tipo="receita"
            titulo="Receitas"
            items={receitas}
            categories={categories}
            paymentMethods={paymentMethods}
            onNovo={() => abrirNovo('receita')}
            onDuplicar={abrirDuplicar}
            onTogglePago={togglePago}
            onSalvarEfetivo={salvarEfetivo}
            onExcluir={excluir}
          />
        </div>
      )}

      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={modalDuplicado ? 'Duplicar lançamento' : modalTipo === 'despesa' ? 'Nova despesa' : 'Nova receita'}
      >
        <TransactionForm tipoInicial={modalTipo} duplicado={modalDuplicado} onSaved={onSalvo} onCancel={fecharModal} />
      </Modal>
    </div>
  )
}
