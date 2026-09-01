import { Fragment, useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { estaPago, formatBRL, valorEfetivoRealizado, type Category, type PaymentMethod, type Tipo, type Transaction } from '../lib/types'

type Agrupamento = 'nenhum' | 'categoria' | 'meio' | 'pago'
type FiltroPago = 'todos' | 'pago' | 'pendente'
type ColKey = 'descricao' | 'categoria' | 'meio' | 'data' | 'criado' | 'previsto' | 'efetivo'
type SortDir = 'asc' | 'desc'
type FiltroPopoverKey = 'categoria' | 'meio' | null

const COLUMN_LABELS: Record<ColKey, string> = {
  descricao: 'Descrição',
  categoria: 'Categoria',
  meio: 'Meio de pagamento',
  data: 'Data de lançamento',
  criado: 'Registrado em',
  previsto: 'Vlr. previsto',
  efetivo: 'Vlr. efetivo',
}

const DEFAULT_ORDER: ColKey[] = ['descricao', 'categoria', 'meio', 'data', 'criado', 'previsto', 'efetivo']

interface Props {
  tipo: Tipo
  titulo: string
  items: Transaction[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  onDuplicar: (t: Transaction) => void
  onEditar: (t: Transaction) => void
  onSalvarEfetivo: (t: Transaction, valor: number | null) => void
  onExcluir: (t: Transaction) => void
  onRegistrarPagamentoEmMassa: (ids: string[]) => Promise<void>
  onExcluirEmMassa: (ids: string[]) => Promise<void>
  onAntecipar: (t: Transaction) => void
  colapsada: boolean
  onToggleColapsar: () => void
}

export default function TransactionColumn({
  tipo, titulo, items, categories, paymentMethods,
  onDuplicar, onEditar, onSalvarEfetivo, onExcluir,
  onRegistrarPagamentoEmMassa, onExcluirEmMassa, onAntecipar,
  colapsada, onToggleColapsar,
}: Props) {
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroMeio, setFiltroMeio] = useState('')
  const [filtroPago, setFiltroPago] = useState<FiltroPago>('todos')
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [efetivoInput, setEfetivoInput] = useState('')
  const [colOrder, setColOrder] = useState<ColKey[]>(
    tipo === 'receita' ? DEFAULT_ORDER.filter((k) => k !== 'meio') : DEFAULT_ORDER
  )
  const [sortKey, setSortKey] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [arrastando, setArrastando] = useState<ColKey | null>(null)
  const [filtroPopoverAberto, setFiltroPopoverAberto] = useState<FiltroPopoverKey>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [processandoMassa, setProcessandoMassa] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 861px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)')
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const categoriasDoTipo = categories.filter((c) => c.tipo === tipo)
  const nomeCategoria = (id: string | null) => categories.find((c) => c.id === id)?.nome ?? '—'
  const nomeMeio = (id: string | null) => paymentMethods.find((p) => p.id === id)?.nome ?? '—'

  const filtrados = items.filter((t) => {
    if (filtroCategoria && t.categoria_id !== filtroCategoria) return false
    if (filtroMeio && t.meio_pagamento_id !== filtroMeio) return false
    if (filtroPago === 'pago' && !estaPago(t)) return false
    if (filtroPago === 'pendente' && estaPago(t)) return false
    return true
  })

  const totalPrevisto = filtrados.reduce((s, t) => s + Number(t.valor), 0)
  const totalEfetivo = filtrados.reduce((s, t) => s + valorEfetivoRealizado(t), 0)

  // Fixas x variáveis — só faz sentido pra despesas. Usa "items" (não "filtrados")
  // de propósito: é uma foto fixa, igual não importa o filtro ativo na grade.
  const resumoFixoVariavel =
    tipo === 'despesa'
      ? (() => {
          const fixas = items.filter((t) => t.recorrente || t.grupo_parcelamento_id != null)
          const variaveis = items.filter((t) => !t.recorrente && !t.grupo_parcelamento_id)
          const previstoFixas = fixas.reduce((s, t) => s + Number(t.valor), 0)
          const pagoFixas = fixas.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
          const previstoVariaveis = variaveis.reduce((s, t) => s + Number(t.valor), 0)
          const pagoVariaveis = variaveis.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
          const totalPrevistoGeral = previstoFixas + previstoVariaveis
          const totalPagoGeral = pagoFixas + pagoVariaveis
          const pendentes = items.filter((t) => !estaPago(t)).length
          return {
            previstoFixas,
            pagoFixas,
            previstoVariaveis,
            pagoVariaveis,
            totalPrevistoGeral,
            totalPagoGeral,
            restante: totalPrevistoGeral - totalPagoGeral,
            pendentes,
          }
        })()
      : null

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const todosFiltradosSelecionados = filtrados.length > 0 && filtrados.every((t) => selecionados.has(t.id))

  function alternarSelecionarTodos() {
    setSelecionados((prev) => {
      if (todosFiltradosSelecionados) {
        const next = new Set(prev)
        filtrados.forEach((t) => next.delete(t.id))
        return next
      }
      const next = new Set(prev)
      filtrados.forEach((t) => next.add(t.id))
      return next
    })
  }

  function inverterSelecao() {
    setSelecionados((prev) => {
      const next = new Set(prev)
      filtrados.forEach((t) => {
        if (next.has(t.id)) next.delete(t.id)
        else next.add(t.id)
      })
      return next
    })
  }

  async function registrarPagamentoSelecionados() {
    const ids = [...selecionados]
    if (ids.length === 0) return
    if (
      !confirm(
        `Registrar pagamento de ${ids.length} lançamento(s) selecionado(s)?\n\n` +
          'O valor previsto de cada um vira o valor efetivo (isso já conta como pago).'
      )
    )
      return
    setProcessandoMassa(true)
    await onRegistrarPagamentoEmMassa(ids)
    setProcessandoMassa(false)
    setSelecionados(new Set())
  }

  async function excluirSelecionados() {
    const ids = [...selecionados]
    if (ids.length === 0) return
    if (
      !confirm(
        `Excluir ${ids.length} lançamento(s) selecionado(s)? Isso pode incluir parcelas de parcelamento.`
      )
    )
      return
    setProcessandoMassa(true)
    await onExcluirEmMassa(ids)
    setProcessandoMassa(false)
    setSelecionados(new Set())
  }

  function campoOrdenavel(t: Transaction, key: ColKey): string | number {
    switch (key) {
      case 'descricao': return t.descricao.toLowerCase()
      case 'categoria': return nomeCategoria(t.categoria_id).toLowerCase()
      case 'meio': return nomeMeio(t.meio_pagamento_id).toLowerCase()
      case 'data': return t.data_lancamento
      case 'criado': return t.created_at
      case 'previsto': return Number(t.valor)
      case 'efetivo': return valorEfetivoRealizado(t)
    }
  }

  const ordenados = useMemo(() => {
    if (!sortKey) return filtrados
    const copia = [...filtrados]
    copia.sort((a, b) => {
      const va = campoOrdenavel(a, sortKey)
      const vb = campoOrdenavel(b, sortKey)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, sortKey, sortDir, categories, paymentMethods])

  const grupos = useMemo(() => {
    if (agrupamento === 'nenhum') {
      return [{ chave: 'flat', label: '', itens: ordenados }]
    }
    const map = new Map<string, Transaction[]>()
    for (const t of ordenados) {
      let chave: string
      if (agrupamento === 'categoria') chave = t.categoria_id ?? '__sem__'
      else if (agrupamento === 'meio') chave = t.meio_pagamento_id ?? '__sem__'
      else chave = estaPago(t) ? 'pago' : 'pendente'

      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(t)
    }

    function labelDe(chave: string) {
      if (agrupamento === 'categoria') return chave === '__sem__' ? 'Sem categoria' : nomeCategoria(chave)
      if (agrupamento === 'meio') return chave === '__sem__' ? 'Sem meio definido' : nomeMeio(chave)
      return chave === 'pago' ? 'Pago' : 'Pendente'
    }

    return [...map.entries()]
      .map(([chave, itens]) => ({ chave, label: labelDe(chave), itens }))
      .sort((a, b) => {
        const totalA = a.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
        const totalB = b.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
        return totalB - totalA
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenados, agrupamento])

  function iniciarEdicaoEfetivo(t: Transaction) {
    setEditandoId(t.id)
    setEfetivoInput(t.valor_efetivo != null ? String(t.valor_efetivo) : '')
  }

  function confirmarEdicaoEfetivo(t: Transaction) {
    const valor = efetivoInput.trim() === '' ? null : Number(efetivoInput.replace(',', '.'))
    onSalvarEfetivo(t, valor)
    setEditandoId(null)
  }

  function alternarOrdenacao(key: ColKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function onDragStart(e: DragEvent<HTMLTableCellElement>, key: ColKey) {
    setArrastando(key)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: DragEvent<HTMLTableCellElement>) {
    e.preventDefault()
  }

  function onDrop(e: DragEvent<HTMLTableCellElement>, targetKey: ColKey) {
    e.preventDefault()
    if (!arrastando || arrastando === targetKey) return
    setColOrder((prev) => {
      const next = [...prev]
      const from = next.indexOf(arrastando)
      const to = next.indexOf(targetKey)
      next.splice(from, 1)
      next.splice(to, 0, arrastando)
      return next
    })
    setArrastando(null)
  }

  function abrirFecharPopover(key: FiltroPopoverKey, e: MouseEvent) {
    e.stopPropagation()
    setFiltroPopoverAberto((atual) => (atual === key ? null : key))
  }

  function renderValorCelula(t: Transaction, key: 'previsto' | 'efetivo') {
    if (key === 'previsto') {
      return <span className="mono">{formatBRL(Number(t.valor))}</span>
    }
    if (editandoId === t.id) {
      return (
        <span className="efetivo-edit">
          <input
            className="efetivo-input"
            inputMode="decimal"
            value={efetivoInput}
            onChange={(e) => setEfetivoInput(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
          <button className="icon-btn" onClick={() => confirmarEdicaoEfetivo(t)} title="Salvar">✓</button>
          <button className="icon-btn" onClick={() => setEditandoId(null)} title="Cancelar">✕</button>
        </span>
      )
    }
    return (
      <button
        className={'tx-valor-efetivo' + (estaPago(t) ? ' tx-valor-pago' : '')}
        onClick={() => iniciarEdicaoEfetivo(t)}
        title="Clique para editar o valor efetivo — lançar um valor aqui já conta como pago"
      >
        {t.valor_efetivo != null ? formatBRL(Number(t.valor_efetivo)) : '— definir'}
      </button>
    )
  }

  function renderCelula(t: Transaction, key: ColKey) {
    switch (key) {
      case 'descricao':
        return (
          <span className="tx-descricao-cell">
            {t.descricao}
            {t.parcela_atual && t.parcela_total && <span className="badge-parcela">{t.parcela_atual}/{t.parcela_total}</span>}
            {t.recorrente && <span className="badge-recorrente">recorrente</span>}
          </span>
        )
      case 'categoria': return nomeCategoria(t.categoria_id)
      case 'meio': return nomeMeio(t.meio_pagamento_id)
      case 'data': return new Date(t.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')
      case 'criado': {
        const d = new Date(t.created_at)
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
      case 'previsto': return renderValorCelula(t, 'previsto')
      case 'efetivo': return renderValorCelula(t, 'efetivo')
    }
  }

  const nomeFiltroCategoriaAtivo = filtroCategoria ? nomeCategoria(filtroCategoria) : null
  const nomeFiltroMeioAtivo = filtroMeio ? nomeMeio(filtroMeio) : null

  // Setas: despesas encosta na borda esquerda, receitas na direita — a seta de
  // recolher aponta pra fora (pra borda), a de expandir aponta pra dentro.
  const setaRecolher = tipo === 'despesa' ? '‹' : '›'
  const setaExpandir = tipo === 'despesa' ? '›' : '‹'

  if (colapsada && isDesktop) {
    return (
      <div className={'ledger-card column-card column-' + tipo + ' column-collapsed-strip'}>
        <button className="column-expand-btn" onClick={onToggleColapsar} title={`Expandir ${titulo}`}>
          <span className="column-collapsed-icon">{setaExpandir}</span>
          <span className="column-collapsed-label">{titulo}</span>
          <span className="column-collapsed-total mono">{formatBRL(totalEfetivo)}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={'ledger-card column-card column-' + tipo} onClick={() => setFiltroPopoverAberto(null)}>
      <div className="column-fixed-part">
        <div className="column-header-row">
          <h2 className="form-title">{titulo}</h2>
          <button className="icon-btn column-collapse-btn" onClick={onToggleColapsar} title={`Recolher ${titulo}`}>
            {setaRecolher}
          </button>
        </div>

        <div className="column-total-bar">
          <span className="column-total-efetivo">{formatBRL(totalEfetivo)}</span>
          <span className="column-total-previsto">previsto {formatBRL(totalPrevisto)}</span>
        </div>

        {resumoFixoVariavel && (
          <div className="fixo-variavel-card">
            <div className="fixo-variavel-header">
              <span></span>
              <span>Previsto</span>
              <span>Pago</span>
            </div>
            <div className="fixo-variavel-row">
              <span>Despesas Fixas</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.previstoFixas)}</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.pagoFixas)}</span>
            </div>
            <div className="fixo-variavel-row">
              <span>Despesas Variáveis</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.previstoVariaveis)}</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.pagoVariaveis)}</span>
            </div>
            <div className="fixo-variavel-row fixo-variavel-total">
              <span>Total Despesas</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.totalPrevistoGeral)}</span>
              <span className="mono">{formatBRL(resumoFixoVariavel.totalPagoGeral)}</span>
            </div>
            <div className="fixo-variavel-restante">
              <span>
                Restante a pagar
                <span className="fixo-variavel-pendentes">
                  {resumoFixoVariavel.pendentes === 0
                    ? ' — 0 pendentes, pode ignorar'
                    : ` — ${resumoFixoVariavel.pendentes} pendente${resumoFixoVariavel.pendentes > 1 ? 's' : ''}`}
                </span>
              </span>
              <span className="mono">{formatBRL(resumoFixoVariavel.restante)}</span>
            </div>
          </div>
        )}

        <div className="column-toolbar">
          <button type="button" className="link-btn selecao-inverter-btn" onClick={inverterSelecao}>
            Inverter seleção
          </button>
          <div className="column-toolbar-selects">
            <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value as FiltroPago)}>
              <option value="todos">Pago e pendente</option>
              <option value="pago">Só pagos</option>
              <option value="pendente">Só pendentes</option>
            </select>
            <select value={agrupamento} onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}>
              <option value="nenhum">Sem agrupamento</option>
              <option value="categoria">Agrupar por categoria</option>
              <option value="meio">Agrupar por meio</option>
              <option value="pago">Agrupar por status</option>
            </select>
          </div>
        </div>

        {selecionados.size > 0 && (
          <div className="selecao-bar">
            <span>{selecionados.size} selecionado(s)</span>
            <button className="btn btn-primary btn-sm" onClick={registrarPagamentoSelecionados} disabled={processandoMassa}>
              Registrar pagamento
            </button>
            <button className="btn btn-ghost btn-sm" onClick={excluirSelecionados} disabled={processandoMassa}>
              Excluir
            </button>
          </div>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="empty-state">Nada por aqui com esse filtro.</p>
      ) : (
        <div className="column-scroll-area">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={todosFiltradosSelecionados}
                    onChange={alternarSelecionarTodos}
                    title="Selecionar todos os visíveis"
                  />
                </th>
                {colOrder.map((key) => (
                  <th
                    key={key}
                    draggable
                    onDragStart={(e) => onDragStart(e, key)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, key)}
                    className={
                      'grid-th' +
                      (key === 'previsto' || key === 'efetivo' ? ' col-valor' : '') +
                      (key === 'meio' || key === 'data' || key === 'criado' ? ' grid-th-wrap' : '')
                    }
                  >
                    <span className="grid-th-inner">
                      <span className="drag-grip">⠿</span>
                      <span onClick={() => alternarOrdenacao(key)} className="grid-th-label">
                        {COLUMN_LABELS[key]}
                        {sortKey === key && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </span>
                      {(key === 'categoria' || key === 'meio') && (
                        <span className="th-filter-wrap">
                          <button
                            className={'th-filter-btn' + ((key === 'categoria' ? nomeFiltroCategoriaAtivo : nomeFiltroMeioAtivo) ? ' active' : '')}
                            onClick={(e) => abrirFecharPopover(key, e)}
                            title="Filtrar"
                          >
                            ▾
                          </button>
                          {filtroPopoverAberto === key && (
                            <div className="th-filter-popover" onClick={(e) => e.stopPropagation()}>
                              <button
                                className={'th-filter-option' + (key === 'categoria' ? (!filtroCategoria ? ' active' : '') : (!filtroMeio ? ' active' : ''))}
                                onClick={() => {
                                  if (key === 'categoria') setFiltroCategoria('')
                                  else setFiltroMeio('')
                                  setFiltroPopoverAberto(null)
                                }}
                              >
                                {key === 'categoria' ? 'Todas categorias' : 'Todos os meios'}
                              </button>
                              {(key === 'categoria' ? categoriasDoTipo : paymentMethods).map((opt) => (
                                <button
                                  key={opt.id}
                                  className={
                                    'th-filter-option' +
                                    ((key === 'categoria' ? filtroCategoria === opt.id : filtroMeio === opt.id) ? ' active' : '')
                                  }
                                  onClick={() => {
                                    if (key === 'categoria') setFiltroCategoria(opt.id)
                                    else setFiltroMeio(opt.id)
                                    setFiltroPopoverAberto(null)
                                  }}
                                >
                                  {opt.nome}
                                </button>
                              ))}
                            </div>
                          )}
                        </span>
                      )}
                    </span>
                    {key === 'categoria' && nomeFiltroCategoriaAtivo && (
                      <span className="th-filter-active">{nomeFiltroCategoriaAtivo}</span>
                    )}
                    {key === 'meio' && nomeFiltroMeioAtivo && (
                      <span className="th-filter-active">{nomeFiltroMeioAtivo}</span>
                    )}
                  </th>
                ))}
                <th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.chave}>
                  {agrupamento !== 'nenhum' && (
                    <tr className="group-row">
                      <td colSpan={colOrder.length + 2}>
                        <span className="group-row-inner">
                          <span>{g.label}</span>
                          <span className="group-header-totais">
                            <span className="mono">{formatBRL(g.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0))}</span>
                            <span className="mono group-previsto">
                              prev. {formatBRL(g.itens.reduce((s, t) => s + Number(t.valor), 0))}
                            </span>
                          </span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {g.itens.map((t) => (
                    <tr key={t.id} className={t.tipo === 'receita' ? 'row-receita' : 'row-despesa'}>
                      <td className="col-check" data-label="">
                        <input type="checkbox" checked={selecionados.has(t.id)} onChange={() => toggleSelecionado(t.id)} />
                      </td>
                      {colOrder.map((key) => (
                        <td key={key} data-label={COLUMN_LABELS[key]} className={key === 'previsto' || key === 'efetivo' ? 'col-valor' : ''}>
                          {renderCelula(t, key)}
                        </td>
                      ))}
                      <td className="col-acoes" data-label="Ações">
                        {t.grupo_parcelamento_id && (
                          <button className="icon-btn" onClick={() => onAntecipar(t)} title="Antecipar parcelas seguintes">⏩</button>
                        )}
                        <button className="icon-btn" onClick={() => onEditar(t)} title="Editar">✎</button>
                        <button className="icon-btn" onClick={() => onDuplicar(t)} title="Duplicar para o próximo mês">⧉</button>
                        <button className="icon-btn icon-btn-danger" onClick={() => onExcluir(t)} title="Excluir">✕</button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
