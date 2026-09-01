import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import Modal from '../components/Modal'
import TransactionForm, { type PrefillData } from '../components/TransactionForm'
import TransactionColumn from '../components/TransactionColumn'
import ReservaForm from '../components/ReservaForm'
import { MESES, estaPago, formatBRL, valorEfetivoRealizado, type ReservaMovimento, type Tipo, type Transaction } from '../lib/types'

export default function Dashboard() {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [saldoInicialGeral, setSaldoInicialGeral] = useState(0)
  const [acumuladoAnterior, setAcumuladoAnterior] = useState(0)
  const [pendenteDespesasAnteriores, setPendenteDespesasAnteriores] = useState(0)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalTipo, setModalTipo] = useState<Tipo>('despesa')
  const [modalPrefill, setModalPrefill] = useState<PrefillData | null>(null)
  const [modalEditando, setModalEditando] = useState<Transaction | null>(null)
  const [reservaItems, setReservaItems] = useState<ReservaMovimento[]>([])
  const [reservaAcumuladaAnterior, setReservaAcumuladaAnterior] = useState(0)
  const [reservaModalAberto, setReservaModalAberto] = useState(false)
  const [despesasColapsada, setDespesasColapsada] = useState(() => localStorage.getItem('despesasColapsada') === '1')
  const [receitasColapsada, setReceitasColapsada] = useState(() => localStorage.getItem('receitasColapsada') === '1')
  const [painelColapsado, setPainelColapsado] = useState(() => localStorage.getItem('painelColapsado') === '1')

  useEffect(() => {
    localStorage.setItem('despesasColapsada', despesasColapsada ? '1' : '0')
  }, [despesasColapsada])

  useEffect(() => {
    localStorage.setItem('receitasColapsada', receitasColapsada ? '1' : '0')
  }, [receitasColapsada])

  useEffect(() => {
    localStorage.setItem('painelColapsado', painelColapsado ? '1' : '0')
  }, [painelColapsado])

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
    setInitialLoadDone(true)
  }, [mes, ano])

  useEffect(() => {
    // Busca de dados ao trocar de competência — sincronização com o Supabase
    // (sistema externo), não um cálculo derivável durante o render.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const loadReserva = useCallback(async () => {
    const { data } = await supabase
      .from('reserva_movimentos')
      .select('*')
      .eq('competencia_mes', mes)
      .eq('competencia_ano', ano)
      .order('data_lancamento', { ascending: true })
    setReservaItems((data as ReservaMovimento[]) ?? [])
  }, [mes, ano])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadReserva()
  }, [loadReserva])

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
  // de despesa de meses passados ainda ficou pendente (sem valor efetivo lançado), e
  // quanto já tinha ido pra reserva antes deste mês.
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

      const { data: reservaAnterior } = await supabase
        .from('reserva_movimentos')
        .select('tipo, valor')
        .or(`competencia_ano.lt.${ano},and(competencia_ano.eq.${ano},competencia_mes.lt.${mes})`)

      const linhasReserva = (reservaAnterior ?? []) as { tipo: string; valor: number }[]
      const netReserva = linhasReserva.reduce(
        (acc, r) => acc + (r.tipo === 'deposito' ? Number(r.valor) : -Number(r.valor)),
        0
      )
      setReservaAcumuladaAnterior(netReserva)
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

  const depositosMes = reservaItems.filter((r) => r.tipo === 'deposito').reduce((s, r) => s + Number(r.valor), 0)
  const resgatesMes = reservaItems.filter((r) => r.tipo === 'resgate').reduce((s, r) => s + Number(r.valor), 0)
  const netReservaMes = depositosMes - resgatesMes
  const reservaAtual = reservaAcumuladaAnterior + netReservaMes

  // Dinheiro que foi pra reserva sai do saldo principal; dinheiro que voltou da
  // reserva entra de novo — por isso o net da reserva sempre entra com sinal trocado.
  const saldoInicialDoMes = saldoInicialGeral + acumuladoAnterior - reservaAcumuladaAnterior
  const saldoAtual = saldoInicialDoMes + efetivoReceitas - efetivoDespesas - netReservaMes
  const diferencaSaldo = saldoAtual - saldoInicialDoMes

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

  async function duplicarRecorrentes() {
    const prevMes = mes === 1 ? 12 : mes - 1
    const prevAno = mes === 1 ? ano - 1 : ano

    const { data: recorrentes } = await supabase
      .from('transactions')
      .select('*')
      .eq('competencia_mes', prevMes)
      .eq('competencia_ano', prevAno)
      .eq('recorrente', true)

    if (!recorrentes || recorrentes.length === 0) {
      alert(`Nenhum lançamento recorrente encontrado em ${MESES[prevMes - 1]}/${prevAno}.`)
      return
    }

    if (
      !confirm(
        `Duplicar ${recorrentes.length} lançamento(s) recorrente(s) de ${MESES[prevMes - 1]}/${prevAno} para ${MESES[mes - 1]}/${ano}?\n\n` +
          'O valor efetivo vem zerado — você marca como pago quando acontecer.'
      )
    )
      return

    const novos = recorrentes.map((t: Transaction) => ({
      tipo: t.tipo,
      descricao: t.descricao,
      categoria_id: t.categoria_id,
      meio_pagamento_id: t.meio_pagamento_id,
      valor: t.valor,
      valor_efetivo: null,
      data_lancamento: new Date().toISOString().slice(0, 10),
      competencia_mes: mes,
      competencia_ano: ano,
      parcela_atual: null,
      parcela_total: null,
      grupo_parcelamento_id: null,
      recorrente: true,
      observacao: t.observacao,
    }))

    await supabase.from('transactions').insert(novos)
    load()
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

  function abrirReserva() {
    setReservaModalAberto(true)
  }

  function fecharReserva() {
    setReservaModalAberto(false)
  }

  function onReservaSalva() {
    fecharReserva()
    loadReserva()
  }

  async function excluirMovimentoReserva(m: ReservaMovimento) {
    if (!confirm('Excluir este movimento de reserva?')) return
    await supabase.from('reserva_movimentos').delete().eq('id', m.id)
    loadReserva()
  }

  function somarMeses(m: number, a: number, delta: number) {
    const totalMeses = (a * 12 + (m - 1)) + delta
    return { mes: (((totalMeses % 12) + 12) % 12) + 1, ano: Math.floor(totalMeses / 12) }
  }

  async function antecipar(t: Transaction) {
    if (!t.grupo_parcelamento_id || !t.parcela_atual || !t.parcela_total) return

    const restantes = t.parcela_total - t.parcela_atual
    if (restantes <= 0) {
      alert('Essa já é a última parcela do parcelamento — não há o que antecipar.')
      return
    }

    const resposta = prompt(
      `Parcela atual: ${t.parcela_atual}/${t.parcela_total}.\n\n` +
        `Quantas parcelas EXTRAS antecipar pra essa mesma competência (além desta)? Máximo ${restantes}.`,
      '1'
    )
    if (resposta === null) return

    const n = Number(resposta)
    if (!Number.isInteger(n) || n < 1 || n > restantes) {
      alert(`Valor inválido. Digite um número inteiro entre 1 e ${restantes}.`)
      return
    }

    const totalParcelasPagas = n + 1 // a de referência + as antecipadas
    const sugestaoTotal = (Number(t.valor) * totalParcelasPagas).toFixed(2).replace('.', ',')

    const respostaValor = prompt(
      `Você vai pagar ${totalParcelasPagas} parcela(s) de uma vez (a ${t.parcela_atual} + ${n} antecipada(s)).\n\n` +
        `Qual o valor TOTAL pago? Vou dividir esse valor igualmente entre as ${totalParcelasPagas} parcelas.`,
      sugestaoTotal
    )
    if (respostaValor === null) return

    const valorTotalPago = Number(respostaValor.replace(',', '.'))
    if (!Number.isFinite(valorTotalPago) || valorTotalPago <= 0) {
      alert('Valor inválido. Digite um número maior que zero.')
      return
    }

    const valorPorParcela = valorTotalPago / totalParcelasPagas

    const { data: grupo } = await supabase
      .from('transactions')
      .select('*')
      .eq('grupo_parcelamento_id', t.grupo_parcelamento_id)
      .order('parcela_atual', { ascending: true })

    if (!grupo) return

    const antecipadas = (grupo as Transaction[]).filter(
      (p) => p.parcela_atual! > t.parcela_atual! && p.parcela_atual! <= t.parcela_atual! + n
    )
    const seguintes = (grupo as Transaction[]).filter((p) => p.parcela_atual! > t.parcela_atual! + n)

    const ultimaAntecipada = antecipadas[antecipadas.length - 1]
    if (
      !confirm(
        `Antecipar as parcelas ${t.parcela_atual! + 1} a ${ultimaAntecipada.parcela_atual} pra ${MESES[t.competencia_mes - 1]}/${t.competencia_ano}, ` +
          `rateando ${formatBRL(valorTotalPago)} em ${totalParcelasPagas} partes de ${formatBRL(valorPorParcela)} ` +
          `(parcelas ${t.parcela_atual} a ${ultimaAntecipada.parcela_atual})?\n\n` +
          `As parcelas seguintes (a partir da ${seguintes[0]?.parcela_atual ?? '—'}) recuam ${n} mês(es) no calendário.`
      )
    )
      return

    // A própria parcela de referência também entra no rateio.
    await supabase
      .from('transactions')
      .update({ valor_efetivo: valorPorParcela })
      .eq('id', t.id)

    await Promise.all(
      antecipadas.map((p) =>
        supabase
          .from('transactions')
          .update({
            competencia_mes: t.competencia_mes,
            competencia_ano: t.competencia_ano,
            valor_efetivo: valorPorParcela,
          })
          .eq('id', p.id)
      )
    )

    await Promise.all(
      seguintes.map((p) => {
        const nova = somarMeses(p.competencia_mes, p.competencia_ano, -n)
        return supabase
          .from('transactions')
          .update({ competencia_mes: nova.mes, competencia_ano: nova.ano })
          .eq('id', p.id)
      })
    )

    load()
  }

  const modalTitulo = modalEditando
    ? 'Editar lançamento'
    : modalPrefill
    ? 'Duplicar lançamento'
    : 'Novo lançamento'

  const gridTemplateVars = {
    '--col-despesas': despesasColapsada ? '56px' : '1fr',
    '--col-receitas': receitasColapsada ? '56px' : '1fr',
  } as CSSProperties

  return (
    <div className="dashboard-page">
      <div className="dashboard-header-zone">
        <div className="dashboard-header-toggle-row">
          <button
            className="link-btn dashboard-collapse-toggle"
            onClick={() => setPainelColapsado((c) => !c)}
          >
            {painelColapsado ? '▾ Mostrar resumo' : '▴ Recolher resumo'}
          </button>
        </div>

        {painelColapsado ? (
          <div className="dashboard-bar-compact">
            <span>Saldo inicial: <strong className="mono">{formatBRL(saldoInicialDoMes)}</strong></span>
            <span className="dash-receita">Receitas: <strong className="mono">{formatBRL(efetivoReceitas)}</strong></span>
            <span className="dash-despesa">Despesas: <strong className="mono">{formatBRL(efetivoDespesas)}</strong></span>
            <span className="dash-reserva">Reserva: <strong className="mono">{formatBRL(reservaAtual)}</strong></span>
            <span className={saldoAtual >= 0 ? 'diff-favoravel' : 'diff-desfavoravel'}>
              Saldo atual: <strong className="mono">{formatBRL(saldoAtual)}</strong>
            </span>
          </div>
        ) : (
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
            <div className="ledger-card dash-card">
              <span className="total-label">Reserva</span>
              <span className="total-value mono dash-reserva">{formatBRL(reservaAtual)}</span>
              {netReservaMes !== 0 && (
                <span className="dash-card-sub">
                  {netReservaMes >= 0 ? '+' : ''}{formatBRL(netReservaMes)} este mês
                </span>
              )}
            </div>
            <div className={'stamp ' + (saldoAtual >= 0 ? 'stamp-positivo' : 'stamp-negativo')}>
              <span className="stamp-title">SALDO ATUAL</span>
              <span className="stamp-value">{formatBRL(saldoAtual)}</span>
              <span className="stamp-sub">
                {diferencaSaldo >= 0 ? '+' : ''}{formatBRL(diferencaSaldo)} vs. saldo inicial do mês
              </span>
            </div>
          </div>
        )}

        <div className="page-toolbar">
          <button className="btn btn-ghost" onClick={duplicarRecorrentes}>
            ↻ Duplicar recorrentes
          </button>
          <button className="btn btn-ghost" onClick={abrirReserva}>
            🏦 Movimentar reserva
          </button>
          <button className="btn btn-primary" onClick={abrirNovo}>+ Novo lançamento</button>
        </div>

        {reservaItems.length > 0 && (
          <ul className="reserva-mini-list">
            {reservaItems.map((r) => (
              <li key={r.id}>
                <span className={'tag ' + (r.tipo === 'deposito' ? 'tag-despesa' : 'tag-receita')}>
                  {r.tipo === 'deposito' ? 'Depósito' : 'Resgate'}
                </span>
                <span className="reserva-mini-desc">{r.descricao || '—'}</span>
                <span className="mono">{formatBRL(Number(r.valor))}</span>
                <button className="icon-btn icon-btn-danger" onClick={() => excluirMovimentoReserva(r)} title="Excluir">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && !initialLoadDone ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <div className="columns-grid" style={gridTemplateVars}>
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
            onAntecipar={antecipar}
            colapsada={despesasColapsada}
            onToggleColapsar={() => setDespesasColapsada((c) => !c)}
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
            onAntecipar={antecipar}
            colapsada={receitasColapsada}
            onToggleColapsar={() => setReceitasColapsada((c) => !c)}
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

      <Modal open={reservaModalAberto} onClose={fecharReserva} title="Movimentar reserva">
        <ReservaForm onSaved={onReservaSalva} onCancel={fecharReserva} />
      </Modal>
    </div>
  )
}