import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import Modal from '../components/Modal'
import TransactionForm, { type PrefillData } from '../components/TransactionForm'
import TransactionColumn from '../components/TransactionColumn'
import { estaPago, formatBRL, valorEfetivoRealizado, type Tipo, type Transaction } from '../lib/types'

export default function Dashboard() {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const [saldoInicialGeral, setSaldoInicialGeral] = useState(0)
  const [acumuladoAnterior, setAcumuladoAnterior] = useState(0)
  const [pendenteDespesasAnteriores, setPendenteDespesasAnteriores] = useState(0)

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

  // Saldo inicial cadastrado em Parâmetros (uma vez só, não depende do mês)
  useEffect(() => {
    async function carregarSaldoInicial() {
      const { data } = await supabase.from('user_settings').select('saldo_inicial').maybeSingle()
      setSaldoInicialGeral(data?.saldo_inicial != null ? Number(data.saldo_inicial) : 0)
    }
    carregarSaldoInicial()
  }, [])

  // Soma efetiva (receita - despesa) de todas as competências ANTERIORES à selecionada,
  // pra saber quanto já tinha acumulado ao entrar no mês atual — e, de quebra, quanto
  // de despesa de meses passados ainda ficou pendente (sem valor efetivo lançado).
  useEffect(() => {
    async function carregarAcumulado() {
      const { data } = await supabase
        .from('transactions')
        .select('tipo, valor, valor_efetivo')
        .or(`competencia_ano.lt.${ano},and(competencia_ano.eq.${ano},competencia_mes.lt.${mes})`)

      const linhas = (data ?? []) as { tipo: string; valor: number; valor_efetivo: number | null }[]
      const soma = linhas.reduce((acc, t) => {
        const efetivo = valorEfetivoRealizado(t)
        return acc + (t.tipo === 'receita' ? efetivo : -efetivo)
      }, 0)
      setAcumuladoAnterior(soma)

      const pendente = linhas
        .filter((t) => t.tipo === 'despesa' && !estaPago(t))
        .reduce((acc, t) => acc + Number(t.valor), 0)
      setPendenteDespesasAnteriores(pendente)
    }
    carregarAcumulado()
  }, [mes, ano])

  const receitas = items.filter((i) => i.tipo === 'receita')
  const despesas = items.filter((i) => i.tipo === 'despesa')

  const previstoReceitas = receitas.reduce((s, i) => s + Number(i.valor), 0)
  const previstoDespesas = despesas.reduce((s, i) => s + Number(i.valor), 0)
  const efetivoReceitas = receitas.reduce((s, i) => s + valorEfetivoRealizado(i), 0)
  const efetivoDespesas = despesas.reduce((s, i) => s + valorEfetivoRealizado(i), 0)

  const diferencaReceitas = efetivoReceitas - previstoReceitas
  const diferencaDespesas = efetivoDespesas - previstoDespesas

  const saldoInicialDoMes = saldoInicialGeral + acumuladoAnterior
  const saldoAtual = saldoInicialDoMes + efetivoReceitas - efetivoDespesas

  function formatDiff(v: number) {
    const sinal = v > 0 ? '+' : ''
    return sinal + formatBRL(v)
  }

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

  async function registrarPagamentoEmMassa(ids: string[]) {
    // Cada lançamento leva seu PRÓPRIO valor previsto pro efetivo — o valor muda
    // por linha, então precisa de um update individual por id (não dá com um só .in()).
    const selecionados = items.filter((i) => ids.includes(i.id))
    await Promise.all(
      selecionados.map((t) => supabase.from('transactions').update({ valor_efetivo: t.valor }).eq('id', t.id))
    )
    load()
  }

  async function excluirEmMassa(ids: string[]) {
    await supabase.from('transactions').delete().in('id', ids)
    load()
  }

  const modalTitulo = modalEditando
    ? 'Editar lançamento'
    : modalPrefill
    ? 'Duplicar lançamento'
    : 'Novo lançamento'

  return (
    <div>
      <div className="dashboard-bar">
        <div className="ledger-card dash-card">
          <span className="total-label">Saldo inicial do mês</span>
          <span className="total-value mono">{formatBRL(saldoInicialDoMes)}</span>
        </div>
        <div className="ledger-card dash-card">
          <span className="total-label">Receitas</span>
          <span className="total-value mono dash-receita">{formatBRL(efetivoReceitas)}</span>
          <span className="dash-card-sub">previsto {formatBRL(previstoReceitas)}</span>
          <span className={'dash-card-diff ' + (diferencaReceitas >= 0 ? 'diff-favoravel' : 'diff-desfavoravel')}>
            diferença {formatDiff(diferencaReceitas)}
          </span>
        </div>
        <div className="ledger-card dash-card">
          <span className="total-label">Despesas</span>
          <span className="total-value mono dash-despesa">{formatBRL(efetivoDespesas)}</span>
          <span className="dash-card-sub">previsto {formatBRL(previstoDespesas)}</span>
          <span className={'dash-card-diff ' + (diferencaDespesas <= 0 ? 'diff-favoravel' : 'diff-desfavoravel')}>
            diferença {formatDiff(diferencaDespesas)}
          </span>
          {pendenteDespesasAnteriores > 0 && (
            <span className="dash-card-pendente">
              pendente de meses anteriores: {formatBRL(pendenteDespesasAnteriores)}
            </span>
          )}
        </div>
        <div className={'stamp ' + (saldoAtual >= 0 ? 'stamp-positivo' : 'stamp-negativo')}>
          <span className="stamp-title">SALDO ATUAL</span>
          <span className="stamp-value">{formatBRL(saldoAtual)}</span>
        </div>
      </div>

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
            onSalvarEfetivo={salvarEfetivo}
            onExcluir={excluir}
            onRegistrarPagamentoEmMassa={registrarPagamentoEmMassa}
            onExcluirEmMassa={excluirEmMassa}
          />
          <TransactionColumn
            tipo="receita"
            titulo="Receitas"
            items={receitas}
            categories={categories}
            paymentMethods={paymentMethods}
            onDuplicar={abrirDuplicar}
            onEditar={abrirEditar}
            onSalvarEfetivo={salvarEfetivo}
            onExcluir={excluir}
            onRegistrarPagamentoEmMassa={registrarPagamentoEmMassa}
            onExcluirEmMassa={excluirEmMassa}
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
