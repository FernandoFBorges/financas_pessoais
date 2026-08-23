import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import Modal from '../components/Modal'
import TransactionForm, { type PrefillData } from '../components/TransactionForm'
import TransactionColumn from '../components/TransactionColumn'
import type { Tipo, Transaction } from '../lib/types'

export default function Dashboard() {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [modalTipo, setModalTipo] = useState<Tipo>('despesa')
  const [modalPrefill, setModalPrefill] = useState<PrefillData | null>(null)
  const [modalEditando, setModalEditando] = useState<Transaction | null>(null)

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

  const receitas = items.filter((i) => i.tipo === 'receita')
  const despesas = items.filter((i) => i.tipo === 'despesa')

  function abrirNovo() {
    setModalTipo('despesa')
    setModalPrefill(null)
    setModalEditando(null)
    setModalAberto(true)
  }

  function abrirDuplicar(t: Transaction) {
    const novoMes = t.competencia_mes === 12 ? 1 : t.competencia_mes + 1
    const novoAno = t.competencia_mes === 12 ? t.competencia_ano + 1 : t.competencia_ano
    setModalTipo(t.tipo)
    setModalEditando(null)
    setModalPrefill({
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

  function abrirEditar(t: Transaction) {
    setModalTipo(t.tipo)
    setModalPrefill(null)
    setModalEditando(t)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setModalPrefill(null)
    setModalEditando(null)
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

  const modalTitulo = modalEditando
    ? 'Editar lançamento'
    : modalPrefill
    ? 'Duplicar lançamento'
    : 'Novo lançamento'

  return (
    <div>
      <div className="page-toolbar">
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo lançamento</button>
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
            onDuplicar={abrirDuplicar}
            onEditar={abrirEditar}
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
            onDuplicar={abrirDuplicar}
            onEditar={abrirEditar}
            onTogglePago={togglePago}
            onSalvarEfetivo={salvarEfetivo}
            onExcluir={excluir}
          />
        </div>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={modalTitulo}>
        <TransactionForm
          tipoInicial={modalTipo}
          prefill={modalPrefill}
          editando={modalEditando}
          onSaved={onSalvo}
          onCancel={fecharModal}
        />
      </Modal>
    </div>
  )
}
